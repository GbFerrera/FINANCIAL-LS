import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// SSE para comentários em tempo real
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    
    // Verificar se o usuário está autenticado
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Verificar se o projeto existe e o usuário tem acesso
    const project = await prisma.project.findFirst({
      where: {
        id: resolvedParams.id,
        OR: [
          { clientId: session.user.id },
          { team: { some: { userId: session.user.id } } }
        ]
      }
    })

    if (!project) {
      return new NextResponse('Project not found', { status: 404 })
    }

    // Configurar SSE
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        // Enviar heartbeat inicial
        const heartbeat = `data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`
        controller.enqueue(encoder.encode(heartbeat))

        // Polling para novos comentários (simplificado)
        let lastCheck = new Date()
        const projectId = resolvedParams.id
        
        const checkForUpdates = async () => {
          try {
            const newComments = await prisma.comment.findMany({
              where: {
                projectId: projectId,
                createdAt: {
                  gt: lastCheck
                }
              },
              include: {
                author: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true
                  }
                },
                client: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              },
              orderBy: { createdAt: 'asc' }
            })

            if (newComments.length > 0) {
              const transformedComments = newComments.map(comment => ({
                id: comment.id,
                content: comment.content,
                type: comment.type,
                createdAt: comment.createdAt.toISOString(),
                authorName: comment.author?.name || comment.client?.name || 'Usuário',
                authorId: comment.authorId || comment.clientId,
                isFromClient: comment.type === 'CLIENT_REQUEST'
              }))

              const message = `data: ${JSON.stringify({ 
                type: 'new_comments', 
                comments: transformedComments 
              })}\n\n`
              controller.enqueue(encoder.encode(message))
              
              lastCheck = new Date()
            }
          } catch (error) {
            console.error('Erro ao verificar novos comentários:', error)
          }
        }

        // Verificar a cada 2 segundos
        const interval = setInterval(checkForUpdates, 2000)

        // Cleanup quando a conexão for fechada
        request.signal.addEventListener('abort', () => {
          clearInterval(interval)
          controller.close()
        })
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    })
  } catch (error) {
    console.error('Erro no SSE:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
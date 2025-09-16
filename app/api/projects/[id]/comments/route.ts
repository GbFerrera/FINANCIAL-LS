import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET - Buscar comentários do projeto
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se o projeto existe
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    // Buscar comentários do projeto
    const comments = await prisma.comment.findMany({
      where: { projectId: params.id },
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

    // Transformar dados para o frontend
    const transformedComments = comments.map(comment => ({
      id: comment.id,
      content: comment.content,
      type: comment.type,
      createdAt: comment.createdAt.toISOString(),
      authorName: comment.author?.name || comment.client?.name || 'Usuário',
      authorId: comment.authorId || comment.clientId,
      isFromClient: comment.type === 'CLIENT_REQUEST'
    }))

    return NextResponse.json({ comments: transformedComments })
  } catch (error) {
    console.error('Erro ao buscar comentários:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// POST - Criar novo comentário da equipe
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    if (!session.user?.id) {
      return NextResponse.json({ error: 'ID do usuário não encontrado' }, { status: 400 })
    }

    const body = await request.json()
    const { content, type = 'CLIENT_VISIBLE' } = body

    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Conteúdo do comentário é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se o projeto existe
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true, clientId: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    // Criar o comentário
    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        type,
        projectId: params.id,
        authorId: session.user.id
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      }
    })

    // Se for um comentário visível ao cliente, criar notificação
    if (type === 'CLIENT_VISIBLE' && project.clientId) {
      // Verificar se o cliente existe antes de criar a notificação
      const clientExists = await prisma.client.findUnique({
        where: { id: project.clientId },
        select: { id: true }
      })
      
      if (clientExists) {
        try {
          await prisma.notification.create({
            data: {
              title: 'Nova resposta da equipe',
              message: `A equipe respondeu no projeto: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
              type: 'CLIENT_COMMENT',
              userId: project.clientId
            }
          })
        } catch (notificationError) {
          console.error('Erro ao criar notificação:', notificationError)
          // Não falhar a criação do comentário por causa da notificação
        }
      } else {
        console.warn('Cliente não encontrado para notificação:', project.clientId)
      }
    }

    return NextResponse.json({
      message: 'Comentário enviado com sucesso',
      comment: {
        id: comment.id,
        content: comment.content,
        type: comment.type,
        createdAt: comment.createdAt.toISOString(),
        authorName: comment.author?.name || 'Usuário',
        authorId: comment.authorId,
        isFromClient: false
      }
    })
  } catch (error) {
    console.error('Erro ao criar comentário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
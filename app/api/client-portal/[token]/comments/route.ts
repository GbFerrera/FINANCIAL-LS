import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    // Find client by access token
    const client = await prisma.client.findUnique({
      where: { accessToken: params.token },
      select: {
        id: true,
        name: true
      }
    })

    if (!client) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { projectId, content } = body

    if (!projectId || !content?.trim()) {
      return NextResponse.json(
        { error: 'Dados obrigatórios não fornecidos' },
        { status: 400 }
      )
    }

    // Verify that the project belongs to this client
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        clientId: client.id
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Projeto não encontrado ou acesso negado' },
        { status: 404 }
      )
    }

    // Create the comment
    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        type: 'CLIENT_REQUEST',
        projectId,
        clientId: client.id
      },
      include: {
        client: {
          select: {
            name: true
          }
        }
      }
    })

    return NextResponse.json({
      message: 'Comentário enviado com sucesso',
      comment: {
        id: comment.id,
        content: comment.content,
        type: comment.type,
        createdAt: comment.createdAt.toISOString(),
        authorName: comment.client?.name || null
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
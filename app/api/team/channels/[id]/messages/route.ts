import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const channelId = params.id

    // Buscar usuários para simular mensagens
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    })

    // Simular mensagens para diferentes canais
    const getMessagesForChannel = (channelId: string) => {
      const baseMessages = [
        {
          id: `msg_${channelId}_1`,
          content: channelId === 'general' 
            ? 'Bem-vindos ao canal geral! 👋'
            : channelId === 'projects'
            ? 'Vamos discutir os próximos projetos aqui'
            : 'Este é um espaço para conversas casuais',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          author: {
            id: 'system',
            name: 'Sistema',
            email: 'system@company.com',
            role: 'ADMIN',
            isOnline: true
          },
          channelId,
          type: 'TEXT' as const,
          edited: false
        }
      ]

      if (users.length > 0) {
        baseMessages.push(
          {
            id: `msg_${channelId}_2`,
            content: channelId === 'general'
              ? 'Obrigado! Estou animado para trabalhar com vocês'
              : channelId === 'projects'
              ? 'Temos alguns projetos interessantes chegando'
              : 'Alguém quer um café? ☕',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
            author: {
              ...users[0],
              isOnline: true
            },
            channelId,
            type: 'TEXT' as const,
            edited: false
          },
          {
            id: `msg_${channelId}_3`,
            content: channelId === 'general'
              ? 'Vamos fazer um ótimo trabalho juntos! 🚀'
              : channelId === 'projects'
              ? 'Preciso revisar os requisitos do projeto X'
              : 'Eu aceito! Onde nos encontramos?',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
            author: users.length > 1 ? {
              ...users[1],
              isOnline: false
            } : {
              ...users[0],
              isOnline: true
            },
            channelId,
            type: 'TEXT' as const,
            edited: false
          }
        )
      }

      if (channelId === 'projects' && users.length > 2) {
        baseMessages.push(
          {
            id: `msg_${channelId}_4`,
            content: 'Acabei de atualizar o cronograma no sistema. Podem dar uma olhada?',
            createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
            author: {
              ...users[2],
              isOnline: true
            },
            channelId,
            type: 'TEXT' as const,
            edited: false
          },
          {
            id: `msg_${channelId}_5`,
            content: 'Perfeito! Vou revisar agora mesmo',
            createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
            author: {
              ...users[0],
              isOnline: true
            },
            channelId,
            type: 'TEXT' as const,
            edited: false
          }
        )
      }

      return baseMessages
    }

    const messages = getMessagesForChannel(channelId)

    return NextResponse.json({
      messages
    })
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { content, type = 'TEXT' } = body
    const channelId = params.id

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Conteúdo da mensagem é obrigatório' },
        { status: 400 }
      )
    }

    // Simular criação de mensagem
    // Em uma implementação real, salvaria no banco de dados
    const newMessage = {
      id: `msg_${channelId}_${Date.now()}`,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      author: {
        id: session.user.id,
        name: session.user.name || 'Usuário',
        email: session.user.email || '',
        role: session.user.role || 'USER',
        isOnline: true
      },
      channelId,
      type,
      edited: false
    }

    return NextResponse.json({
      message: newMessage
    })
  } catch (error) {
    console.error('Erro ao criar mensagem:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
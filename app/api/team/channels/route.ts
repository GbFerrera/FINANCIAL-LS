import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Buscar todos os usuários para popular os canais
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    })

    // Criar canais padrão se não existirem
    const channels = [
      {
        id: 'general',
        name: 'geral',
        type: 'GENERAL' as const,
        description: 'Canal geral da equipe',
        participants: users.map(user => ({
          ...user,
          isOnline: Math.random() > 0.5, // Simulação de status online
          lastSeen: Math.random() > 0.7 ? '2 min atrás' : undefined
        })),
        unreadCount: 0,
        lastMessage: {
          content: 'Bem-vindos ao chat da equipe!',
          createdAt: new Date().toISOString(),
          author: {
            id: 'system',
            name: 'Sistema',
            email: 'system@company.com',
            role: 'ADMIN',
            isOnline: true
          }
        }
      },
      {
        id: 'projects',
        name: 'projetos',
        type: 'GENERAL' as const,
        description: 'Discussões sobre projetos',
        participants: users.map(user => ({
          ...user,
          isOnline: Math.random() > 0.5,
          lastSeen: Math.random() > 0.7 ? '5 min atrás' : undefined
        })),
        unreadCount: 2,
        lastMessage: {
          content: 'Vamos discutir o cronograma do projeto X',
          createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          author: users[0] ? {
            ...users[0],
            isOnline: true
          } : {
            id: 'system',
            name: 'Sistema',
            email: 'system@company.com',
            role: 'ADMIN',
            isOnline: true
          }
        }
      },
      {
        id: 'random',
        name: 'aleatório',
        type: 'GENERAL' as const,
        description: 'Conversas casuais',
        participants: users.map(user => ({
          ...user,
          isOnline: Math.random() > 0.5,
          lastSeen: Math.random() > 0.7 ? '1 hora atrás' : undefined
        })),
        unreadCount: 0,
        lastMessage: {
          content: 'Alguém quer café? ☕',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          author: users[1] ? {
            ...users[1],
            isOnline: false
          } : {
            id: 'system',
            name: 'Sistema',
            email: 'system@company.com',
            role: 'ADMIN',
            isOnline: true
          }
        }
      }
    ]

    return NextResponse.json({
      channels
    })
  } catch (error) {
    console.error('Erro ao buscar canais:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, description, type = 'GENERAL' } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Nome do canal é obrigatório' },
        { status: 400 }
      )
    }

    // Por enquanto, retornar sucesso simulado
    // Em uma implementação real, salvaria no banco de dados
    const newChannel = {
      id: `channel_${Date.now()}`,
      name,
      type,
      description,
      participants: [],
      unreadCount: 0,
      createdAt: new Date().toISOString()
    }

    return NextResponse.json({
      channel: newChannel
    })
  } catch (error) {
    console.error('Erro ao criar canal:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
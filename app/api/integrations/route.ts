import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    // Simular integrações disponíveis
    const integrations = [
      {
        id: 'webhook',
        name: 'Webhooks',
        description: 'Receba notificações em tempo real sobre eventos do sistema',
        type: 'webhook',
        enabled: true,
        config: {
          url: 'https://api.exemplo.com/webhook',
          events: ['project.created', 'task.completed', 'client.message']
        }
      },
      {
        id: 'slack',
        name: 'Slack',
        description: 'Integração com Slack para notificações da equipe',
        type: 'oauth',
        enabled: false,
        config: {
          channel: '#projetos',
          botToken: ''
        }
      },
      {
        id: 'zapier',
        name: 'Zapier',
        description: 'Conecte com mais de 5000 aplicativos via Zapier',
        type: 'api_key',
        enabled: false,
        config: {
          apiKey: '',
          triggers: []
        }
      },
      {
        id: 'google_calendar',
        name: 'Google Calendar',
        description: 'Sincronize prazos de projetos com Google Calendar',
        type: 'oauth',
        enabled: false,
        config: {
          calendarId: '',
          syncDeadlines: true
        }
      },
      {
        id: 'trello',
        name: 'Trello',
        description: 'Exporte projetos e tarefas para boards do Trello',
        type: 'api_key',
        enabled: false,
        config: {
          apiKey: '',
          token: '',
          boardId: ''
        }
      }
    ]

    return NextResponse.json({
      integrations
    })
  } catch (error) {
    console.error('Erro ao buscar integrações:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, type, config } = body

    if (!name || !description || !type) {
      return NextResponse.json(
        { error: 'Nome, descrição e tipo são obrigatórios' },
        { status: 400 }
      )
    }

    // Validar tipos de integração
    const validTypes = ['webhook', 'oauth', 'api_key']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Tipo de integração inválido' },
        { status: 400 }
      )
    }

    // Simular criação de integração personalizada
    const newIntegration = {
      id: `custom_${Date.now()}`,
      name,
      description,
      type,
      enabled: false,
      config: config || {},
      createdAt: new Date().toISOString(),
      createdBy: session.user.id
    }

    return NextResponse.json({
      integration: newIntegration,
      message: 'Integração criada com sucesso'
    })
  } catch (error) {
    console.error('Erro ao criar integração:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
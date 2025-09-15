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

    // Buscar configurações de notificação do usuário
    const userSettings = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        notificationSettings: true,
        email: true
      }
    })

    // Configurações padrão caso não existam
    const defaultSettings = {
      email: {
        enabled: true,
        address: session.user.email || '',
        frequency: 'immediate'
      },
      whatsapp: {
        enabled: false,
        phone: '',
        frequency: 'immediate'
      },
      push: {
        enabled: true,
        frequency: 'immediate'
      },
      types: {
        projectUpdates: true,
        taskDeadlines: true,
        clientMessages: true,
        systemAlerts: true,
        teamChat: false,
        reports: true
      }
    }

    // Usar configurações salvas ou padrão
    const settings = userSettings?.notificationSettings 
      ? JSON.parse(userSettings.notificationSettings as string)
      : defaultSettings

    // Garantir que o email está atualizado
    if (settings.email) {
      settings.email.address = userSettings?.email || session.user.email || ''
    }

    return NextResponse.json({
      settings
    })
  } catch (error) {
    console.error('Erro ao buscar configurações:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { email, whatsapp, push, types } = body

    // Validar estrutura dos dados
    if (!email || !whatsapp || !push || !types) {
      return NextResponse.json(
        { error: 'Dados de configuração incompletos' },
        { status: 400 }
      )
    }

    // Validar email se habilitado
    if (email.enabled && (!email.address || !email.address.includes('@'))) {
      return NextResponse.json(
        { error: 'Email válido é obrigatório quando notificações por email estão habilitadas' },
        { status: 400 }
      )
    }

    // Validar WhatsApp se habilitado
    if (whatsapp.enabled && (!whatsapp.phone || whatsapp.phone.length < 10)) {
      return NextResponse.json(
        { error: 'Número de telefone válido é obrigatório quando notificações por WhatsApp estão habilitadas' },
        { status: 400 }
      )
    }

    // Validar frequências
    const validFrequencies = ['immediate', 'daily', 'weekly']
    if (!validFrequencies.includes(email.frequency) || 
        !validFrequencies.includes(whatsapp.frequency) || 
        !validFrequencies.includes(push.frequency)) {
      return NextResponse.json(
        { error: 'Frequência de notificação inválida' },
        { status: 400 }
      )
    }

    // Preparar configurações para salvar
    const updatedSettings = {
      email: {
        enabled: Boolean(email.enabled),
        address: email.address,
        frequency: email.frequency
      },
      whatsapp: {
        enabled: Boolean(whatsapp.enabled),
        phone: whatsapp.phone,
        frequency: whatsapp.frequency
      },
      push: {
        enabled: Boolean(push.enabled),
        frequency: push.frequency
      },
      types: {
        projectUpdates: Boolean(types.projectUpdates),
        taskDeadlines: Boolean(types.taskDeadlines),
        clientMessages: Boolean(types.clientMessages),
        systemAlerts: Boolean(types.systemAlerts),
        teamChat: Boolean(types.teamChat),
        reports: Boolean(types.reports)
      },
      updatedAt: new Date().toISOString()
    }

    // Salvar configurações no banco de dados
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        notificationSettings: JSON.stringify(updatedSettings)
      }
    })

    return NextResponse.json({
      settings: updatedSettings,
      message: 'Configurações salvas com sucesso'
    })
  } catch (error) {
    console.error('Erro ao salvar configurações:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
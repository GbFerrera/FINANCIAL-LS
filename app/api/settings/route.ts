import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Schema de validação para configurações
const settingsSchema = z.object({
  profile: z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    timezone: z.string(),
    language: z.string()
  }).optional(),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    reports: z.boolean(),
    projects: z.boolean(),
    financial: z.boolean()
  }).optional(),
  security: z.object({
    twoFactor: z.boolean(),
    sessionTimeout: z.number(),
    passwordExpiry: z.number()
  }).optional(),
  appearance: z.object({
    theme: z.enum(['light', 'dark']),
    sidebarCollapsed: z.boolean(),
    density: z.enum(['compact', 'comfortable', 'spacious'])
  }).optional(),
  system: z.object({
    autoBackup: z.boolean(),
    backupFrequency: z.enum(['daily', 'weekly', 'monthly']),
    dataRetention: z.number(),
    apiAccess: z.boolean()
  }).optional()
})

// GET - Buscar configurações do usuário
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar usuário com configurações
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Configurações padrão (em uma implementação real, você salvaria no banco)
    const settings = {
      profile: {
        name: user.name || '',
        email: user.email || '',
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR'
      },
      notifications: {
        email: true,
        push: true,
        reports: true,
        projects: true,
        financial: true
      },
      security: {
        twoFactor: false,
        sessionTimeout: 30,
        passwordExpiry: 90
      },
      appearance: {
        theme: 'light',
        sidebarCollapsed: false,
        density: 'comfortable'
      },
      system: {
        autoBackup: true,
        backupFrequency: 'daily',
        dataRetention: 365,
        apiAccess: false
      }
    }

    // Informações do sistema
    const systemInfo = {
      version: '1.0.0',
      lastBackup: new Date().toISOString(),
      storageUsed: '2.5 GB',
      storageTotal: '10 GB',
      activeUsers: await prisma.user.count({ where: { role: { not: 'CLIENT' } } }),
      uptime: '15 dias'
    }

    return NextResponse.json({
      settings,
      systemInfo
    })
  } catch (error) {
    console.error('Erro ao buscar configurações:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar configurações do usuário
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = settingsSchema.parse(body)

    // Atualizar perfil do usuário se fornecido
    if (validatedData.profile) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          name: validatedData.profile.name
        }
      })
    }

    // Em uma implementação real, você salvaria as outras configurações em uma tabela separada
    // Por enquanto, apenas retornamos sucesso

    return NextResponse.json({ message: 'Configurações atualizadas com sucesso' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Erro ao atualizar configurações:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
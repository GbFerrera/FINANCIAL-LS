import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { FinancialType, RecurringType, Prisma } from '@prisma/client'
import { startOfDay, endOfDay, format } from 'date-fns'

// Schema de validação para distribuição de projetos
const projectDistributionSchema = z.object({
  projectId: z.string().min(1, 'ID do projeto é obrigatório'),
  projectName: z.string().min(1, 'Nome do projeto é obrigatório'),
  amount: z.number().positive('Valor deve ser positivo')
})

// Schema de validação para entrada financeira
const financialEntrySchema = z.object({
  type: z.nativeEnum(FinancialType),
  category: z.string().min(1, 'Categoria é obrigatória'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  amount: z.number().positive('Valor deve ser positivo'),
  date: z.string().datetime('Data inválida'),
  isRecurring: z.boolean().default(false),
  recurringType: z.string().nullable().optional().transform(val => {
    if (!val || val === '') return null;
    return val as RecurringType;
  }).refine(val => val === null || Object.values(RecurringType).includes(val as RecurringType), {
    message: "Tipo de recorrência inválido"
  }),
  projectId: z.string().nullable().optional(),
  collaboratorId: z.string().nullable().optional(),
  periodStart: z.string().datetime('Data inicial inválida').nullable().optional(),
  periodEnd: z.string().datetime('Data final inválida').nullable().optional(),
  projectDistributions: z.array(projectDistributionSchema).nullable().optional(),
  attachments: z.array(z.object({
    originalName: z.string(),
    mimeType: z.string(),
    size: z.number(),
    url: z.string(),
    filename: z.string().optional()
  })).optional(),
}).transform((data) => ({
  ...data,
  recurringType: data.recurringType || undefined,
  projectId: data.projectId || undefined,
  collaboratorId: data.collaboratorId || undefined,
  periodStart: data.periodStart || undefined,
  periodEnd: data.periodEnd || undefined,
  projectDistributions: data.projectDistributions || undefined,
  attachments: data.attachments || undefined,
}))

// GET - Listar entradas financeiras
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const type = searchParams.get('type') as FinancialType | null
    const projectId = searchParams.get('projectId')
    const clientId = searchParams.get('clientId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const isRecurring = searchParams.get('isRecurring')
    const search = searchParams.get('search')
    const days = searchParams.get('days')

    const skip = (page - 1) * limit

    // Construir filtros
    const where: Prisma.FinancialEntryWhereInput = {}

    if (type) {
      where.type = type
    }

    if (projectId) {
      where.projectId = projectId
    }

    if (clientId) {
      where.project = {
        clientId: clientId
      }
    }

    const parseLocalDate = (s: string) => {
      const [y, m, d] = s.split('-').map(Number)
      return new Date(y, (m || 1) - 1, d || 1)
    }

    // Filtro por período
    if (days && days !== 'all') {
      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - parseInt(days))
      where.date = {
        gte: daysAgo
      }
    } else if (startDate || endDate) {
      where.date = {}
      if (startDate) {
        const sd = parseLocalDate(startDate)
        where.date.gte = startOfDay(sd)
      }
      if (endDate) {
        const ed = parseLocalDate(endDate)
        where.date.lte = endOfDay(ed)
      }
    }

    if (isRecurring !== null) {
      where.isRecurring = isRecurring === 'true'
    }

    if (search) {
      where.description = {
        contains: search,
        mode: 'insensitive'
      }
    }

    // Buscar entradas financeiras
    const [entries, total] = await Promise.all([
      prisma.financialEntry.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              client: {
                select: {
                  name: true,
                }
              }
            }
          },
          collaborator: {
            select: {
              id: true,
              name: true,
            }
          },
          payment: {
            select: {
              id: true,
              paymentProjects: {
                include: {
                  project: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              }
            }
          },
          attachments: true
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.financialEntry.count({ where })
    ])

    // Transformar entradas para o frontend
    const transformedEntries = entries.map(entry => ({
      id: entry.id,
      type: entry.type,
      category: entry.category,
      description: entry.description,
      amount: entry.amount,
      date: entry.date.toISOString().slice(0, 10),
      isRecurring: entry.isRecurring,
      recurringType: entry.recurringType,
      projectName: entry.project?.name,
      clientName: entry.project?.client?.name,
      paymentId: entry.paymentId,
      collaboratorName: entry.collaborator?.name || null,
      projectDistributions: entry.payment?.paymentProjects?.map((pp) => ({
        projectId: pp.project.id,
        projectName: pp.project.name,
        amount: pp.amount
      })) || [],
      createdAt: entry.createdAt.toISOString(),
      attachments: (entry.attachments || []).map(a => ({
        id: a.id,
        filename: a.filename,
        originalName: a.originalName,
        size: a.size,
        url: a.url
      }))
    }))

    // Calcular estatísticas usando os mesmos filtros aplicados às entradas
    const allEntries = await prisma.financialEntry.findMany({
      where,
      select: {
        type: true,
        amount: true,
        date: true
      }
    })

    const totalIncome = allEntries
      .filter(entry => entry.type === 'INCOME')
      .reduce((sum, entry) => sum + entry.amount, 0)
    
    const totalExpenses = allEntries
      .filter(entry => entry.type === 'EXPENSE')
      .reduce((sum, entry) => sum + entry.amount, 0)
    
    const netProfit = totalIncome - totalExpenses

    // Calcular estatísticas mensais (últimos 30 dias)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const monthlyEntries = allEntries.filter(entry => 
      new Date(entry.date) >= thirtyDaysAgo
    )
    
    const monthlyIncome = monthlyEntries
      .filter(entry => entry.type === 'INCOME')
      .reduce((sum, entry) => sum + entry.amount, 0)
    
    const monthlyExpenses = monthlyEntries
      .filter(entry => entry.type === 'EXPENSE')
      .reduce((sum, entry) => sum + entry.amount, 0)
    
    const monthlyProfit = monthlyIncome - monthlyExpenses

    return NextResponse.json({
      entries: transformedEntries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats: {
        totalIncome,
        totalExpenses,
        netProfit,
        monthlyIncome,
        monthlyExpenses,
        monthlyProfit
      }
    })
  } catch (error) {
    console.error('Erro ao buscar entradas financeiras:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// POST - Criar nova entrada financeira
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    console.log('💰 Dados recebidos na API financeira:', JSON.stringify(body, null, 2))
    
    let validatedData
    try {
      validatedData = financialEntrySchema.parse(body)
      console.log('✅ Dados validados:', JSON.stringify(validatedData, null, 2))
    } catch (zodError) {
      console.log('❌ Erro de validação Zod:', zodError)
      if (zodError instanceof z.ZodError) {
        console.log('📋 Detalhes dos erros:', JSON.stringify(zodError.issues, null, 2))
        return NextResponse.json(
          { 
            error: 'Dados inválidos', 
            details: zodError.issues.map((err: z.ZodIssue) => ({
              field: err.path.join('.'),
              message: err.message,
              received: err.received
            }))
          },
          { status: 400 }
        )
      }
      throw zodError
    }

    // Verificar se o projeto existe (se fornecido)
    if (validatedData.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: validatedData.projectId }
      })

      if (!project) {
        return NextResponse.json(
          { error: 'Projeto não encontrado' },
          { status: 404 }
        )
      }
    }

    // Validar distribuição de projetos se fornecida
    if (validatedData.projectDistributions && validatedData.projectDistributions.length > 0) {
      // Verificar se todos os projetos existem
      const projectIds = validatedData.projectDistributions.map(d => d.projectId)
      const projects = await prisma.project.findMany({
        where: { id: { in: projectIds } }
      })

      if (projects.length !== projectIds.length) {
        return NextResponse.json(
          { error: 'Um ou mais projetos não foram encontrados' },
          { status: 404 }
        )
      }

      // Verificar se a soma das distribuições é igual ao valor total
      const totalDistributed = validatedData.projectDistributions.reduce((sum, dist) => sum + dist.amount, 0)
      if (Math.abs(totalDistributed - validatedData.amount) > 0.01) {
        return NextResponse.json(
          { error: `A soma das distribuições (${totalDistributed}) deve ser igual ao valor total (${validatedData.amount})` },
          { status: 400 }
        )
      }

      // Não deve ter projectId se tem distribuições
      if (validatedData.projectId) {
        return NextResponse.json(
          { error: 'Não é possível ter projeto único e distribuição de projetos ao mesmo tempo' },
          { status: 400 }
        )
      }
    }

    // Validar recurringType se isRecurring for true
    if (validatedData.isRecurring && !validatedData.recurringType) {
      return NextResponse.json(
        { error: 'Tipo de recorrência é obrigatório para entradas recorrentes' },
        { status: 400 }
      )
    }

    // Validar data não pode ser muito futura
    const entryDate = new Date(validatedData.date)
    const oneYearFromNow = new Date()
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
    
    if (entryDate > oneYearFromNow) {
      return NextResponse.json(
        { error: 'Data não pode ser superior a um ano no futuro' },
        { status: 400 }
      )
    }

    let entry
    let payment = null
    let amountToCreate = validatedData.amount

    // Se for salário com colaborador e período, calcular valor (salário fixo proporcional + comissão por hora)
    if (
      validatedData.category.toLowerCase() === 'salários' &&
      validatedData.collaboratorId &&
      validatedData.periodStart &&
      validatedData.periodEnd
    ) {
      const from = new Date(validatedData.periodStart)
      const to = new Date(validatedData.periodEnd)
      from.setHours(0,0,0,0)
      to.setHours(23,59,59,999)

      const profileRows = await prisma.$queryRaw`
        SELECT 
          "userId",
          "hasFixedSalary",
          "fixedSalary",
          "hourRate"
        FROM compensation_profiles
        WHERE "userId" = ${validatedData.collaboratorId}
        LIMIT 1
      ` as Array<{ userId: string; hasFixedSalary: boolean; fixedSalary: number | null; hourRate: number }>
      const profile = profileRows[0] || { userId: validatedData.collaboratorId, hasFixedSalary: false, fixedSalary: null, hourRate: 0 }

      const tasks = await prisma.task.findMany({
        where: {
          assigneeId: validatedData.collaboratorId,
          status: 'COMPLETED',
          OR: [
            { completedAt: { gte: from, lte: to } },
            { endTime: { gte: from, lte: to } },
            { updatedAt: { gte: from, lte: to } },
            { startDate: { gte: from, lte: to } }
          ]
        },
        select: { estimatedMinutes: true }
      })

      const totalMinutes = tasks.reduce((sum, t) => {
        const m = (t.estimatedMinutes ?? 0)
        return sum + m
      }, 0)
      const variablePay = (totalMinutes / 60) * (profile?.hourRate || 0)

      let fixedComponent = 0
      if (profile?.hasFixedSalary && profile.fixedSalary) {
        const endMonth = new Date(from.getFullYear(), from.getMonth() + 1, 0)
        const daysInMonth = endMonth.getDate()
        const oneDayMs = 24 * 60 * 60 * 1000
        const daysInRange = Math.floor((to.getTime() - from.getTime()) / oneDayMs) + 1
        const ratio = Math.max(0, Math.min(1, daysInRange / daysInMonth))
        fixedComponent = profile.fixedSalary * ratio
      }

      amountToCreate = Number((fixedComponent + variablePay).toFixed(2))
    }

    // Se há distribuição de projetos, criar um Payment e suas distribuições
    if (validatedData.projectDistributions && validatedData.projectDistributions.length > 0) {
      // Buscar o primeiro projeto para obter o cliente (assumindo que todos os projetos são do mesmo cliente)
      const firstProject = await prisma.project.findUnique({
        where: { id: validatedData.projectDistributions[0].projectId },
        include: { client: true }
      })

      if (!firstProject) {
        return NextResponse.json(
          { error: 'Projeto não encontrado' },
          { status: 404 }
        )
      }

      // Criar o Payment
      payment = await prisma.payment.create({
        data: {
          amount: amountToCreate,
          description: validatedData.description,
          paymentDate: entryDate,
          method: 'BANK_TRANSFER', // Valor padrão, pode ser ajustado conforme necessário
          status: 'COMPLETED',
          clientId: firstProject.clientId,
          paymentProjects: {
            create: validatedData.projectDistributions.map(dist => ({
              projectId: dist.projectId,
              amount: dist.amount
            }))
          }
        },
        include: {
          client: true,
          paymentProjects: {
            include: {
              project: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      })

      // Criar a entrada financeira sem projeto específico (já que está distribuída)
      entry = await prisma.financialEntry.create({
        data: {
          type: validatedData.type,
          category: validatedData.category,
          description: validatedData.description,
          amount: amountToCreate,
          date: entryDate,
          isRecurring: validatedData.isRecurring,
          recurringType: validatedData.recurringType,
          projectId: null, // Não vincula a um projeto específico
          paymentId: payment.id, // Vincula com o pagamento distribuído
          collaboratorId: validatedData.collaboratorId || undefined,
          periodStart: validatedData.periodStart ? new Date(validatedData.periodStart) : undefined,
          periodEnd: validatedData.periodEnd ? new Date(validatedData.periodEnd) : undefined
        }
      })
    } else {
      // Lógica original para entrada sem distribuição
      entry = await prisma.financialEntry.create({
        data: {
          type: validatedData.type,
          category: validatedData.category,
          description: validatedData.description,
          amount: amountToCreate,
          date: entryDate,
          isRecurring: validatedData.isRecurring,
          recurringType: validatedData.recurringType,
          projectId: validatedData.projectId,
          collaboratorId: validatedData.collaboratorId || undefined,
          periodStart: validatedData.periodStart ? new Date(validatedData.periodStart) : undefined,
          periodEnd: validatedData.periodEnd ? new Date(validatedData.periodEnd) : undefined
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              client: {
                select: {
                  name: true,
                }
              }
            }
          }
        }
      })
    }

    if (validatedData.attachments && validatedData.attachments.length > 0) {
      await prisma.financialAttachment.createMany({
        data: validatedData.attachments.map(a => ({
          filename: a.filename || a.originalName,
          originalName: a.originalName,
          mimeType: a.mimeType,
          size: Math.round(a.size),
          url: a.url,
          financialEntryId: entry.id
        }))
      })
    }

    const entryAttachments = await prisma.financialAttachment.findMany({
      where: { financialEntryId: entry.id }
    })

    const entryWithRelations = await prisma.financialEntry.findUnique({
      where: { id: entry.id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            client: {
              select: { name: true }
            }
          }
        },
      }
    })

    // Transformar para o frontend
    const transformedEntry = {
      id: entry.id,
      type: entry.type,
      category: entry.category,
      description: entry.description,
      amount: entry.amount,
      date: entry.date.toISOString().slice(0, 10),
      isRecurring: entry.isRecurring,
      recurringType: entry.recurringType,
      projectName: entryWithRelations?.project?.name || null,
      clientName: entryWithRelations?.project?.client?.name || (payment?.client?.name) || null,
      createdAt: entry.createdAt.toISOString(),
      projectDistributions: payment ? payment.paymentProjects.map(pp => ({
        projectId: pp.projectId,
        projectName: pp.project.name,
        amount: pp.amount
      })) : (validatedData.projectDistributions || null),
      paymentId: payment?.id || null,
      attachments: entryAttachments.map(a => ({
        id: a.id,
        filename: a.filename,
        originalName: a.originalName,
        size: a.size,
        url: a.url
      }))
    }

    return NextResponse.json(transformedEntry, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Erro ao criar entrada financeira:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { FinancialType, RecurringType } from '@prisma/client'

// Schema de validação para entrada financeira
const financialEntrySchema = z.object({
  type: z.nativeEnum(FinancialType),
  category: z.string().min(1, 'Categoria é obrigatória'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  amount: z.number().positive('Valor deve ser positivo'),
  date: z.string().datetime('Data inválida'),
  isRecurring: z.boolean().default(false),
  recurringType: z.nativeEnum(RecurringType).nullable().optional(),
  projectId: z.string().nullable().optional(),
}).transform((data) => ({
  ...data,
  recurringType: data.recurringType || undefined,
  projectId: data.projectId || undefined,
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
    const where: any = {}

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
        where.date.gte = new Date(startDate)
      }
      if (endDate) {
        where.date.lte = new Date(endDate)
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
          }
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
      date: entry.date.toISOString(),
      isRecurring: entry.isRecurring,
      recurringType: entry.recurringType,
      projectName: entry.project?.name,
      clientName: entry.project?.client?.name,
      createdAt: entry.createdAt.toISOString()
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
            details: zodError.issues.map((err: any) => ({
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

    const entry = await prisma.financialEntry.create({
      data: {
        type: validatedData.type,
        category: validatedData.category,
        description: validatedData.description,
        amount: validatedData.amount,
        date: entryDate,
        isRecurring: validatedData.isRecurring,
        recurringType: validatedData.recurringType,
        projectId: validatedData.projectId,
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

    // Transformar para o frontend
    const transformedEntry = {
      id: entry.id,
      type: entry.type,
      category: entry.category,
      description: entry.description,
      amount: entry.amount,
      date: entry.date.toISOString(),
      isRecurring: entry.isRecurring,
      recurringType: entry.recurringType,
      projectName: entry.project?.name,
      clientName: entry.project?.client?.name,
      createdAt: entry.createdAt.toISOString()
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
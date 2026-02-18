import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { FinancialType } from '@prisma/client'

export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  try {
    const client = await prisma.client.findUnique({
      where: { accessToken: token },
      select: { id: true, name: true }
    })

    if (!client) {
      return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const typeParam = searchParams.get('type') as FinancialType | null
    const projectIdParam = searchParams.get('projectId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')
    const days = searchParams.get('days')

    const skip = (page - 1) * limit

    // Projetos do cliente
    const clientProjectIds = (
      await prisma.project.findMany({
        where: {
          OR: [
            { clientId: client.id },
            { clients: { some: { clientId: client.id } } }
          ]
        },
        select: { id: true }
      })
    ).map(p => p.id)

    // Filtro base: entradas vinculadas aos projetos do cliente
    const where: any = {
      OR: [
        { projectId: { in: clientProjectIds } },
        {
          payment: {
            paymentProjects: {
              some: { projectId: { in: clientProjectIds } }
            }
          }
        }
      ]
    }

    if (typeParam) where.type = typeParam
    if (projectIdParam) where.projectId = projectIdParam

    // Período
    if (days && days !== 'all') {
      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - parseInt(days))
      where.date = { gte: daysAgo }
    } else if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) where.date.lte = new Date(endDate)
    }

    if (search) {
      where.description = { contains: search, mode: 'insensitive' }
    }

    const [entries, total] = await Promise.all([
      prisma.financialEntry.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              client: { select: { name: true } }
            }
          },
          payment: {
            select: {
              id: true,
              paymentProjects: {
                include: { project: { select: { id: true, name: true } } }
              }
            }
          }
          ,
          attachments: true
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.financialEntry.count({ where })
    ])

    const transformedEntries = entries.map(entry => ({
      id: entry.id,
      type: entry.type,
      category: entry.category,
      description: entry.description,
      amount: entry.amount,
      date: entry.date.toISOString(),
      isRecurring: entry.isRecurring,
      recurringType: entry.recurringType,
      projectName: entry.project?.name || null,
      clientName: entry.project?.client?.name || null,
      paymentId: entry.paymentId,
      projectDistributions: entry.payment?.paymentProjects?.map(pp => ({
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
      })),
    }))

    // Stats calculadas como no financeiro ADM
    const allEntries = await prisma.financialEntry.findMany({
      where,
      select: { type: true, amount: true, date: true }
    })

    const totalIncome = allEntries.filter(e => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0)
    const totalExpenses = allEntries.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0)
    const netProfit = totalIncome - totalExpenses

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const monthlyEntries = allEntries.filter(e => new Date(e.date) >= thirtyDaysAgo)
    const monthlyIncome = monthlyEntries.filter(e => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0)
    const monthlyExpenses = monthlyEntries.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0)
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
    console.error('[client-portal financial] error', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

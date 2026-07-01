import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { endOfDay, startOfDay } from 'date-fns'
import { PaymentMethod, PaymentStatus } from '@prisma/client'

// GET - Listar pagamentos
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const parseLocalDate = (s: string) => {
      const [y, m, d] = s.split('-').map(Number)
      return new Date(y, (m || 1) - 1, d || 1)
    }

    const whereClause: any = {}
    if (clientId) whereClause.clientId = clientId
    if (status) whereClause.status = status
    if (startDate || endDate) {
      whereClause.paymentDate = {}
      if (startDate) whereClause.paymentDate.gte = startOfDay(parseLocalDate(startDate))
      if (endDate) whereClause.paymentDate.lte = endOfDay(parseLocalDate(endDate))
    }

    const payments = await prisma.payment.findMany({
      where: whereClause,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
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
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    })

    const total = await prisma.payment.count({
      where: whereClause
    })

    return NextResponse.json({
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Erro ao buscar pagamentos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// POST - Criar novo pagamento
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { clientId, amount, description, paymentDate, method, status } = body

    // Validações
    if (!clientId || !amount || !paymentDate) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: clientId, amount, paymentDate' },
        { status: 400 }
      )
    }

    // Verificar se o cliente existe
    const client = await prisma.client.findUnique({
      where: { id: clientId }
    })

    if (!client) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    const desiredStatus =
      status && typeof status === 'string' && Object.values(PaymentStatus).includes(status as PaymentStatus)
        ? (status as PaymentStatus)
        : PaymentStatus.COMPLETED

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          clientId,
          amount: parseFloat(amount),
          description,
          paymentDate: new Date(paymentDate),
          method: method || 'BANK_TRANSFER',
          status: desiredStatus
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
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

      if (desiredStatus === PaymentStatus.COMPLETED) {
        await tx.financialEntry.create({
          data: {
            type: 'INCOME',
            category: 'Pagamento de Cliente',
            description: description || `Pagamento recebido de ${client.name}`,
            amount: parseFloat(amount),
            date: new Date(paymentDate),
            isRecurring: false,
            paymentId: created.id
          }
        })
      }

      return created
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar pagamento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const paymentId = body?.paymentId as string | undefined
    const markAsReceived = body?.markAsReceived === true
    const update = body?.update as
      | {
          clientId?: string
          amount?: string | number
          description?: string | null
          paymentDate?: string
          method?: string
        }
      | undefined

    if (!paymentId) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

    if (markAsReceived) {
      const result = await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          include: { client: true }
        })
        if (!payment) return null

        const updated = await tx.payment.update({
          where: { id: paymentId },
          data: { status: PaymentStatus.COMPLETED }
        })

        const existing = await tx.financialEntry.findFirst({
          where: { paymentId }
        })
        if (!existing) {
          await tx.financialEntry.create({
            data: {
              type: 'INCOME',
              category: 'Pagamento de Cliente',
              description: payment.description || `Pagamento recebido de ${payment.client.name}`,
              amount: payment.amount,
              date: payment.paymentDate,
              isRecurring: false,
              paymentId: payment.id
            }
          })
        }

        return updated
      })

      if (!result) return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 })
      return NextResponse.json(result)
    }

    if (!update) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    if (!update.clientId || update.amount === undefined || update.amount === null || !update.paymentDate) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: clientId, amount, paymentDate' },
        { status: 400 }
      )
    }

    const amountNumber = typeof update.amount === 'number' ? update.amount : parseFloat(String(update.amount))
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    }

    const parsedDate = new Date(update.paymentDate)
    if (!Number.isFinite(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Data inválida' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { client: true }
      })
      if (!payment) return null

      const client = await tx.client.findUnique({ where: { id: update.clientId! } })
      if (!client) return { error: 'Cliente não encontrado' as const }

      const nextMethod =
        update.method &&
        typeof update.method === 'string' &&
        Object.values(PaymentMethod).includes(update.method as PaymentMethod)
          ? (update.method as PaymentMethod)
          : payment.method

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          clientId: update.clientId,
          amount: amountNumber,
          description: update.description ?? null,
          paymentDate: parsedDate,
          method: nextMethod
        }
      })

      const entry = await tx.financialEntry.findFirst({ where: { paymentId } })
      if (entry) {
        await tx.financialEntry.update({
          where: { id: entry.id },
          data: {
            amount: updated.amount,
            date: updated.paymentDate,
            description: updated.description || entry.description
          }
        })
      } else if (String(updated.status || '').toUpperCase() === 'COMPLETED') {
        await tx.financialEntry.create({
          data: {
            type: 'INCOME',
            category: 'Pagamento de Cliente',
            description: updated.description || `Pagamento recebido de ${client.name}`,
            amount: updated.amount,
            date: updated.paymentDate,
            isRecurring: false,
            paymentId: updated.id
          }
        })
      }

      return updated
    })

    if (!result) return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 })
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: 404 })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao atualizar pagamento:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const paymentId = body?.paymentId as string | undefined
    if (!paymentId) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

    await prisma.$transaction(async (tx) => {
      await tx.financialEntry.deleteMany({ where: { paymentId } })
      await tx.paymentProject.deleteMany({ where: { paymentId } })
      await tx.payment.delete({ where: { id: paymentId } })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao excluir pagamento:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

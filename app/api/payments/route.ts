import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET - Listar pagamentos
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const whereClause = clientId ? { clientId } : {}

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
    const { clientId, amount, description, paymentDate, method } = body

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

    // Usar transação para garantir consistência entre pagamento e entrada financeira
    const result = await prisma.$transaction(async (tx) => {
      // Criar o pagamento
      const payment = await tx.payment.create({
        data: {
          clientId,
          amount: parseFloat(amount),
          description,
          paymentDate: new Date(paymentDate),
          method: method || 'BANK_TRANSFER',
          status: 'COMPLETED'
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })

      // Criar entrada financeira automaticamente para o pagamento
      const financialEntry = await tx.financialEntry.create({
        data: {
          type: 'INCOME',
          category: 'Pagamento de Cliente',
          description: description || `Pagamento recebido de ${client.name}`,
          amount: parseFloat(amount),
          date: new Date(paymentDate),
          isRecurring: false,
          paymentId: payment.id // Vincular entrada financeira ao pagamento
        }
      })

      return { payment, financialEntry }
    })

    return NextResponse.json(result.payment, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar pagamento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
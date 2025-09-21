import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    // Find client by access token
    const client = await prisma.client.findUnique({
      where: { accessToken: params.token },
      select: {
        id: true,
        name: true
      }
    })

    if (!client) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { amount, description, date, projectId } = body

    if (!amount || !description) {
      return NextResponse.json(
        { error: 'Dados obrigatórios não fornecidos' },
        { status: 400 }
      )
    }

    // If projectId is provided, verify it belongs to this client
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          clientId: client.id
        }
      })

      if (!project) {
        return NextResponse.json(
          { error: 'Projeto não encontrado ou acesso negado' },
          { status: 404 }
        )
      }
    }

    // Create the payment
    const payment = await prisma.payment.create({
      data: {
        amount: parseFloat(amount),
        description: description.trim(),
        paymentDate: date ? new Date(date) : new Date(),
        clientId: client.id
      }
    })

    // If projectId is provided, create payment-project relationship
    if (projectId) {
      await prisma.paymentProject.create({
        data: {
          paymentId: payment.id,
          projectId: projectId,
          amount: parseFloat(amount)
        }
      })
    }

    // Create corresponding financial entry
    const financialEntry = await prisma.financialEntry.create({
      data: {
        type: 'INCOME',
        category: 'Projeto',
        description: description.trim(),
        amount: parseFloat(amount),
        date: date ? new Date(date) : new Date(),
        projectId: projectId || null,
        paymentId: payment.id // Vincula com o pagamento
      }
    })

    return NextResponse.json({
      message: 'Pagamento registrado com sucesso',
      payment: {
        id: payment.id,
        amount: payment.amount,
        description: payment.description,
        date: payment.paymentDate.toISOString(),
        createdAt: payment.createdAt.toISOString()
      },
      financialEntry: {
        id: financialEntry.id,
        type: financialEntry.type,
        category: financialEntry.category,
        amount: financialEntry.amount,
        description: financialEntry.description,
        date: financialEntry.date.toISOString()
      }
    })
  } catch (error) {
    console.error('Erro ao registrar pagamento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    // Find client by access token
    const client = await prisma.client.findUnique({
      where: { accessToken: params.token },
      select: {
        id: true,
        name: true
      }
    })

    if (!client) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 404 }
      )
    }

    // Get client's payments
    const payments = await prisma.payment.findMany({
      where: { clientId: client.id },
      include: {
        paymentProjects: {
          include: {
            project: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        paymentDate: 'desc'
      }
    })

    return NextResponse.json({
      payments: payments.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        description: payment.description,
        date: payment.paymentDate.toISOString(),
        createdAt: payment.createdAt.toISOString(),
        method: payment.method,
        status: payment.status,
        projectDistributions: payment.paymentProjects.map(pp => ({
          projectId: pp.projectId,
          projectName: pp.project.name,
          amount: pp.amount
        })),
        // Manter compatibilidade com código existente
        projectName: payment.paymentProjects[0]?.project?.name || null
      }))
    })
  } catch (error) {
    console.error('Erro ao buscar pagamentos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
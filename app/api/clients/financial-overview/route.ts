import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Buscar todos os clientes com seus projetos e dados financeiros
    const clients = await prisma.client.findMany({
      include: {
        projects: {
          include: {
            financials: {
              orderBy: {
                date: 'desc'
              }
            }
          }
        },
        payments: {
          orderBy: {
            paymentDate: 'desc'
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Transformar os dados para o formato esperado pelo componente
    const clientsFinancialData = clients.map((client) => ({
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      company: client.company,
      totalProjects: client.projects.length,
      totalValue: client.projects.reduce((sum: number, project) => sum + (project.budget || 0), 0),
      projects: client.projects.map((project) => ({
        id: project.id,
        name: project.name,
        budget: project.budget || 0,
        status: project.status,
        financialEntries: project.financials.map((entry) => ({
          id: entry.id,
          type: entry.type,
          amount: entry.amount,
          description: entry.description || '',
          category: entry.category,
          date: entry.date.toISOString()
        }))
      })),
      payments: client.payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        description: payment.description,
        paymentDate: payment.paymentDate.toISOString(),
        method: payment.method,
        status: payment.status
      }))
    }))

    return NextResponse.json({
      clients: clientsFinancialData,
      total: clientsFinancialData.length
    })

  } catch (error) {
    console.error('Erro ao buscar dados financeiros dos clientes:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
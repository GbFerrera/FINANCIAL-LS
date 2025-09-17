import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST - Distribuir pagamento entre projetos
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const paymentId = params.id
    const body = await request.json()
    const { distributions } = body // Array de { projectId, amount }

    // Validações
    if (!distributions || !Array.isArray(distributions) || distributions.length === 0) {
      return NextResponse.json(
        { error: 'Distribuições são obrigatórias' },
        { status: 400 }
      )
    }

    // Verificar se o pagamento existe
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        paymentProjects: true
      }
    })

    if (!payment) {
      return NextResponse.json(
        { error: 'Pagamento não encontrado' },
        { status: 404 }
      )
    }

    // Calcular total distribuído
    const totalDistributed = distributions.reduce((sum, dist) => sum + parseFloat(dist.amount), 0)
    const currentlyDistributed = payment.paymentProjects.reduce((sum, pp) => sum + pp.amount, 0)
    const availableAmount = payment.amount - currentlyDistributed

    if (totalDistributed > availableAmount) {
      return NextResponse.json(
        { 
          error: `Valor total (${totalDistributed}) excede o disponível (${availableAmount})`,
          availableAmount,
          totalDistributed
        },
        { status: 400 }
      )
    }

    // Verificar se todos os projetos existem e pertencem ao mesmo cliente
    const projectIds = distributions.map(d => d.projectId)
    const projects = await prisma.project.findMany({
      where: {
        id: { in: projectIds },
        clientId: payment.clientId
      }
    })

    if (projects.length !== projectIds.length) {
      return NextResponse.json(
        { error: 'Um ou mais projetos não encontrados ou não pertencem ao cliente' },
        { status: 400 }
      )
    }

    // Criar as distribuições
    const paymentProjects = await Promise.all(
      distributions.map(async (dist) => {
        // Verificar se já existe distribuição para este projeto
        const existing = await prisma.paymentProject.findUnique({
          where: {
            paymentId_projectId: {
              paymentId,
              projectId: dist.projectId
            }
          }
        })

        if (existing) {
          // Atualizar valor existente
          return prisma.paymentProject.update({
            where: {
              paymentId_projectId: {
                paymentId,
                projectId: dist.projectId
              }
            },
            data: {
              amount: existing.amount + parseFloat(dist.amount)
            },
            include: {
              project: {
                select: {
                  id: true,
                  name: true,
                  budget: true
                }
              }
            }
          })
        } else {
          // Criar nova distribuição
          return prisma.paymentProject.create({
            data: {
              paymentId,
              projectId: dist.projectId,
              amount: parseFloat(dist.amount)
            },
            include: {
              project: {
                select: {
                  id: true,
                  name: true,
                  budget: true
                }
              }
            }
          })
        }
      })
    )

    // Buscar pagamento atualizado
    const updatedPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true
          }
        },
        paymentProjects: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                budget: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json({
      payment: updatedPayment,
      distributions: paymentProjects
    })
  } catch (error) {
    console.error('Erro ao distribuir pagamento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// GET - Obter distribuições de um pagamento
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const paymentId = params.id

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true
          }
        },
        paymentProjects: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                budget: true,
                status: true
              }
            }
          }
        }
      }
    })

    if (!payment) {
      return NextResponse.json(
        { error: 'Pagamento não encontrado' },
        { status: 404 }
      )
    }

    const totalDistributed = payment.paymentProjects.reduce((sum, pp) => sum + pp.amount, 0)
    const remainingAmount = payment.amount - totalDistributed

    return NextResponse.json({
      payment,
      totalDistributed,
      remainingAmount,
      distributions: payment.paymentProjects
    })
  } catch (error) {
    console.error('Erro ao buscar distribuições:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
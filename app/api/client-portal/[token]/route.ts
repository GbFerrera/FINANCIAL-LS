import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateBasicProjectProgress } from '@/lib/progress-utils'

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
        name: true,
        email: true,
        phone: true,
        company: true
      }
    })

    if (!client) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 404 }
      )
    }

    // Get client's projects with related data (primary or associated via ProjectClient)
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { clientId: client.id },
          { clients: { some: { clientId: client.id } } }
        ]
      },
      include: {
        client: {
          select: {
            id: true,
            name: true
          }
        },
        clients: {
          include: {
            client: {
              select: { id: true, name: true }
            }
          }
        },
        milestones: {
          select: {
            id: true,
            name: true,
            status: true,
            dueDate: true,
            completedAt: true
          },
          orderBy: {
            order: 'asc'
          }
        },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
            completedAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        files: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            size: true,
            url: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        comments: {
          where: {
            OR: [
              { type: 'CLIENT_VISIBLE' },
              { type: 'CLIENT_REQUEST' },
              { clientId: client.id }
            ]
          },
          include: {
            author: {
              select: {
                name: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Get all financial entries related to this client
    const clientProjectIds = projects.map(p => p.id)
    
    const allFinancialEntries = await prisma.financialEntry.findMany({
      where: {
        OR: [
          // Entradas vinculadas diretamente aos projetos do cliente
          {
            projectId: {
              in: clientProjectIds
            }
          },
          // Entradas com pagamentos que têm distribuições para projetos do cliente
          {
            payment: {
              paymentProjects: {
                some: {
                  projectId: {
                    in: clientProjectIds
                  }
                }
              }
            }
          }
        ]
      },
      include: {
        project: {
          select: {
            id: true,
            name: true
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
        }
      },
      orderBy: {
        date: 'desc'
      }
    })

    // Transform projects data
    const transformedProjects = projects.map(project => {
      const completedMilestones = project.milestones.filter(m => m.completedAt).length
      const completedTasks = project.tasks.filter(t => t.status === 'COMPLETED').length
      
      // Calculate progress using the standardized utility function
      const progress = calculateBasicProjectProgress(
        project.milestones,
        project.tasks
      )

      const partners = (project.clients || [])
        .filter((pc: any) => pc.client && pc.client.id !== project.client.id)
        .map((pc: any) => pc.client.name)

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        startDate: project.startDate.toISOString(),
        endDate: project.endDate?.toISOString() || null,
        budget: project.budget || 0,
        progress,
        partners,
        milestones: project.milestones.map(milestone => ({
          id: milestone.id,
          title: milestone.name,
          status: milestone.status,
          dueDate: milestone.dueDate?.toISOString() || null,
          completedAt: milestone.completedAt?.toISOString() || null
        })),
        tasks: project.tasks.map(task => ({
          id: task.id,
          title: task.title,
          status: task.status,
          dueDate: task.dueDate?.toISOString() || null,
          completedAt: task.completedAt?.toISOString() || null
        })),
        files: project.files.map(file => ({
          id: file.id,
          filename: file.filename,
          originalName: file.originalName,
          size: file.size,
          url: file.url,
          createdAt: file.createdAt.toISOString()
        })),
        comments: project.comments.map(comment => ({
          id: comment.id,
          content: comment.content,
          type: comment.type,
          createdAt: comment.createdAt.toISOString(),
          authorName: comment.author?.name || null
        }))
      }
    })

    // Transform all financial entries for the client
    const transformedFinancialEntries = allFinancialEntries.map(financial => ({
      id: financial.id,
      type: financial.type,
      category: (financial as any).category ?? null,
      amount: financial.amount,
      description: financial.description,
      date: financial.date.toISOString(),
      isRecurring: (financial as any).isRecurring ?? false,
      recurringType: (financial as any).recurringType ?? null,
      createdAt: financial.createdAt.toISOString(),
      projectId: financial.project?.id || null,
      projectName: financial.project?.name || null,
      paymentId: financial.paymentId,
      projectDistributions: financial.payment?.paymentProjects?.map((pp: any) => ({
        projectId: pp.project.id,
        projectName: pp.project.name,
        amount: pp.amount
      })) || []
    }))

    // Get client's payments with project information
    const payments = await prisma.payment.findMany({
      where: {
        OR: [
          { clientId: client.id },
          { paymentProjects: { some: { projectId: { in: clientProjectIds } } } }
        ]
      },
      include: {
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
      },
      orderBy: {
        paymentDate: 'desc'
      }
    })

    // Mapear anexos a partir das entradas financeiras vinculadas a pagamentos
    const paymentIds = payments.map(p => p.id)
    const paymentEntries = await prisma.financialEntry.findMany({
      where: { paymentId: { in: paymentIds } },
      select: {
        paymentId: true,
        attachments: true
      }
    })
    const attachmentsByPaymentId = Object.fromEntries(
      paymentEntries.map(pe => [
        pe.paymentId,
        (pe.attachments || []).map(a => ({
          id: a.id,
          filename: a.filename,
          originalName: a.originalName,
          size: a.size,
          url: a.url
        }))
      ])
    )

    // Get financial entries that represent single-project payments (paymentId is null and projectId is not null)
    const singleProjectPayments = await prisma.financialEntry.findMany({
      where: {
        AND: [
          { paymentId: null },
          { projectId: { not: null } },
          { type: 'INCOME' },
          { projectId: { in: clientProjectIds } }
        ]
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            budget: true
          }
        },
        attachments: true
      },
      orderBy: {
        date: 'desc'
      }
    })

    // Transform payments data with project calculations
    const transformedPayments = payments.map(payment => {
      const projectPayments = payment.paymentProjects.map(pp => ({
        projectId: pp.project.id,
        projectName: pp.project.name,
        projectBudget: pp.project.budget || 0,
        amountPaid: pp.amount
      }))

      // Calculate total distributed amount for this payment
      const totalDistributed = payment.paymentProjects.reduce((sum, pp) => sum + pp.amount, 0)
      const remainingAmount = payment.amount - totalDistributed

      return {
        id: payment.id,
        amount: payment.amount,
        description: payment.description,
        paymentDate: payment.paymentDate.toISOString(),
        method: payment.method,
        status: payment.status,
        totalDistributed,
        remainingAmount,
        projectPayments,
        createdAt: payment.createdAt.toISOString(),
        isFromFinancialEntry: false,
        attachments: attachmentsByPaymentId[payment.id] || []
      }
    })

    // Transform single-project payments from financial entries
    const transformedSingleProjectPayments = singleProjectPayments.map(entry => {
      const projectPayments = [{
        projectId: entry.project!.id,
        projectName: entry.project!.name,
        projectBudget: entry.project!.budget || 0,
        amountPaid: entry.amount
      }]

      return {
        id: entry.id,
        amount: entry.amount,
        description: entry.description,
        paymentDate: entry.date.toISOString(),
        method: 'BANK_TRANSFER', // Valor padrão para entradas financeiras
        status: 'COMPLETED',
        totalDistributed: entry.amount,
        remainingAmount: 0,
        projectPayments,
        createdAt: entry.createdAt.toISOString(),
        isFromFinancialEntry: true,
        attachments: (entry.attachments || []).map(a => ({
          id: a.id,
          filename: a.filename,
          originalName: a.originalName,
          size: a.size,
          url: a.url
        }))
      }
    })

    // Combine both types of payments and sort by date
    const allPayments = [...transformedPayments, ...transformedSingleProjectPayments]
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())

    // Calculate project payment summaries
    const projectPaymentSummaries = transformedProjects.map(project => {
      const projectPayments = allPayments.flatMap(payment => 
        payment.projectPayments
          .filter(pp => pp.projectId === project.id)
          .map(pp => pp.amountPaid)
      )
      
      const totalPaid = projectPayments.reduce((sum, amount) => sum + amount, 0)
      const remainingBudget = (project.budget || 0) - totalPaid
      
      return {
        projectId: project.id,
        projectName: project.name,
        budget: project.budget || 0,
        totalPaid,
        remainingBudget,
        paymentPercentage: project.budget ? Math.round((totalPaid / project.budget) * 100) : 0
      }
    })

    return NextResponse.json({
      client,
      projects: transformedProjects,
      payments: allPayments,
      projectPaymentSummaries,
      financialEntries: transformedFinancialEntries
    })
  } catch (error) {
    console.error('Erro ao buscar dados do portal do cliente:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

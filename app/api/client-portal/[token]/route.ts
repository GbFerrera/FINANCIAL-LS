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

    // Get client's projects with related data
    const projects = await prisma.project.findMany({
      where: { clientId: client.id },
      include: {
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
        },
        financials: {
          select: {
            id: true,
            type: true,
            description: true,
            amount: true,
            date: true,
            createdAt: true,
            project: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            date: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
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

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        startDate: project.startDate.toISOString(),
        endDate: project.endDate?.toISOString() || null,
        budget: project.budget || 0,
        progress,
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
        })),
        financialEntries: project.financials.map(financial => ({
          id: financial.id,
          type: financial.type,
          amount: financial.amount,
          description: financial.description,
          date: financial.date.toISOString(),
          createdAt: financial.createdAt.toISOString(),
          projectId: financial.project?.id || null,
          projectName: financial.project?.name || null
        }))
      }
    })

    // Get client's payments with project information
    const payments = await prisma.payment.findMany({
      where: { clientId: client.id },
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
        createdAt: payment.createdAt.toISOString()
      }
    })

    // Calculate project payment summaries
    const projectPaymentSummaries = transformedProjects.map(project => {
      const projectPayments = payments.flatMap(payment => 
        payment.paymentProjects
          .filter(pp => pp.project.id === project.id)
          .map(pp => pp.amount)
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
      payments: transformedPayments,
      projectPaymentSummaries
    })
  } catch (error) {
    console.error('Erro ao buscar dados do portal do cliente:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
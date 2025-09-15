import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Get projects overview
    const projects = await prisma.project.findMany({
      include: {
        milestones: {
          select: {
            id: true,
            completedAt: true
          }
        },
        tasks: {
          select: {
            id: true,
            completedAt: true
          }
        },
        team: {
          select: {
            userId: true
          }
        },
        financials: {
          select: {
            amount: true,
            type: true
          }
        }
      }
    })

    // Calculate project statistics
    const projectsWithStats = projects.map(project => {
      const totalMilestones = project.milestones.length
      const completedMilestones = project.milestones.filter(m => m.completedAt !== null).length
      const totalTasks = project.tasks.length
      const completedTasks = project.tasks.filter(t => t.completedAt !== null).length
      
      const progress = totalTasks > 0 
        ? Math.round((completedTasks / totalTasks) * 100)
        : totalMilestones > 0 
        ? Math.round((completedMilestones / totalMilestones) * 100)
        : 0

      const spent = project.financials
        .filter(entry => entry.type === 'EXPENSE')
        .reduce((sum, entry) => sum + entry.amount, 0)

      return {
        id: project.id,
        name: project.name,
        status: project.status,
        budget: project.budget || 0,
        spent,
        startDate: project.startDate.toISOString(),
        endDate: project.endDate?.toISOString() || new Date().toISOString(),
        teamMembers: project.team.length,
        progress
      }
    })

    // Get financial data for the last 6 months
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const financialEntries = await prisma.financialEntry.findMany({
      where: {
        createdAt: {
          gte: sixMonthsAgo
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    // Group financial data by month
    const monthlyData = new Map()
    const months = []
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const monthLabel = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
      
      months.push(monthLabel)
      monthlyData.set(monthKey, { month: monthLabel, income: 0, expenses: 0, profit: 0 })
    }

    financialEntries.forEach(entry => {
      const entryDate = new Date(entry.createdAt)
      const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`
      
      if (monthlyData.has(monthKey)) {
        const monthData = monthlyData.get(monthKey)
        if (entry.type === 'INCOME') {
          monthData.income += entry.amount
        } else {
          monthData.expenses += entry.amount
        }
        monthData.profit = monthData.income - monthData.expenses
      }
    })

    const financialData = Array.from(monthlyData.values())

    // Get recent activities
    const recentComments = await prisma.comment.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        author: {
          select: {
            name: true
          }
        },
        project: {
          select: {
            name: true
          }
        }
      }
    })

    const recentTasks = await prisma.task.findMany({
      where: {
        completedAt: {
          not: null,
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      take: 5,
      orderBy: {
        updatedAt: 'desc'
      },
      include: {
        project: {
          select: {
            name: true
          }
        }
      }
    })

    const recentPayments = await prisma.financialEntry.findMany({
      where: {
        type: 'INCOME',
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      take: 3,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        project: {
          select: {
            name: true
          }
        }
      }
    })

    // Combine and format activities
    const activities = [
      ...recentComments.map(comment => ({
        id: `comment-${comment.id}`,
        type: 'comment_added' as const,
        title: 'Novo comentário adicionado',
        description: comment.content.substring(0, 100) + (comment.content.length > 100 ? '...' : ''),
        user: comment.author?.name || 'Usuário',
        timestamp: comment.createdAt.toISOString(),
        metadata: {
          projectName: comment.project.name
        }
      })),
      ...recentTasks.map(task => ({
        id: `task-${task.id}`,
        type: 'task_completed' as const,
        title: 'Tarefa concluída',
        description: task.title,
        user: 'Sistema',
        timestamp: task.updatedAt.toISOString(),
        metadata: {
          projectName: task.project.name,
          taskName: task.title
        }
      })),
      ...recentPayments.map(payment => ({
        id: `payment-${payment.id}`,
        type: 'payment_received' as const,
        title: 'Pagamento recebido',
        description: payment.description || 'Entrada financeira',
        user: 'Sistema',
        timestamp: payment.createdAt.toISOString(),
        metadata: {
          projectName: payment.project.name,
          amount: payment.amount
        }
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10)

    // Calculate dashboard stats
    const totalProjects = projects.length
    const activeProjects = projects.filter(p => p.status === 'ACTIVE').length
    const completedProjects = projects.filter(p => p.status === 'COMPLETED').length
    
    const totalRevenue = financialEntries
      .filter(entry => entry.type === 'INCOME')
      .reduce((sum, entry) => sum + entry.amount, 0)
    
    const totalExpenses = financialEntries
      .filter(entry => entry.type === 'EXPENSE')
      .reduce((sum, entry) => sum + entry.amount, 0)
    
    const totalProfit = totalRevenue - totalExpenses
    
    const totalTasks = await prisma.task.count()
    const completedTasks = await prisma.task.count({ where: { completedAt: { not: null } } })
    const pendingTasks = totalTasks - completedTasks

    const dashboardData = {
      stats: {
        totalProjects,
        activeProjects,
        completedProjects,
        totalRevenue,
        totalExpenses,
        totalProfit,
        totalTasks,
        completedTasks,
        pendingTasks
      },
      projects: projectsWithStats,
      financialData,
      activities
    }

    return NextResponse.json(dashboardData)
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
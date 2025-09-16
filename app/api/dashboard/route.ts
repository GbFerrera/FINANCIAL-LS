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
          projectName: comment.project?.name || 'Sem projeto'
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
          projectName: task.project?.name || 'Sem projeto',
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
          projectName: payment.project?.name || 'Sem projeto',
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

    // Get team task metrics for today
    const today = new Date()
    const startOfDay = new Date(today)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(today)
    endOfDay.setHours(23, 59, 59, 999)

    // Get all team members with their task metrics for today
    const teamMembers = await prisma.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'TEAM']
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        assignedTasks: {
          select: {
            id: true,
            title: true,
            status: true,
            completedAt: true,
            dueDate: true,
            project: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    const teamTaskMetrics = teamMembers.map(member => {
      const allTasks = member.assignedTasks
      
      // Tasks completed today
      const completedToday = allTasks.filter(task => 
        task.completedAt && 
        task.completedAt >= startOfDay && 
        task.completedAt <= endOfDay
      )
      
      // Tasks pending (not completed and either due today or overdue)
      const pendingTasks = allTasks.filter(task => 
        !task.completedAt && (
          (task.dueDate && task.dueDate <= endOfDay) || // Due today or overdue
          task.status === 'IN_PROGRESS' // Currently in progress
        )
      )
      
      // Tasks due today but not completed
      const dueTodayNotCompleted = allTasks.filter(task =>
        !task.completedAt &&
        task.dueDate &&
        task.dueDate >= startOfDay &&
        task.dueDate <= endOfDay
      )

      return {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        tasksCompletedToday: completedToday.length,
        tasksPending: pendingTasks.length,
        tasksDueTodayNotCompleted: dueTodayNotCompleted.length,
        completedTasks: completedToday.map(task => ({
          id: task.id,
          title: task.title,
          projectName: task.project?.name || 'Sem projeto',
          completedAt: task.completedAt
        })),
        pendingTasks: pendingTasks.map(task => ({
          id: task.id,
          title: task.title,
          status: task.status,
          dueDate: task.dueDate,
          projectName: task.project?.name || 'Sem projeto',
          isOverdue: task.dueDate && task.dueDate < startOfDay
        }))
      }
    })

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
      activities,
      teamTaskMetrics
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
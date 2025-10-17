import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, subDays, isAfter, isBefore } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'today'

    // Definir intervalos de data baseado no período
    let startDate: Date
    let endDate: Date
    
    const now = new Date()
    
    switch (period) {
      case 'week':
        startDate = startOfWeek(now)
        endDate = endOfWeek(now)
        break
      case 'month':
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        break
      case 'today':
      default:
        startDate = startOfDay(now)
        endDate = endOfDay(now)
        break
    }

    // Buscar todos os usuários da equipe (não clientes)
    const teamMembers = await prisma.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'TEAM']
        }
      },
      include: {
        assignedTasks: {
          include: {
            project: {
              select: {
                name: true
              }
            },
            milestone: {
              select: {
                name: true
              }
            },
            timeEntries: {
              where: {
                startTime: {
                  gte: startDate,
                  lte: endDate
                }
              }
            }
          }
        },
        timeEntries: {
          where: {
            startTime: {
              gte: startDate,
              lte: endDate
            }
          },
          include: {
            task: {
              include: {
                project: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    })

    // Buscar milestones para resumo
    const milestones = await prisma.milestone.findMany({
      include: {
        project: {
          select: {
            name: true
          }
        },
        tasks: {
          include: {
            assignee: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    // Processar dados de cada membro da equipe
    const processedMembers = await Promise.all(
      teamMembers.map(async (member) => {
        // Tarefas de hoje
        const todayStart = startOfDay(now)
        const todayEnd = endOfDay(now)
        
        const tasksToday = member.assignedTasks.filter(task => {
          if (task.dueDate) {
            const dueDate = new Date(task.dueDate)
            return dueDate >= todayStart && dueDate <= todayEnd
          }
          return false
        })

        const tasksCompletedToday = tasksToday.filter(task => 
          task.status === 'COMPLETED' && 
          task.completedAt && 
          new Date(task.completedAt) >= todayStart && 
          new Date(task.completedAt) <= todayEnd
        ).length

        const tasksPendingToday = tasksToday.filter(task => 
          task.status !== 'COMPLETED'
        ).length

        const tasksOverdueToday = tasksToday.filter(task => 
          task.status !== 'COMPLETED' && 
          task.dueDate && 
          new Date(task.dueDate) < now
        ).length

        // Tarefas de amanhã
        const tomorrowStart = startOfDay(addDays(now, 1))
        const tomorrowEnd = endOfDay(addDays(now, 1))
        
        const tasksTomorrow = member.assignedTasks.filter(task => {
          if (task.dueDate) {
            const dueDate = new Date(task.dueDate)
            return dueDate >= tomorrowStart && dueDate <= tomorrowEnd
          }
          return false
        })

        const tasksScheduledTomorrow = tasksTomorrow.length
        const tasksPendingTomorrow = tasksTomorrow.filter(task => 
          task.status !== 'COMPLETED'
        ).length

        // Calcular métricas de performance
        const allTasks = member.assignedTasks
        const completedTasks = allTasks.filter(task => task.status === 'COMPLETED')
        const completionRate = allTasks.length > 0 ? (completedTasks.length / allTasks.length) * 100 : 0

        // Calcular tempo médio por tarefa
        const tasksWithTime = completedTasks.filter(task => 
          task.estimatedHours && task.actualHours
        )
        const averageTimePerTask = tasksWithTime.length > 0 
          ? tasksWithTime.reduce((sum, task) => sum + (task.actualHours || 0), 0) / tasksWithTime.length
          : 0

        // Calcular entrega no prazo
        const tasksWithDueDate = completedTasks.filter(task => task.dueDate && task.completedAt)
        const onTimeDeliveries = tasksWithDueDate.filter(task => 
          task.completedAt && task.dueDate && new Date(task.completedAt) <= new Date(task.dueDate)
        ).length
        const onTimeDelivery = tasksWithDueDate.length > 0 ? (onTimeDeliveries / tasksWithDueDate.length) * 100 : 0

        // Calcular eficiência (tempo real vs estimado)
        const efficiency = tasksWithTime.length > 0 
          ? tasksWithTime.reduce((sum, task) => {
              const estimated = task.estimatedHours || 0
              const actual = task.actualHours || 0
              if (estimated > 0) {
                return sum + Math.min((estimated / actual) * 100, 100)
              }
              return sum
            }, 0) / tasksWithTime.length
          : 0

        // Calcular horas trabalhadas
        const hoursToday = member.timeEntries
          .filter(entry => {
            const entryDate = new Date(entry.startTime)
            return entryDate >= todayStart && entryDate <= todayEnd
          })
          .reduce((sum, entry) => sum + (entry.duration || 0), 0) / 3600 // converter segundos para horas

        const hoursThisWeek = member.timeEntries
          .filter(entry => {
            const entryDate = new Date(entry.startTime)
            return entryDate >= startOfWeek(now) && entryDate <= endOfWeek(now)
          })
          .reduce((sum, entry) => sum + (entry.duration || 0), 0) / 3600

        const hoursThisMonth = member.timeEntries
          .filter(entry => {
            const entryDate = new Date(entry.startTime)
            return entryDate >= startOfMonth(now) && entryDate <= endOfMonth(now)
          })
          .reduce((sum, entry) => sum + (entry.duration || 0), 0) / 3600

        const averageHoursPerDay = hoursThisMonth / new Date().getDate()

        // Tarefas atuais (não concluídas)
        const currentTasks = member.assignedTasks
          .filter(task => task.status !== 'COMPLETED')
          .map(task => ({
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
            projectName: task.project.name,
            milestone: task.milestone?.name,
            estimatedHours: task.estimatedHours,
            actualHours: task.actualHours,
            isOverdue: task.dueDate ? new Date(task.dueDate) < now : false
          }))

        // Milestones do membro
        const memberMilestones = milestones
          .filter(milestone => 
            milestone.tasks.some(task => task.assigneeId === member.id)
          )
          .map(milestone => {
            const memberTasks = milestone.tasks.filter(task => task.assigneeId === member.id)
            const completedTasks = memberTasks.filter(task => task.status === 'COMPLETED')
            const progress = memberTasks.length > 0 ? (completedTasks.length / memberTasks.length) * 100 : 0

            return {
              id: milestone.id,
              name: milestone.name,
              projectName: milestone.project.name,
              status: milestone.status,
              dueDate: milestone.dueDate,
              progress: Math.round(progress),
              tasksCompleted: completedTasks.length,
              totalTasks: memberTasks.length
            }
          })

        return {
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          avatar: member.avatar,
          tasksToday: {
            completed: tasksCompletedToday,
            pending: tasksPendingToday,
            overdue: tasksOverdueToday
          },
          tasksTomorrow: {
            scheduled: tasksScheduledTomorrow,
            pending: tasksPendingTomorrow
          },
          performance: {
            completionRate: Math.round(completionRate * 10) / 10,
            averageTimePerTask: Math.round(averageTimePerTask * 10) / 10,
            onTimeDelivery: Math.round(onTimeDelivery * 10) / 10,
            efficiency: Math.round(efficiency * 10) / 10
          },
          currentTasks,
          milestones: memberMilestones,
          timeTracking: {
            hoursToday: Math.round(hoursToday * 10) / 10,
            hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
            hoursThisMonth: Math.round(hoursThisMonth * 10) / 10,
            averageHoursPerDay: Math.round(averageHoursPerDay * 10) / 10
          }
        }
      })
    )

    // Calcular overview geral
    const totalMembers = processedMembers.length
    const activeMembers = processedMembers.filter(member => 
      member.timeTracking.hoursToday > 0 || 
      member.tasksToday.completed > 0 || 
      member.tasksToday.pending > 0
    ).length

    const tasksCompletedToday = processedMembers.reduce((sum, member) => 
      sum + member.tasksToday.completed, 0
    )

    const tasksPendingToday = processedMembers.reduce((sum, member) => 
      sum + member.tasksToday.pending, 0
    )

    const tasksScheduledTomorrow = processedMembers.reduce((sum, member) => 
      sum + member.tasksTomorrow.scheduled, 0
    )

    const averageCompletionRate = processedMembers.length > 0 
      ? processedMembers.reduce((sum, member) => sum + member.performance.completionRate, 0) / processedMembers.length
      : 0

    const totalHoursToday = processedMembers.reduce((sum, member) => 
      sum + member.timeTracking.hoursToday, 0
    )

    // Resumo de milestones
    const milestonesSummary = {
      total: milestones.length,
      completed: milestones.filter(m => m.status === 'COMPLETED').length,
      inProgress: milestones.filter(m => m.status === 'IN_PROGRESS').length,
      overdue: milestones.filter(m => 
        m.status !== 'COMPLETED' && 
        m.dueDate && 
        new Date(m.dueDate) < now
      ).length
    }

    const responseData = {
      overview: {
        totalMembers,
        activeMembers,
        tasksCompletedToday,
        tasksPendingToday,
        tasksScheduledTomorrow,
        averageCompletionRate: Math.round(averageCompletionRate * 10) / 10,
        totalHoursToday: Math.round(totalHoursToday * 10) / 10
      },
      teamMembers: processedMembers,
      milestonesSummary
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Erro ao buscar dados de performance:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
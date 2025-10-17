import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se o usuário é admin ou supervisor
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const today = new Date()
    const startOfToday = startOfDay(today)
    const endOfToday = endOfDay(today)

    // Buscar todos os usuários da equipe
    const teamUsers = await prisma.user.findMany({
      where: {
        role: 'TEAM'
      },
      select: {
        id: true,
        name: true,
        email: true,
        assignedTasks: {
          where: {
            status: 'IN_PROGRESS'
          },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            estimatedMinutes: true,
            actualMinutes: true,
            storyPoints: true,
            startTime: true,
            project: {
              select: {
                id: true,
                name: true
              }
            },
            sprint: {
              select: {
                id: true,
                name: true
              }
            },
            timeEntries: {
              where: {
                startTime: {
                  gte: startOfToday,
                  lte: endOfToday
                }
              },
              orderBy: { startTime: 'desc' }
            }
          }
        }
      }
    })

    // Processar dados para cada colaborador
    const activities = await Promise.all(
      teamUsers.map(async (user) => {
        // Estatísticas do dia
        const todayTasks = await prisma.task.findMany({
          where: {
            assigneeId: user.id,
            OR: [
              {
                completedAt: {
                  gte: startOfToday,
                  lte: endOfToday
                }
              },
              {
                status: 'IN_PROGRESS'
              },
              {
                timeEntries: {
                  some: {
                    startTime: {
                      gte: startOfToday,
                      lte: endOfToday
                    }
                  }
                }
              }
            ]
          },
          include: {
            timeEntries: {
              where: {
                startTime: {
                  gte: startOfToday,
                  lte: endOfToday
                }
              }
            }
          }
        })

        // Calcular tempo trabalhado hoje
        const timeWorked = todayTasks.reduce((total, task) => {
          return total + task.timeEntries.reduce((taskTotal, entry) => {
            return taskTotal + (entry.duration || 0)
          }, 0)
        }, 0)

        // Tarefa atual (em progresso com timer ativo)
        const currentTask = user.assignedTasks.find(task => {
          return task.timeEntries.some(entry => !entry.endTime)
        })

        // Verificar se está ativo (tem timer rodando)
        const isActive = !!currentTask

        return {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          isActive,
          currentTask: currentTask ? {
            ...currentTask,
            assignee: {
              id: user.id,
              name: user.name,
              email: user.email
            }
          } : undefined,
          todayStats: {
            tasksCompleted: todayTasks.filter(t => t.status === 'COMPLETED').length,
            timeWorked: Math.floor(timeWorked / 60), // converter para minutos
            tasksInProgress: todayTasks.filter(t => t.status === 'IN_PROGRESS').length
          }
        }
      })
    )

    // Ordenar por atividade (ativos primeiro)
    activities.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1
      if (!a.isActive && b.isActive) return 1
      return a.userName.localeCompare(b.userName)
    })

    return NextResponse.json({
      activities,
      summary: {
        totalCollaborators: activities.length,
        activeCollaborators: activities.filter(a => a.isActive).length,
        totalTasksInProgress: activities.reduce((sum, a) => sum + a.todayStats.tasksInProgress, 0),
        totalTasksCompleted: activities.reduce((sum, a) => sum + a.todayStats.tasksCompleted, 0),
        totalTimeWorked: activities.reduce((sum, a) => sum + a.todayStats.timeWorked, 0)
      }
    })
  } catch (error) {
    console.error('Erro ao buscar atividades dos colaboradores:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

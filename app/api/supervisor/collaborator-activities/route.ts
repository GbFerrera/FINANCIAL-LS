import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TimerEventType } from '@prisma/client'
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

        // Entradas de tempo do dia (agenda completa)
        const todayTimeEntries = await prisma.timeEntry.findMany({
          where: {
            userId: user.id,
            startTime: {
              gte: startOfToday,
              lte: endOfToday,
            },
          },
          include: {
            task: {
              select: {
                title: true,
                project: {
                  select: { name: true },
                },
              },
            },
          },
          orderBy: { startTime: 'asc' },
        })

        const agendaBlocks = todayTimeEntries.map((entry) => {
          let durationSeconds = entry.duration ?? 0

          if (!entry.endTime) {
            durationSeconds = Math.max(
              durationSeconds,
              Math.floor((Date.now() - entry.startTime.getTime()) / 1000)
            )
          } else if (!durationSeconds) {
            durationSeconds = Math.floor(
              (entry.endTime.getTime() - entry.startTime.getTime()) / 1000
            )
          }

          return {
            id: entry.id,
            startTime: entry.startTime.toISOString(),
            endTime: entry.endTime?.toISOString() ?? null,
            durationSeconds,
            taskTitle: entry.task.title,
            projectName: entry.task.project?.name || 'Sem projeto',
            isActive: !entry.endTime,
          }
        })

        if (agendaBlocks.length === 0) {
          const timerEvents = await prisma.timerEvent.findMany({
            where: {
              userId: user.id,
              timestamp: { gte: startOfToday, lte: endOfToday },
              type: { in: [TimerEventType.TIMER_PAUSE, TimerEventType.TIMER_STOP] },
              duration: { gt: 0 },
            },
            orderBy: { timestamp: 'asc' },
          })

          for (const event of timerEvents) {
            const endTime = event.timestamp
            const startTime = new Date(endTime.getTime() - (event.duration ?? 0) * 1000)
            agendaBlocks.push({
              id: event.id,
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              durationSeconds: event.duration ?? 0,
              taskTitle: event.taskTitle,
              projectName: event.projectName || 'Sem projeto',
              isActive: false,
            })
          }
        }

        // Calcular tempo trabalhado hoje
        const timeWorked = todayTimeEntries.reduce((total, entry) => {
          let durationSeconds = entry.duration ?? 0
          if (!entry.endTime) {
            durationSeconds = Math.max(
              durationSeconds,
              Math.floor((Date.now() - entry.startTime.getTime()) / 1000)
            )
          } else if (!durationSeconds) {
            durationSeconds = Math.floor(
              (entry.endTime.getTime() - entry.startTime.getTime()) / 1000
            )
          }
          return total + durationSeconds
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
          },
          agendaBlocks,
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

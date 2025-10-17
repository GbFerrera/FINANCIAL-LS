import { PrismaClient, TimerEventType } from '@prisma/client'

const prisma = new PrismaClient()

interface TimerEventData {
  type: 'timer_start' | 'timer_pause' | 'timer_stop' | 'timer_update' | 'task_complete'
  userId: string
  userName: string
  taskId: string
  taskTitle: string
  projectName: string
  sprintName?: string
  duration?: number
  totalTime?: number
  isPaused?: boolean
  pausedTime?: number
  sessionId?: string
  metadata?: any
}

// Mapear tipos de string para enum do Prisma
const mapEventType = (type: string): TimerEventType => {
  switch (type) {
    case 'timer_start':
      return TimerEventType.TIMER_START
    case 'timer_pause':
      return TimerEventType.TIMER_PAUSE
    case 'timer_stop':
      return TimerEventType.TIMER_STOP
    case 'timer_update':
      return TimerEventType.TIMER_UPDATE
    case 'task_complete':
      return TimerEventType.TASK_COMPLETE
    default:
      throw new Error(`Tipo de evento inválido: ${type}`)
  }
}

export class TimerEventService {
  // Salvar evento no banco de dados
  static async saveEvent(eventData: TimerEventData) {
    try {
      const timerEvent = await prisma.timerEvent.create({
        data: {
          type: mapEventType(eventData.type),
          userId: eventData.userId,
          userName: eventData.userName,
          taskId: eventData.taskId,
          taskTitle: eventData.taskTitle,
          projectName: eventData.projectName,
          sprintName: eventData.sprintName,
          duration: eventData.duration,
          totalTime: eventData.totalTime,
          isPaused: eventData.isPaused || false,
          pausedTime: eventData.pausedTime,
          sessionId: eventData.sessionId,
          metadata: eventData.metadata,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          task: {
            select: {
              id: true,
              title: true,
              project: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      })

      return timerEvent
    } catch (error) {
      console.error('Erro ao salvar evento do cronômetro:', error)
      throw error
    }
  }

  // Buscar eventos por usuário
  static async getEventsByUser(userId: string, limit = 50) {
    try {
      return await prisma.timerEvent.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          task: {
            select: {
              id: true,
              title: true,
              project: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      })
    } catch (error) {
      console.error('Erro ao buscar eventos por usuário:', error)
      throw error
    }
  }

  // Buscar eventos por tarefa
  static async getEventsByTask(taskId: string, limit = 50) {
    try {
      return await prisma.timerEvent.findMany({
        where: { taskId },
        orderBy: { timestamp: 'desc' },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          task: {
            select: {
              id: true,
              title: true,
              project: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      })
    } catch (error) {
      console.error('Erro ao buscar eventos por tarefa:', error)
      throw error
    }
  }

  // Buscar eventos recentes (últimas 24 horas)
  static async getRecentEvents(limit = 100) {
    try {
      const oneDayAgo = new Date()
      oneDayAgo.setDate(oneDayAgo.getDate() - 1)

      return await prisma.timerEvent.findMany({
        where: {
          timestamp: {
            gte: oneDayAgo
          }
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          task: {
            select: {
              id: true,
              title: true,
              project: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      })
    } catch (error) {
      console.error('Erro ao buscar eventos recentes:', error)
      throw error
    }
  }

  // Buscar sessões de trabalho por usuário e período
  static async getWorkSessions(userId: string, startDate: Date, endDate: Date) {
    try {
      return await prisma.timerEvent.findMany({
        where: {
          userId,
          timestamp: {
            gte: startDate,
            lte: endDate
          },
          type: {
            in: [TimerEventType.TIMER_START, TimerEventType.TIMER_PAUSE, TimerEventType.TIMER_STOP, TimerEventType.TASK_COMPLETE]
          }
        },
        orderBy: { timestamp: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          task: {
            select: {
              id: true,
              title: true,
              project: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      })
    } catch (error) {
      console.error('Erro ao buscar sessões de trabalho:', error)
      throw error
    }
  }

  // Calcular estatísticas de produtividade
  static async getProductivityStats(userId: string, startDate: Date, endDate: Date) {
    try {
      const events = await this.getWorkSessions(userId, startDate, endDate)
      
      // Agrupar por tarefa e calcular tempo total
      const taskStats = new Map()
      let totalWorkTime = 0
      let totalSessions = 0

      for (const event of events) {
        if (!taskStats.has(event.taskId)) {
          taskStats.set(event.taskId, {
            taskTitle: event.taskTitle,
            projectName: event.projectName,
            totalTime: 0,
            sessions: 0,
            completedAt: null
          })
        }

        const stats = taskStats.get(event.taskId)
        
        if (event.type === TimerEventType.TIMER_START) {
          stats.sessions++
          totalSessions++
        } else if (event.type === TimerEventType.TIMER_PAUSE || event.type === TimerEventType.TIMER_STOP) {
          if (event.duration) {
            stats.totalTime += event.duration
            totalWorkTime += event.duration
          }
        } else if (event.type === TimerEventType.TASK_COMPLETE) {
          stats.completedAt = event.timestamp
        }
      }

      return {
        totalWorkTime, // em segundos
        totalSessions,
        tasksWorked: taskStats.size,
        tasksCompleted: Array.from(taskStats.values()).filter(task => task.completedAt).length,
        taskBreakdown: Array.from(taskStats.entries()).map(([taskId, stats]) => ({
          taskId,
          ...stats
        }))
      }
    } catch (error) {
      console.error('Erro ao calcular estatísticas de produtividade:', error)
      throw error
    }
  }
}

export default TimerEventService

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { startOfDay, endOfDay } from 'date-fns'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    // Buscar colaborador pelo token
    const collaborator = await prisma.user.findUnique({
      where: { accessToken: token },
      select: {
        id: true,
        name: true,
        email: true,
      }
    })

    if (!collaborator) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 404 }
      )
    }

    const today = new Date()
    const startOfToday = startOfDay(today)
    const endOfToday = endOfDay(today)

    // Buscar tarefas de hoje (que têm dueDate hoje ou startDate hoje)
    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: collaborator.id,
        OR: [
          {
            dueDate: {
              gte: startOfToday,
              lte: endOfToday
            }
          },
          {
            startDate: {
              gte: startOfToday,
              lte: endOfToday
            }
          },
          {
            // Tarefas em progresso (independente da data)
            status: 'IN_PROGRESS'
          },
          {
            // Tarefas que foram trabalhadas hoje (têm time entries de hoje)
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
        project: {
          select: {
            id: true,
            name: true
          }
        },
        sprint: {
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        timeEntries: {
          where: {
            startTime: {
              gte: startOfToday,
              lte: endOfToday
            }
          },
          orderBy: {
            startTime: 'desc'
          }
        }
      },
      orderBy: [
        { status: 'asc' }, // IN_PROGRESS primeiro
        { priority: 'desc' }, // URGENT primeiro
        { dueDate: 'asc' }
      ]
    })

    // Calcular tempo trabalhado hoje para cada tarefa
    const tasksWithTodayTime = tasks.map(task => {
      const todayTimeEntries = task.timeEntries
      const totalMinutesToday = todayTimeEntries.reduce((total, entry) => {
        if (entry.duration) {
          return total + Math.floor(entry.duration / 60) // converter segundos para minutos
        }
        return total
      }, 0)

      return {
        ...task,
        actualMinutesToday: totalMinutesToday,
        hasWorkedToday: todayTimeEntries.length > 0,
        timeEntries: undefined // remover para não enviar dados desnecessários
      }
    })

    return NextResponse.json({
      collaborator,
      tasks: tasksWithTodayTime,
      date: today.toISOString(),
      totalTasks: tasksWithTodayTime.length
    })

  } catch (error) {
    console.error('Erro ao buscar tarefas de hoje:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

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

    console.log('Buscando tarefas para colaborador:', collaborator.id, 'token:', token)
    console.log('Data de hoje:', today.toISOString(), 'startOfToday:', startOfToday.toISOString(), 'endOfToday:', endOfToday.toISOString())

    // Buscar tarefas relevantes para hoje (critério mais amplo)
    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: collaborator.id,
        AND: [
          // Excluir tarefas completadas há mais de 1 dia
          {
            NOT: {
              AND: [
                { status: 'COMPLETED' },
                {
                  updatedAt: {
                    lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 horas atrás
                  }
                }
              ]
            }
          }
        ],
        OR: [
          {
            // Tarefas que vencem hoje
            dueDate: {
              gte: startOfToday,
              lte: endOfToday
            }
          },
          {
            // Tarefas que iniciam hoje
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
            // Tarefas TODO sem data específica (backlog disponível)
            AND: [
              { status: 'TODO' },
              { dueDate: null },
              { startDate: null }
            ]
          },
          {
            // Tarefas que vencem nos próximos 3 dias
            dueDate: {
              gte: startOfToday,
              lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
            }
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
          },
          {
            // Tarefas completadas hoje
            AND: [
              { status: 'COMPLETED' },
              {
                updatedAt: {
                  gte: startOfToday,
                  lte: endOfToday
                }
              }
            ]
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

    console.log('Tarefas encontradas:', tasks.length)
    console.log('Títulos das tarefas:', tasks.map(t => `${t.title} (${t.status}) - Due: ${t.dueDate} - Start: ${t.startDate}`))

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

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { startOfDay, endOfDay, format } from 'date-fns'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; date: string }> }
) {
  try {
    const { token, date } = await params

    // Verificar se o token é válido
    const user = await prisma.user.findUnique({
      where: { accessToken: token },
      select: { id: true, name: true, email: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Converter a data para o formato correto (UTC)
    const targetDate = new Date(date + 'T00:00:00.000Z')
    // Criar range de 24 horas em UTC para o dia especificado
    const startDate = new Date(date + 'T00:00:00.000Z')
    const endDate = new Date(date + 'T23:59:59.999Z')

    // Buscar tarefas concluídas no dia
    const completedTasks = await prisma.task.findMany({
      where: {
        assigneeId: user.id,
        status: 'COMPLETED',
        completedAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        completedAt: true,
        estimatedHours: true,
        actualHours: true,
        project: {
          select: {
            id: true,
            name: true
          }
        },
        assignee: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      },
      orderBy: {
        completedAt: 'desc'
      }
    })

    // Buscar tarefas pendentes com prazo para o dia
    const pendingTasks = await prisma.task.findMany({
      where: {
        assigneeId: user.id,
        status: {
          in: ['TODO', 'IN_PROGRESS']
        },
        dueDate: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        estimatedHours: true,
        project: {
          select: {
            id: true,
            name: true
          }
        },
        assignee: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      },
      orderBy: {
        priority: 'desc'
      }
    })

    // Calcular estatísticas do dia
    const totalHours = completedTasks.reduce((sum, task) => sum + (task.actualHours || 0), 0)
    const projects = [...new Set([
      ...completedTasks.map(task => task.project?.name).filter(Boolean),
      ...pendingTasks.map(task => task.project?.name).filter(Boolean)
    ])]

    const dayData = {
      date: date, // Usar a data original do parâmetro
      count: completedTasks.length,
      tasks: completedTasks,
      pendingTasks: pendingTasks,
      totalHours,
      projects,
      pendingCount: pendingTasks.length
    }

    return NextResponse.json(dayData)

  } catch (error) {
    console.error('Erro ao buscar detalhes do dia:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
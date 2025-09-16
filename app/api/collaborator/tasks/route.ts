import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    
    // Se não especificar data, busca tarefas de hoje
    const targetDate = date ? new Date(date) : new Date()
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    // Buscar tarefas do colaborador para o dia especificado
    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: session.user.id,
        OR: [
          {
            dueDate: {
              gte: startOfDay,
              lte: endOfDay
            }
          },
          {
            // Tarefas em progresso sem data de vencimento
            status: 'IN_PROGRESS',
            dueDate: null
          },
          {
            // Tarefas atrasadas
            dueDate: {
              lt: startOfDay
            },
            status: {
              in: ['TODO', 'IN_PROGRESS']
            }
          }
        ]
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        estimatedHours: true,
        actualHours: true,
        createdAt: true,
        updatedAt: true,
        project: {
          select: {
            id: true,
            name: true,
            client: {
              select: {
                name: true
              }
            }
          }
        },
        milestone: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    // Categorizar tarefas
    const categorizedTasks = {
      today: tasks.filter(task => {
        if (!task.dueDate) return task.status === 'IN_PROGRESS'
        const taskDate = new Date(task.dueDate)
        return taskDate >= startOfDay && taskDate <= endOfDay
      }),
      overdue: tasks.filter(task => {
        if (!task.dueDate) return false
        const taskDate = new Date(task.dueDate)
        return taskDate < startOfDay && ['TODO', 'IN_PROGRESS'].includes(task.status)
      }),
      inProgress: tasks.filter(task => task.status === 'IN_PROGRESS')
    }

    return NextResponse.json({
      tasks: categorizedTasks,
      summary: {
        total: tasks.length,
        today: categorizedTasks.today.length,
        overdue: categorizedTasks.overdue.length,
        inProgress: categorizedTasks.inProgress.length,
        totalEstimatedHours: tasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0),
        totalActualHours: tasks.reduce((sum, task) => sum + (task.actualHours || 0), 0)
      }
    })
  } catch (error) {
    console.error('Erro ao buscar tarefas do colaborador:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// Atualizar horas trabalhadas em uma tarefa
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { taskId, actualHours, status } = await request.json()

    if (!taskId) {
      return NextResponse.json(
        { error: 'ID da tarefa é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se a tarefa pertence ao colaborador
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        assigneeId: session.user.id
      }
    })

    if (!task) {
      return NextResponse.json(
        { error: 'Tarefa não encontrada ou não autorizada' },
        { status: 404 }
      )
    }

    // Atualizar a tarefa
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(actualHours !== undefined && { actualHours }),
        ...(status && { status }),
        ...(status === 'COMPLETED' && { completedAt: new Date() })
      },
      select: {
        id: true,
        title: true,
        status: true,
        actualHours: true,
        completedAt: true
      }
    })

    return NextResponse.json(updatedTask)
  } catch (error) {
    console.error('Erro ao atualizar tarefa:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
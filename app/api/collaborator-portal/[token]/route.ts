import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    if (!token) {
      return NextResponse.json(
        { error: 'Token de acesso é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar usuário pelo token usando query raw
    const users = await prisma.$queryRaw`
      SELECT id, name, email, role, avatar 
      FROM users 
      WHERE "accessToken" = ${token}
    ` as Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      avatar: string | null;
    }>
    const user = users[0]

    if (!user) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      )
    }

    if (user.role !== 'TEAM') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    // Se não especificar data, busca tarefas de hoje
    const targetDate = date ? new Date(date) : new Date()
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    // Buscar tarefas do colaborador para o dia especificado
    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: user.id,
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
      inProgress: tasks.filter(task => task.status === 'IN_PROGRESS'),
      completed: tasks.filter(task => task.status === 'COMPLETED')
    }

    // Estatísticas gerais do colaborador
    const allUserTasks = await prisma.task.findMany({
      where: { assigneeId: user.id },
      select: {
        status: true,
        estimatedHours: true,
        actualHours: true,
        completedAt: true
      }
    })

    const stats = {
      totalTasks: allUserTasks.length,
      completedTasks: allUserTasks.filter(t => t.status === 'COMPLETED').length,
      totalEstimatedHours: allUserTasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0),
      totalActualHours: allUserTasks.reduce((sum, task) => sum + (task.actualHours || 0), 0),
      efficiency: 0
    }

    if (stats.totalEstimatedHours > 0) {
      stats.efficiency = Math.round((stats.totalEstimatedHours / stats.totalActualHours) * 100) || 0
    }

    return NextResponse.json({
      user: {
        name: user.name,
        email: user.email
      },
      tasks: categorizedTasks,
      summary: {
        total: tasks.length,
        today: categorizedTasks.today.length,
        overdue: categorizedTasks.overdue.length,
        inProgress: categorizedTasks.inProgress.length,
        completed: categorizedTasks.completed.length,
        totalEstimatedHours: tasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0),
        totalActualHours: tasks.reduce((sum, task) => sum + (task.actualHours || 0), 0)
      },
      stats
    })
  } catch (error) {
    console.error('Erro ao buscar dados do colaborador:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// Atualizar horas trabalhadas em uma tarefa via portal
export async function PATCH(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    const { taskId, actualHours, status } = await request.json()

    if (!token) {
      return NextResponse.json(
        { error: 'Token de acesso é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar usuário pelo token usando query raw
    const users = await prisma.$queryRaw`
      SELECT id, role 
      FROM users 
      WHERE "accessToken" = ${token}
    ` as Array<{
      id: string;
      role: string;
    }>
    const user = users[0]

    if (!user || user.role !== 'TEAM') {
      return NextResponse.json(
        { error: 'Token inválido ou acesso negado' },
        { status: 401 }
      )
    }

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
        assigneeId: user.id
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
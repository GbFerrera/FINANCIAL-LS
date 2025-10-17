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

    // Definir o período de "hoje"
    const today = new Date()
    const startOfDay = new Date(today)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(today)
    endOfDay.setHours(23, 59, 59, 999)

    // Buscar todas as tarefas relevantes para hoje
    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          // Tarefas com prazo para hoje
          {
            dueDate: {
              gte: startOfDay,
              lte: endOfDay
            }
          },
          // Tarefas em progresso (independente da data)
          {
            status: 'IN_PROGRESS'
          },
          // Tarefas atrasadas que ainda não foram concluídas
          {
            dueDate: {
              lt: startOfDay
            },
            status: {
              in: ['TODO', 'IN_PROGRESS', 'IN_REVIEW']
            }
          }
        ]
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        },
        project: {
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

    // Calcular estatísticas
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(task => task.status === 'COMPLETED').length
    const inProgressTasks = tasks.filter(task => task.status === 'IN_PROGRESS').length
    const unassignedTasks = tasks.filter(task => !task.assigneeId).length
    
    // Calcular tarefas atrasadas
    const overdueTasks = tasks.filter(task => {
      if (!task.dueDate || task.status === 'COMPLETED') return false
      const dueDate = new Date(task.dueDate)
      dueDate.setHours(23, 59, 59, 999)
      return dueDate < startOfDay
    }).length

    const summary = {
      totalTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      unassignedTasks
    }

    return NextResponse.json({
      tasks,
      summary
    })

  } catch (error) {
    console.error('Erro ao buscar demandas de hoje:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
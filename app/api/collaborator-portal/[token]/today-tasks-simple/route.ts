import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { startOfDay, endOfDay, format } from 'date-fns'

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

    console.log('=== HOJE TASKS SIMPLE DEBUG ===')
    console.log('Token recebido:', token)
    console.log('Colaborador encontrado:', collaborator)
    console.log('Buscando tarefas para colaborador ID:', collaborator.id)

    const today = new Date()
    const todayStr = format(today, 'yyyy-MM-dd')
    const startOfToday = startOfDay(today)
    
    console.log('Data de hoje:', todayStr)
    console.log('Início do dia:', startOfToday)

    // Primeiro, vamos ver todas as tarefas do colaborador para debug
    const allTasks = await prisma.task.findMany({
      where: {
        assigneeId: collaborator.id
      },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        startDate: true,
        createdAt: true
      }
    })
    
    console.log('Total de tarefas do colaborador:', allTasks.length)
    console.log('Exemplos de tarefas:', allTasks.slice(0, 3).map(t => ({
      title: t.title,
      status: t.status,
      dueDate: t.dueDate,
      startDate: t.startDate
    })))

    // Primeiro teste: buscar tarefas não concluídas
    const incompleteTasks = await prisma.task.findMany({
      where: {
        assigneeId: collaborator.id,
        status: {
          in: ['TODO', 'IN_PROGRESS']
        }
      },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        startDate: true
      }
    })
    
    console.log('Tarefas não concluídas:', incompleteTasks.length)
    console.log('Exemplos não concluídas:', incompleteTasks.slice(0, 3))

    // TEMPORÁRIO: Buscar todas as tarefas não concluídas para debug
    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: collaborator.id,
        status: {
          in: ['TODO', 'IN_PROGRESS'] // Apenas tarefas não concluídas
        }
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
        }
      },
      orderBy: [
        { status: 'asc' }, // IN_PROGRESS primeiro
        { dueDate: 'asc' }, // Tarefas atrasadas primeiro
        { startDate: 'asc' }, // Data de início
        { startTime: 'asc' }, // Horário de início
        { priority: 'desc' }, // URGENT primeiro
        { createdAt: 'desc' }
      ]
    })

    console.log('Tarefas atrasadas e para hoje encontradas:', tasks.length)

    // Separar tarefas atrasadas das de hoje para estatísticas
    const overdueTasks = tasks.filter(task => 
      (task.dueDate && new Date(task.dueDate) < startOfToday) ||
      (task.startDate && new Date(task.startDate) < startOfToday)
    )
    const todayTasks = tasks.filter(task => 
      (task.dueDate && new Date(task.dueDate) >= startOfToday && new Date(task.dueDate) < endOfDay(today)) ||
      (task.startDate && format(new Date(task.startDate), 'yyyy-MM-dd') === todayStr)
    )

    console.log('Tarefas atrasadas:', overdueTasks.length)
    console.log('Tarefas para hoje:', todayTasks.length)

    return NextResponse.json({
      collaborator,
      tasks,
      date: new Date().toISOString(),
      totalTasks: tasks.length,
      overdueTasks: overdueTasks.length,
      todayTasks: todayTasks.length,
      message: 'TEMPORÁRIO: Mostra todas as tarefas não concluídas para debug'
    })

  } catch (error) {
    console.error('Erro ao buscar tarefas simples:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

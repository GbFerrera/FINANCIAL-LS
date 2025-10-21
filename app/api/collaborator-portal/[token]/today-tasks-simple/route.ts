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



    // Usar a data atual
    const today = new Date()
    const todayStr = format(today, 'yyyy-MM-dd')
    const startOfToday = startOfDay(today)
    


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
    
  
    // Buscar tarefas não concluídas e filtrar por data no código
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

    
    // FILTRO: Tarefas para hoje (com startDate ou dueDate = hoje) ou em progresso
    const filteredTasks = tasks.filter(task => {
      // 1. Tarefas em progresso sempre aparecem
      if (task.status === 'IN_PROGRESS') {
        return true
      }
      
      // 2. Tarefas com startDate = hoje
      if (task.startDate) {
        // Converter para string se necessário
        let taskDateStr: string
        if (typeof task.startDate === 'string') {
          taskDateStr = task.startDate
        } else {
          // Se for Date, converter para ISO string e extrair data
          taskDateStr = task.startDate.toISOString()
        }
        
        // Extrair apenas a parte da data (YYYY-MM-DD)
        if (taskDateStr.includes('T')) {
          taskDateStr = taskDateStr.split('T')[0]
        }
        
        if (taskDateStr === todayStr) {
          return true
        }
      }
      
      // 3. Tarefas com dueDate = hoje
      if (task.dueDate) {
        // Converter para string se necessário
        let taskDueDateStr: string
        if (typeof task.dueDate === 'string') {
          taskDueDateStr = task.dueDate
        } else {
          // Se for Date, converter para ISO string e extrair data
          taskDueDateStr = task.dueDate.toISOString()
        }
        
        // Extrair apenas a parte da data (YYYY-MM-DD)
        if (taskDueDateStr.includes('T')) {
          taskDueDateStr = taskDueDateStr.split('T')[0]
        }
        
        if (taskDueDateStr === todayStr) {
          return true
        }
      }
      
      return false
    })

    
    if (filteredTasks.length > 0) {
      filteredTasks.slice(0, 3).forEach((task, i) => {
        console.log(`Tarefa ${i + 1}:`, {
          title: task.title,
          status: task.status,
          startDate: task.startDate,
          dueDate: task.dueDate,
          startTime: task.startTime
        })
      })
    } else {
      console.log('Nenhuma tarefa encontrada com os critérios atuais')
      console.log('Vamos verificar tarefas não concluídas sem filtro de data:')
      
      const allIncompleteTasks = await prisma.task.findMany({
        where: {
          assigneeId: collaborator.id,
          status: { in: ['TODO', 'IN_PROGRESS'] }
        },
        select: {
          title: true,
          status: true,
          startDate: true,
          dueDate: true,
          startTime: true
        }
      })
      
      console.log('Total de tarefas não concluídas:', allIncompleteTasks.length)
      if (allIncompleteTasks.length > 0) {
        console.log('Exemplos de tarefas não concluídas:')
        allIncompleteTasks.slice(0, 5).forEach((task, i) => {
          console.log(`Tarefa ${i + 1}:`, task)
        })
      }
    }

    // Separar tarefas atrasadas das de hoje para estatísticas (simplificado)
    const overdueTasks = filteredTasks.filter(task => {
      // Como já filtramos apenas para hoje, não deveria haver tarefas atrasadas
      return false
    })
    const todayTasks = filteredTasks.filter(task => {
      // Todas as tarefas filtradas são de hoje
      return true
    })

    console.log('Tarefas atrasadas:', overdueTasks.length)
    console.log('Tarefas para hoje:', todayTasks.length)

    return NextResponse.json({
      collaborator,
      tasks: filteredTasks,
      date: new Date().toISOString(),
      totalTasks: filteredTasks.length,
      overdueTasks: overdueTasks.length,
      todayTasks: todayTasks.length,
      message: 'Mostra APENAS tarefas para hoje: em progresso, com startDate hoje ou com dueDate hoje'
    })

  } catch (error) {
    console.error('Erro ao buscar tarefas simples:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

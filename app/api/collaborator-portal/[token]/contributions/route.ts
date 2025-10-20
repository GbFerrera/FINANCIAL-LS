import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { startOfDay, endOfDay, subDays, format } from 'date-fns'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '365')

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

    // Calcular o período de análise
    const endDate = new Date()
    const startDate = subDays(endDate, days)

    console.log('Buscando tarefas para usuário:', user.id)
    console.log('Período:', { startDate, endDate })

    // Buscar tarefas concluídas no período
    const completedTasks = await prisma.task.findMany({
      where: {
        assigneeId: user.id,
        status: 'COMPLETED',
        OR: [
          {
            completedAt: {
              gte: startDate,
              lte: endDate
            }
          },
          {
            AND: [
              { completedAt: null },
              {
                updatedAt: {
                  gte: startDate,
                  lte: endDate
                }
              }
            ]
          }
        ]
      },
      select: {
        id: true,
        title: true,
        description: true,
        completedAt: true,
        updatedAt: true,
        actualMinutes: true,
        estimatedMinutes: true,
        priority: true,
        status: true,
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
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    console.log('Tarefas encontradas:', completedTasks.length)
    console.log('Exemplo de tarefa:', completedTasks[0])

    // Agrupar tarefas por data com dados detalhados
    const contributionMap = new Map<string, { 
      count: number; 
      totalHours: number; 
      tasks: any[];
      projects: Set<string>;
      totalEstimatedMinutes: number;
      totalActualMinutes: number;
    }>()
    
    // Inicializar todos os dias do período com 0
    for (let i = 0; i <= days; i++) {
      const date = subDays(endDate, i)
      const dateKey = format(date, 'yyyy-MM-dd')
      contributionMap.set(dateKey, { 
        count: 0, 
        totalHours: 0, 
        tasks: [],
        projects: new Set(),
        totalEstimatedMinutes: 0,
        totalActualMinutes: 0
      })
    }

    // Contar tarefas concluídas e somar dados detalhados por dia
    completedTasks.forEach(task => {
      // Usar completedAt se disponível, senão usar updatedAt
      const taskDate = task.completedAt || task.updatedAt
      if (taskDate) {
        const dateKey = format(new Date(taskDate), 'yyyy-MM-dd')
        const current = contributionMap.get(dateKey) || { 
          count: 0, 
          totalHours: 0, 
          tasks: [],
          projects: new Set(),
          totalEstimatedMinutes: 0,
          totalActualMinutes: 0
        }
        
        // Converter actualMinutes para horas
        const hoursWorked = (task.actualMinutes || 0) / 60
        const actualMinutes = task.actualMinutes || 0
        const estimatedMinutes = task.estimatedMinutes || 0
        
        // Adicionar projeto ao set
        if (task.project?.name) {
          current.projects.add(task.project.name)
        }
        
        // Adicionar tarefa aos detalhes
        current.tasks.push({
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          actualMinutes: actualMinutes,
          estimatedMinutes: estimatedMinutes,
          actualHours: Math.round(hoursWorked * 100) / 100,
          estimatedHours: Math.round((estimatedMinutes / 60) * 100) / 100,
          completedAt: task.completedAt,
          project: task.project,
          sprint: task.sprint
        })
        
        contributionMap.set(dateKey, {
          count: current.count + 1,
          totalHours: current.totalHours + hoursWorked,
          tasks: current.tasks,
          projects: current.projects,
          totalEstimatedMinutes: current.totalEstimatedMinutes + estimatedMinutes,
          totalActualMinutes: current.totalActualMinutes + actualMinutes
        })
      }
    })

    // Converter para array de objetos com dados detalhados
    const contributions = Array.from(contributionMap.entries()).map(([date, data]) => ({
      date,
      count: data.count,
      totalHours: Math.round(data.totalHours * 100) / 100,
      totalActualMinutes: data.totalActualMinutes,
      totalEstimatedMinutes: data.totalEstimatedMinutes,
      totalActualHours: Math.round((data.totalActualMinutes / 60) * 100) / 100,
      totalEstimatedHours: Math.round((data.totalEstimatedMinutes / 60) * 100) / 100,
      tasks: data.tasks,
      projects: Array.from(data.projects),
      projectsCount: data.projects.size,
      efficiency: data.totalEstimatedMinutes > 0 ? 
        Math.round((data.totalActualMinutes / data.totalEstimatedMinutes) * 100) : 100
    })).sort((a, b) => a.date.localeCompare(b.date))

    // Calcular estatísticas
    const totalContributions = completedTasks.length
    const contributionCounts = Array.from(contributionMap.values()).map(data => data.count)
    const averagePerDay = totalContributions / days

    // Calcular streak atual
    let currentStreak = 0
    const today = format(new Date(), 'yyyy-MM-dd')
    let checkDate = new Date()
    
    while (true) {
      const dateKey = format(checkDate, 'yyyy-MM-dd')
      const data = contributionMap.get(dateKey) || { count: 0, totalHours: 0 }
      
      if (data.count > 0) {
        currentStreak++
        checkDate = subDays(checkDate, 1)
      } else {
        // Se é hoje e não tem contribuições, continue verificando ontem
        if (dateKey === today) {
          checkDate = subDays(checkDate, 1)
          continue
        }
        break
      }
    }

    // Calcular maior streak
    let longestStreak = 0
    let tempStreak = 0
    
    contributionCounts.forEach(count => {
      if (count > 0) {
        tempStreak++
        longestStreak = Math.max(longestStreak, tempStreak)
      } else {
        tempStreak = 0
      }
    })

    // Calcular estatísticas detalhadas
    const totalHours = Array.from(contributionMap.values()).reduce((sum, data) => sum + data.totalHours, 0)
    const totalActualMinutes = Array.from(contributionMap.values()).reduce((sum, data) => sum + data.totalActualMinutes, 0)
    const totalEstimatedMinutes = Array.from(contributionMap.values()).reduce((sum, data) => sum + data.totalEstimatedMinutes, 0)
    
    // Calcular projetos únicos trabalhados
    const allProjects = new Set<string>()
    Array.from(contributionMap.values()).forEach(data => {
      data.projects.forEach(project => allProjects.add(project))
    })
    
    // Calcular eficiência geral
    const overallEfficiency = totalEstimatedMinutes > 0 ? 
      Math.round((totalActualMinutes / totalEstimatedMinutes) * 100) : 100
    
    // Calcular estatísticas por projeto
    const projectStats = Array.from(allProjects).map(projectName => {
      let projectTasks = 0
      let projectActualMinutes = 0
      let projectEstimatedMinutes = 0
      
      completedTasks.forEach(task => {
        if (task.project?.name === projectName) {
          projectTasks++
          projectActualMinutes += task.actualMinutes || 0
          projectEstimatedMinutes += task.estimatedMinutes || 0
        }
      })
      
      return {
        name: projectName,
        tasksCompleted: projectTasks,
        actualHours: Math.round((projectActualMinutes / 60) * 100) / 100,
        estimatedHours: Math.round((projectEstimatedMinutes / 60) * 100) / 100,
        efficiency: projectEstimatedMinutes > 0 ? 
          Math.round((projectActualMinutes / projectEstimatedMinutes) * 100) : 100
      }
    })

    const stats = {
      totalContributions,
      currentStreak,
      longestStreak,
      averagePerDay: Math.round(averagePerDay * 100) / 100,
      totalHours: Math.round(totalHours * 100) / 100,
      totalActualHours: Math.round((totalActualMinutes / 60) * 100) / 100,
      totalEstimatedHours: Math.round((totalEstimatedMinutes / 60) * 100) / 100,
      overallEfficiency,
      projectsWorked: allProjects.size,
      projectStats: projectStats.sort((a, b) => b.tasksCompleted - a.tasksCompleted)
    }

    console.log('Estatísticas calculadas:', {
      totalContributions: stats.totalContributions,
      totalHours: stats.totalHours,
      projectsWorked: stats.projectsWorked,
      overallEfficiency: stats.overallEfficiency
    })
    
    console.log('Contribuições com dados:', contributions.filter(c => c.count > 0).length)

    return NextResponse.json({
      contributions,
      stats,
      period: {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        days
      }
    })

  } catch (error) {
    console.error('Erro ao buscar contribuições:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
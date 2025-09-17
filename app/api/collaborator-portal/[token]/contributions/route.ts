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

    // Buscar tarefas concluídas no período
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
        completedAt: true,
        actualHours: true,
        project: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        completedAt: 'desc'
      }
    })

    // Agrupar tarefas por data
    const contributionMap = new Map<string, number>()
    
    // Inicializar todos os dias do período com 0
    for (let i = 0; i <= days; i++) {
      const date = subDays(endDate, i)
      const dateKey = format(date, 'yyyy-MM-dd')
      contributionMap.set(dateKey, 0)
    }

    // Contar tarefas concluídas por dia
    completedTasks.forEach(task => {
      if (task.completedAt) {
        const dateKey = format(new Date(task.completedAt), 'yyyy-MM-dd')
        const currentCount = contributionMap.get(dateKey) || 0
        contributionMap.set(dateKey, currentCount + 1)
      }
    })

    // Converter para array de objetos
    const contributions = Array.from(contributionMap.entries()).map(([date, count]) => ({
      date,
      count
    })).sort((a, b) => a.date.localeCompare(b.date))

    // Calcular estatísticas
    const totalContributions = completedTasks.length
    const contributionCounts = Array.from(contributionMap.values())
    const averagePerDay = totalContributions / days

    // Calcular streak atual
    let currentStreak = 0
    const today = format(new Date(), 'yyyy-MM-dd')
    let checkDate = new Date()
    
    while (true) {
      const dateKey = format(checkDate, 'yyyy-MM-dd')
      const count = contributionMap.get(dateKey) || 0
      
      if (count > 0) {
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

    const stats = {
      totalContributions,
      currentStreak,
      longestStreak,
      averagePerDay: Math.round(averagePerDay * 100) / 100
    }

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
import { NextRequest, NextResponse } from 'next/server'
import TimerEventService from '@/lib/timer-event-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId é obrigatório' },
        { status: 400 }
      )
    }

    // Definir período padrão (últimos 7 dias)
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()

    const stats = await TimerEventService.getProductivityStats(userId, start, end)

    // Formatar dados para melhor legibilidade
    const formattedStats = {
      ...stats,
      totalWorkTimeFormatted: formatDuration(stats.totalWorkTime),
      averageSessionTime: stats.totalSessions > 0 ? Math.round(stats.totalWorkTime / stats.totalSessions) : 0,
      averageSessionTimeFormatted: stats.totalSessions > 0 ? formatDuration(Math.round(stats.totalWorkTime / stats.totalSessions)) : '0s',
      completionRate: stats.tasksWorked > 0 ? Math.round((stats.tasksCompleted / stats.tasksWorked) * 100) : 0,
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        days: Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
      }
    }

    return NextResponse.json({
      stats: formattedStats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Erro ao calcular estatísticas:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`
  }
  return `${secs}s`
}

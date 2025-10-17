import { NextRequest, NextResponse } from 'next/server'
import TimerEventService from '@/lib/timer-event-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const taskId = searchParams.get('taskId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const type = searchParams.get('type') // 'user', 'task', 'recent'

    let events

    if (type === 'user' && userId) {
      events = await TimerEventService.getEventsByUser(userId, limit)
    } else if (type === 'task' && taskId) {
      events = await TimerEventService.getEventsByTask(taskId, limit)
    } else if (type === 'recent') {
      events = await TimerEventService.getRecentEvents(limit)
    } else {
      return NextResponse.json(
        { error: 'Parâmetros inválidos. Use type=user&userId=X, type=task&taskId=X, ou type=recent' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      events,
      count: events.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Erro ao buscar histórico de eventos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

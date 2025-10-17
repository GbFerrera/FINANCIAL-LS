import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getRecentEvents, type TimerEvent } from '@/lib/event-store'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const userRole = searchParams.get('userRole')
    const since = searchParams.get('since') // timestamp para buscar eventos desde

    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 })
    }

    // Apenas admins podem receber eventos de timer
    if (userRole !== 'ADMIN') {
      return NextResponse.json([]) // Retorna array vazio para não-admins
    }

    // Filtrar eventos recentes (últimos 10 minutos)
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000)
    const sinceTimestamp = since ? new Date(since).getTime() : tenMinutesAgo

    const recentEvents = getRecentEvents(sinceTimestamp)

    return NextResponse.json(recentEvents)
  } catch (error) {
    console.error('Erro ao buscar eventos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}


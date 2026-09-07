import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { touchPresenceSession } from '@/lib/presence/service'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    let source = 'web'
    try {
      const body = await request.json()
      if (body?.source === 'call') source = 'call'
    } catch {
      // body opcional
    }

    const row = await touchPresenceSession(session.user.id, source)
    return NextResponse.json({
      ok: true,
      sessionId: row.id,
      lastPingAt: row.lastPingAt.toISOString(),
    })
  } catch (error) {
    console.error('presence heartbeat:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

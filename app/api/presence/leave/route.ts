import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { endPresenceSession } from '@/lib/presence/service'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    await endPresenceSession(session.user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('presence leave:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

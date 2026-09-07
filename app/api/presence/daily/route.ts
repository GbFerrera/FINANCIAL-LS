import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOnlineUserIds } from '@/lib/presence/service'
import {
  endOfDay,
  formatActiveDuration,
  startOfDay,
  sumActiveMinutesInRange,
} from '@/lib/presence/utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const target = dateParam ? new Date(dateParam) : new Date()
    const rangeStart = startOfDay(target)
    const rangeEnd = endOfDay(target)

    const sessions = await prisma.userPresenceSession.findMany({
      where: {
        startedAt: { lte: rangeEnd },
        OR: [{ endedAt: null }, { endedAt: { gte: rangeStart } }],
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true, role: true } },
      },
      orderBy: { startedAt: 'asc' },
    })

    const byUser = new Map<
      string,
      {
        user: (typeof sessions)[0]['user']
        minutes: number
        sessions: number
      }
    >()

    for (const s of sessions) {
      const minutes = sumActiveMinutesInRange(
        [s],
        rangeStart,
        rangeEnd
      )
      if (minutes <= 0) continue
      const existing = byUser.get(s.userId)
      if (existing) {
        existing.minutes += minutes
        existing.sessions += 1
      } else {
        byUser.set(s.userId, { user: s.user, minutes, sessions: 1 })
      }
    }

    const onlineIds = new Set(await getOnlineUserIds())
    const users = Array.from(byUser.values())
      .map((row) => ({
        ...row.user,
        activeMinutes: row.minutes,
        activeLabel: formatActiveDuration(row.minutes),
        sessionCount: row.sessions,
        isOnline: onlineIds.has(row.user.id),
      }))
      .sort((a, b) => b.activeMinutes - a.activeMinutes)

    const myRow = users.find((u) => u.id === session.user.id)

    return NextResponse.json({
      date: rangeStart.toISOString().slice(0, 10),
      users,
      myActiveMinutes: myRow?.activeMinutes ?? 0,
      myActiveLabel: myRow?.activeLabel ?? formatActiveDuration(0),
    })
  } catch (error) {
    console.error('presence daily:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

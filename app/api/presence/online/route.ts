import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOnlineUserIds } from '@/lib/presence/service'
import { formatActiveDuration, startOfDay, endOfDay, sumActiveMinutesInRange } from '@/lib/presence/utils'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const onlineIds = await getOnlineUserIds()
    if (onlineIds.length === 0) {
      return NextResponse.json({ users: [], count: 0 })
    }

    const users = await prisma.user.findMany({
      where: { id: { in: onlineIds } },
      select: { id: true, name: true, email: true, avatar: true, role: true },
      orderBy: { name: 'asc' },
    })

    const todayStart = startOfDay(new Date())
    const todayEnd = endOfDay(new Date())
    const todaySessions = await prisma.userPresenceSession.findMany({
      where: {
        userId: { in: onlineIds },
        startedAt: { lte: todayEnd },
        OR: [{ endedAt: null }, { endedAt: { gte: todayStart } }],
      },
    })

    const minutesByUser = new Map<string, number>()
    for (const s of todaySessions) {
      const m = sumActiveMinutesInRange([s], todayStart, todayEnd)
      minutesByUser.set(s.userId, (minutesByUser.get(s.userId) ?? 0) + m)
    }

    return NextResponse.json({
      count: users.length,
      users: users.map((u) => ({
        ...u,
        isOnline: true,
        activeMinutesToday: minutesByUser.get(u.id) ?? 0,
        activeLabelToday: formatActiveDuration(minutesByUser.get(u.id) ?? 0),
      })),
    })
  } catch (error) {
    console.error('presence online:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

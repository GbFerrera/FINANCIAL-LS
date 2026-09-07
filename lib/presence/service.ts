import { prisma } from '@/lib/prisma'
import { PRESENCE_IDLE_MS } from './constants'

export async function closeStalePresenceSessions(now = new Date()) {
  const threshold = new Date(now.getTime() - PRESENCE_IDLE_MS)
  const stale = await prisma.userPresenceSession.findMany({
    where: { endedAt: null, lastPingAt: { lt: threshold } },
    select: { id: true, lastPingAt: true },
  })

  await Promise.all(
    stale.map((s) =>
      prisma.userPresenceSession.update({
        where: { id: s.id },
        data: { endedAt: s.lastPingAt },
      })
    )
  )

  return stale.length
}

export async function touchPresenceSession(userId: string, source = 'web') {
  await closeStalePresenceSessions()

  const threshold = new Date(Date.now() - PRESENCE_IDLE_MS)
  const open = await prisma.userPresenceSession.findFirst({
    where: {
      userId,
      endedAt: null,
      lastPingAt: { gte: threshold },
    },
    orderBy: { startedAt: 'desc' },
  })

  const now = new Date()
  if (open) {
    return prisma.userPresenceSession.update({
      where: { id: open.id },
      data: { lastPingAt: now },
    })
  }

  return prisma.userPresenceSession.create({
    data: { userId, source, lastPingAt: now },
  })
}

export async function endPresenceSession(userId: string) {
  const open = await prisma.userPresenceSession.findFirst({
    where: { userId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  })
  if (!open) return null

  const now = new Date()
  return prisma.userPresenceSession.update({
    where: { id: open.id },
    data: { endedAt: now, lastPingAt: now },
  })
}

export async function getOnlineUserIds(now = new Date()): Promise<string[]> {
  await closeStalePresenceSessions(now)
  const threshold = new Date(now.getTime() - PRESENCE_IDLE_MS)
  const rows = await prisma.userPresenceSession.findMany({
    where: { endedAt: null, lastPingAt: { gte: threshold } },
    select: { userId: true },
    distinct: ['userId'],
  })
  return rows.map((r) => r.userId)
}

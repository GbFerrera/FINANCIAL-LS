import { PRESENCE_IDLE_MS } from './constants'

type PresenceSessionLike = {
  startedAt: Date
  endedAt: Date | null
  lastPingAt: Date
}

function effectiveEnd(session: PresenceSessionLike, now: Date): Date {
  if (session.endedAt) return session.endedAt
  if (now.getTime() - session.lastPingAt.getTime() > PRESENCE_IDLE_MS) {
    return session.lastPingAt
  }
  return now
}

/** Minutos ativos de uma sessão (considera idle timeout). */
export function sessionActiveMinutes(
  session: PresenceSessionLike,
  now = new Date()
): number {
  const end = effectiveEnd(session, now)
  const ms = end.getTime() - session.startedAt.getTime()
  return Math.max(0, Math.round(ms / 60_000))
}

/** Soma minutos ativos no intervalo [rangeStart, rangeEnd). */
export function sumActiveMinutesInRange(
  sessions: PresenceSessionLike[],
  rangeStart: Date,
  rangeEnd: Date,
  now = new Date()
): number {
  let total = 0
  for (const session of sessions) {
    const rawEnd = effectiveEnd(session, now)
    const start = session.startedAt < rangeStart ? rangeStart : session.startedAt
    const end = rawEnd > rangeEnd ? rangeEnd : rawEnd
    if (end > start) {
      total += Math.round((end.getTime() - start.getTime()) / 60_000)
    }
  }
  return total
}

export function formatActiveDuration(minutes: number): string {
  if (minutes < 1) return '< 1 min'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

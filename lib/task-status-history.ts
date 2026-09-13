import { TaskStatus } from '@prisma/client'

const STATUS_LABELS: Record<TaskStatus, string> = {
  DRAFT: 'Rascunho',
  TODO: 'A fazer',
  IN_PROGRESS: 'Em andamento',
  IN_REVIEW: 'Testar',
  COMPLETED: 'Concluída',
}

export function taskStatusLabel(status: TaskStatus | null | undefined) {
  if (!status) return '—'
  return STATUS_LABELS[status] ?? status
}

export function formatDurationMs(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const totalMinutes = Math.floor(ms / 60_000)
  if (totalMinutes < 60) return `${totalMinutes} min`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours < 48) return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`
}

export type StatusHistoryRow = {
  id: string
  fromStatus: TaskStatus | null
  toStatus: TaskStatus
  changedAt: string | Date
  changedBy?: { id: string; name: string | null } | null
}

export function buildStatusDurations(history: StatusHistoryRow[]) {
  if (history.length === 0) return []

  const sorted = [...history].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
  )

  const segments: Array<{
    status: TaskStatus
    startedAt: Date
    endedAt: Date | null
    durationMs: number | null
    changedBy?: { id: string; name: string | null } | null
  }> = []

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]
    const startedAt = new Date(row.changedAt)
    const next = sorted[i + 1]
    const endedAt = next ? new Date(next.changedAt) : null
    const durationMs = endedAt ? endedAt.getTime() - startedAt.getTime() : null

    segments.push({
      status: row.toStatus,
      startedAt,
      endedAt,
      durationMs,
      changedBy: row.changedBy ?? null,
    })
  }

  return segments
}

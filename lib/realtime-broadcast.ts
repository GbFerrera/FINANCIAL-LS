import 'server-only'

import type { Server as ServerIO } from 'socket.io'
import { getSocketIO } from '@/lib/socket-server'

function getBroadcastOrigin() {
  return (process.env.NEXTAUTH_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
}

function getBroadcastHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const secret = process.env.CRON_SECRET
  if (secret) headers['x-cron-secret'] = secret
  return headers
}

export async function postRealtimeBroadcast(body: unknown) {
  const res = await fetch(`${getBroadcastOrigin()}/api/realtime/broadcast`, {
    method: 'POST',
    headers: getBroadcastHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.warn('[realtime-broadcast] HTTP', res.status)
  }
}

export async function emitViaRealtimeBroadcast(
  emit: (io: ServerIO) => void,
  fallbackBody: unknown
) {
  const io = getSocketIO()
  if (io) {
    emit(io)
    return
  }

  try {
    await postRealtimeBroadcast(fallbackBody)
  } catch (error) {
    console.warn('[realtime-broadcast] Falha ao emitir evento:', error)
  }
}

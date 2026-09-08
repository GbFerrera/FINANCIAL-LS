import 'server-only'

import type { Server as ServerIO } from 'socket.io'

function getBroadcastOrigin() {
  if (process.env.REALTIME_BROADCAST_URL) {
    return process.env.REALTIME_BROADCAST_URL.replace(/\/$/, '')
  }
  const port = process.env.PORT || '3000'
  return `http://127.0.0.1:${port}`
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
    const detail = await res.text().catch(() => '')
    console.warn('[realtime-broadcast] HTTP', res.status, detail.slice(0, 200))
  }
}

/** Emite via HTTP interno — App Routes nem sempre compartilham global.__socketIO com o handler Pages. */
export async function emitViaRealtimeBroadcast(
  _emit: (io: ServerIO) => void,
  body: unknown
) {
  await postRealtimeBroadcast(body)
}

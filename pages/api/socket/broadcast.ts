import { NextApiRequest } from 'next'
import { NextApiResponseServerIO, initializeSocket } from '@/lib/socket-server'
import { emitTaskEventToIO } from '@/lib/task-socket-server'
import type { TaskUpdateEvent } from '@/lib/task-socket-types'

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' })
  }

  const io = initializeSocket(res)
  emitTaskEventToIO(io, req.body as TaskUpdateEvent)
  return res.status(200).json({ ok: true })
}

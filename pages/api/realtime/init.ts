import { NextApiRequest } from 'next'
import { NextApiResponseServerIO, initializeSocket } from '@/lib/socket-server'

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (req.method === 'POST') {
    initializeSocket(res)
    return res.status(200).json({ message: 'Socket.IO inicializado' })
  }

  return res.status(405).json({ message: 'Método não permitido' })
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}

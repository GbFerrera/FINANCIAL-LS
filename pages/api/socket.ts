import { NextApiRequest } from 'next'
import { NextApiResponseServerIO, initializeSocket } from '@/lib/socket-server'

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (req.method === 'POST') {
    // Inicializar Socket.IO se ainda não foi inicializado
    initializeSocket(res)
    
    res.status(200).json({ message: 'Socket.IO inicializado' })
  } else {
    res.status(405).json({ message: 'Método não permitido' })
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}

import { Server as NetServer } from 'http'
import { NextApiRequest, NextApiResponse } from 'next'
import { Server as ServerIO } from 'socket.io'
import TimerEventService from './timer-event-service'

export type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: NetServer & {
      io: ServerIO
    }
  }
}

interface TimerEvent {
  type: 'timer_start' | 'timer_pause' | 'timer_stop' | 'timer_update' | 'task_complete'
  userId: string
  userName: string
  taskId: string
  taskTitle: string
  projectName: string
  sprintName?: string
  timestamp: string
  duration?: number
  totalTime?: number
  isPaused?: boolean
  pausedTime?: number
}

interface UserSession {
  userId: string
  userName: string
  userRole: string
  socketId: string
}

// Store para sessões ativas
const activeSessions = new Map<string, UserSession>()
// Store para timers ativos
const activeTimers = new Map<string, TimerEvent>() // taskId -> timer event

export function initializeSocket(res: NextApiResponseServerIO) {
  if (!res.socket.server.io) {
    console.log('Inicializando Socket.IO Server...')
    
    const io = new ServerIO(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    })

    io.on('connection', (socket) => {
      console.log('Cliente conectado:', socket.id)

      // Autenticação do usuário
      socket.on('authenticate', (data: { userId: string, userName: string, userRole: string }) => {
        const { userId, userName, userRole } = data
        
        // Armazenar sessão
        activeSessions.set(socket.id, {
          userId,
          userName,
          userRole,
          socketId: socket.id
        })

        // Juntar sala baseada no role
        if (userRole === 'ADMIN') {
          socket.join('supervisors')
          console.log(`Supervisor ${userName} conectado`)
          
          // Enviar timers ativos para supervisor recém conectado
          const timersArray = Array.from(activeTimers.values())
          socket.emit('active_timers', timersArray)
        } else {
          socket.join('collaborators')
          console.log(`Colaborador ${userName} conectado`)
        }

        socket.emit('authenticated', { success: true })
      })

      // Eventos de timer
      socket.on('timer_event', async (event: TimerEvent) => {
        console.log('Evento de timer recebido:', event.type, event.taskId)
        
        try {
          // Salvar evento no banco de dados
          await TimerEventService.saveEvent({
            type: event.type,
            userId: event.userId,
            userName: event.userName,
            taskId: event.taskId,
            taskTitle: event.taskTitle,
            projectName: event.projectName,
            sprintName: event.sprintName,
            duration: event.duration,
            totalTime: event.totalTime,
            isPaused: event.isPaused,
            pausedTime: event.pausedTime,
            sessionId: socket.id, // Usar socket ID como session ID
            metadata: {
              socketId: socket.id,
              userAgent: socket.handshake.headers['user-agent'],
              ip: socket.handshake.address
            }
          })
          
          console.log(`✅ Evento salvo no DB: ${event.type} - ${event.userName} - ${event.taskTitle}`)
        } catch (error) {
          console.error('❌ Erro ao salvar evento no DB:', error)
        }
        
        // Atualizar store local
        if (event.type === 'timer_start' || event.type === 'timer_update') {
          activeTimers.set(event.taskId, event)
        } else if (event.type === 'timer_pause') {
          // Manter timer pausado no store
          activeTimers.set(event.taskId, { ...event, isPaused: true })
        } else if (event.type === 'timer_stop' || event.type === 'task_complete') {
          activeTimers.delete(event.taskId)
        }

        // Broadcast para supervisores
        io.to('supervisors').emit('timer_event', event)
        
        // Log do evento
        console.log(`Timer ${event.type}: ${event.userName} - ${event.taskTitle}`)
      })

      // Solicitar timers ativos
      socket.on('get_active_timers', () => {
        const timersArray = Array.from(activeTimers.values())
        socket.emit('active_timers', timersArray)
      })

      // Desconexão
      socket.on('disconnect', () => {
        const session = activeSessions.get(socket.id)
        if (session) {
          console.log(`${session.userName} desconectado`)
          activeSessions.delete(socket.id)
        }
      })
    })

    res.socket.server.io = io
  }
}

export { activeTimers, activeSessions }

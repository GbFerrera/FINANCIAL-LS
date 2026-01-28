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

interface ExcalidrawCollaborationEvent {
  type: 'scene_update' | 'cursor_update' | 'user_join' | 'user_leave'
  projectId: string
  userId: string
  userName: string
  data?: any
  timestamp: string
}

interface CollaboratorInfo {
  userId: string
  userName: string
  cursor?: { x: number; y: number }
  color: string
  lastSeen: string
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
// Store para colaboradores ativos no Excalidraw por projeto
const excalidrawCollaborators = new Map<string, Map<string, CollaboratorInfo>>() // projectId -> userId -> info

// Cores para colaboradores
const collaboratorColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
]

function getCollaboratorColor(userId: string): string {
  const hash = userId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  return collaboratorColors[Math.abs(hash) % collaboratorColors.length]
}

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
          const existingTimer = activeTimers.get(event.taskId)
          if (existingTimer) {
            activeTimers.set(event.taskId, { ...existingTimer, isPaused: true, pausedTime: event.pausedTime })
          }
        } else if (event.type === 'timer_stop' || event.type === 'task_complete') {
          activeTimers.delete(event.taskId)
        }
        
        // Broadcast para supervisores
        io.to('supervisors').emit('timer_event', event)
      })

      // Eventos de colaboração Excalidraw (padrão oficial)
      socket.on('join-room', (data: { roomID: string }) => {
        const session = activeSessions.get(socket.id)
        if (!session) return

        const { roomID } = data
        const { userId, userName } = session

        // Juntar sala do projeto
        socket.join(roomID)

        // Adicionar colaborador
        if (!excalidrawCollaborators.has(roomID)) {
          excalidrawCollaborators.set(roomID, new Map())
        }

        const roomCollaborators = excalidrawCollaborators.get(roomID)!
        const isFirstUser = roomCollaborators.size === 0
        
        roomCollaborators.set(userId, {
          userId,
          userName,
          color: getCollaboratorColor(userId),
          lastSeen: new Date().toISOString()
        })

        console.log(`${userName} entrou na sala ${roomID}`)

        if (isFirstUser) {
          // Primeiro usuário na sala
          socket.emit('first-in-room')
        } else {
          // Notificar outros colaboradores sobre novo usuário
          socket.to(roomID).emit('new-user', {
            socketId: socket.id,
            userId,
            userName
          })
        }

        // Enviar lista atualizada de usuários para todos na sala
        const userIds = Array.from(roomCollaborators.keys())
        io.to(roomID).emit('room-user-change', userIds)
      })

      socket.on('leave-room', (data: { roomID: string }) => {
        const session = activeSessions.get(socket.id)
        if (!session) return

        const { roomID } = data
        const { userId, userName } = session

        // Sair da sala do projeto
        socket.leave(roomID)

        // Remover colaborador
        const roomCollaborators = excalidrawCollaborators.get(roomID)
        if (roomCollaborators) {
          roomCollaborators.delete(userId)
          
          // Notificar outros colaboradores sobre usuário que saiu
          socket.to(roomID).emit('user-left', {
            socketId: socket.id,
            userId,
            userName
          })
          
          // Enviar lista atualizada de usuários
          const userIds = Array.from(roomCollaborators.keys())
          io.to(roomID).emit('room-user-change', userIds)
          
          // Se não há mais colaboradores, limpar a sala
          if (roomCollaborators.size === 0) {
            excalidrawCollaborators.delete(roomID)
          }
        }

        console.log(`${userName} saiu da sala ${roomID}`)
      })

      socket.on('server-broadcast', (data: { roomID: string, encryptedData: ArrayBuffer | string, iv?: ArrayBuffer }) => {
        const session = activeSessions.get(socket.id)
        if (!session) return

        const { roomID, encryptedData, iv } = data
        const { userId, userName } = session

        // Atualizar timestamp do colaborador
        const roomCollaborators = excalidrawCollaborators.get(roomID)
        if (roomCollaborators && roomCollaborators.has(userId)) {
          const collaborator = roomCollaborators.get(userId)!
          collaborator.lastSeen = new Date().toISOString()
        }

        // Broadcast dados criptografados para outros colaboradores na sala
        socket.to(roomID).emit('client-broadcast', {
          socketId: socket.id,
          encryptedData,
          iv
        })

        console.log(`${userName} enviou dados para sala ${roomID}`)
      })

      socket.on('cursor-update', (data: { roomID: string, pointer: { x: number, y: number } }) => {
        const session = activeSessions.get(socket.id)
        if (!session) return

        const { roomID, pointer } = data
        const { userId, userName } = session

        // Atualizar cursor do colaborador
        const roomCollaborators = excalidrawCollaborators.get(roomID)
        if (roomCollaborators && roomCollaborators.has(userId)) {
          const collaborator = roomCollaborators.get(userId)!
          collaborator.cursor = pointer
          collaborator.lastSeen = new Date().toISOString()
        }

        // Broadcast cursor para outros colaboradores
        socket.to(roomID).emit('cursor-update', {
          socketId: socket.id,
          pointer,
          userId,
          userName
        })
      })

      // Limpeza quando usuário desconecta
      socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id)
        
        const session = activeSessions.get(socket.id)
        if (session) {
          const { userId, userName } = session
          
          // Remover de todas as salas Excalidraw
          excalidrawCollaborators.forEach((collaborators, roomID) => {
            if (collaborators.has(userId)) {
              collaborators.delete(userId)
              
              // Notificar outros colaboradores
              socket.to(roomID).emit('user-left', {
                socketId: socket.id,
                userId,
                userName
              })
              
              // Enviar lista atualizada de usuários
              const userIds = Array.from(collaborators.keys())
              io.to(roomID).emit('room-user-change', userIds)
              
              // Limpar sala se vazia
              if (collaborators.size === 0) {
                excalidrawCollaborators.delete(roomID)
              }
            }
          })
          
          // Remover sessão
          activeSessions.delete(socket.id)
        }
      })
    })

    res.socket.server.io = io
  }

  return res.socket.server.io
}

export { activeTimers, activeSessions }

'use client'

import { useEffect, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSession } from 'next-auth/react'

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

interface UseSocketReturn {
  socket: Socket | null
  isConnected: boolean
  sendTimerEvent: (event: Omit<TimerEvent, 'timestamp'>) => void
  lastEvent: TimerEvent | null
  activeTimers: Map<string, TimerEvent>
}

export function useSocket(): UseSocketReturn {
  const { data: session } = useSession()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<TimerEvent | null>(null)
  const [activeTimers, setActiveTimers] = useState<Map<string, TimerEvent>>(new Map())

  useEffect(() => {
    if (!session?.user?.id) return

    // Inicializar Socket.IO
    const initSocket = async () => {
      // Primeiro, inicializar o servidor Socket.IO
      await fetch('/api/socket', { method: 'POST' })
      
      // Conectar ao socket
      const socketInstance = io({
        path: '/api/socket',
        addTrailingSlash: false,
      })

      socketInstance.on('connect', () => {
        console.log('Conectado ao Socket.IO')
        setIsConnected(true)
        
        // Autenticar usuário
        socketInstance.emit('authenticate', {
          userId: session.user.id,
          userName: session.user.name,
          userRole: session.user.role
        })
      })

      socketInstance.on('authenticated', (data) => {
        console.log('Autenticado:', data)
      })

      socketInstance.on('timer_event', (event: TimerEvent) => {
        console.log('Evento recebido:', event)
        setLastEvent(event)
        
        // Atualizar timers ativos
        setActiveTimers(prev => {
          const newMap = new Map(prev)
          
          if (event.type === 'timer_start' || event.type === 'timer_update') {
            newMap.set(event.taskId, event)
          } else if (event.type === 'timer_pause') {
            newMap.set(event.taskId, { ...event, isPaused: true })
          } else if (event.type === 'timer_stop' || event.type === 'task_complete') {
            newMap.delete(event.taskId)
          }
          
          return newMap
        })
      })

      socketInstance.on('active_timers', (timers: TimerEvent[]) => {
        console.log('Timers ativos recebidos:', timers)
        setActiveTimers(new Map(timers.map(timer => [timer.taskId, timer])))
      })

      socketInstance.on('disconnect', () => {
        console.log('Desconectado do Socket.IO')
        setIsConnected(false)
      })

      setSocket(socketInstance)
    }

    initSocket()

    return () => {
      if (socket) {
        socket.disconnect()
      }
    }
  }, [session?.user?.id, session?.user?.name, session?.user?.role])

  const sendTimerEvent = useCallback((event: Omit<TimerEvent, 'timestamp'>) => {
    if (socket && isConnected) {
      const timerEvent: TimerEvent = {
        ...event,
        timestamp: new Date().toISOString()
      }
      
      console.log('Enviando evento:', timerEvent)
      socket.emit('timer_event', timerEvent)
    }
  }, [socket, isConnected])

  return {
    socket,
    isConnected,
    sendTimerEvent,
    lastEvent,
    activeTimers
  }
}

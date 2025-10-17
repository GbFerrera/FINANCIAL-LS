'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
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

interface WebSocketContextType {
  isConnected: boolean
  sendTimerEvent: (event: Omit<TimerEvent, 'timestamp'>) => void
  lastEvent: TimerEvent | null
  activeTimers: Map<string, TimerEvent> // taskId -> current timer event
}

const WebSocketContext = createContext<WebSocketContextType | null>(null)

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<TimerEvent | null>(null)
  const [activeTimers, setActiveTimers] = useState<Map<string, TimerEvent>>(new Map())

  useEffect(() => {
    if (!session?.user?.id) return

    // Simular conexão ativa
    setIsConnected(true)

    // Se for admin, fazer polling para eventos
    if (session.user.role === 'ADMIN') {
      const pollEvents = async () => {
        try {
          const response = await fetch(`/api/timer-events/poll?userId=${session.user.id}&userRole=${session.user.role}`)
          if (response.ok) {
            const events = await response.json()
            if (events.length > 0) {
              const latestEvent = events[events.length - 1]
              setLastEvent(latestEvent)
              
              // Atualizar timers ativos
              setActiveTimers(prev => {
                const newMap = new Map(prev)
                
                events.forEach((timerEvent: TimerEvent) => {
                  if (timerEvent.type === 'timer_start' || timerEvent.type === 'timer_update') {
                    newMap.set(timerEvent.taskId, timerEvent)
                  } else if (timerEvent.type === 'timer_pause') {
                    // Manter evento de pausa para mostrar estado pausado
                    newMap.set(timerEvent.taskId, timerEvent)
                  } else if (timerEvent.type === 'timer_stop' || timerEvent.type === 'task_complete') {
                    newMap.delete(timerEvent.taskId)
                  }
                })
                
                return newMap
              })
            }
          }
        } catch (error) {
          console.error('Erro ao buscar eventos:', error)
          setIsConnected(false)
        }
      }

      // Polling inicial e depois a cada 5 segundos (apenas para eventos importantes)
      pollEvents()
      const interval = setInterval(pollEvents, 5000)

      return () => {
        clearInterval(interval)
        setIsConnected(false)
      }
    }

    return () => {
      setIsConnected(false)
    }
  }, [session?.user?.id, session?.user?.role])

  const sendTimerEvent = async (event: Omit<TimerEvent, 'timestamp'>) => {
    try {
      await fetch('/api/timer-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...event,
          timestamp: new Date().toISOString()
        })
      })
    } catch (error) {
      console.error('Erro ao enviar evento de timer:', error)
    }
  }

  return (
    <WebSocketContext.Provider value={{
      isConnected,
      sendTimerEvent,
      lastEvent,
      activeTimers
    }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocketContext deve ser usado dentro de WebSocketProvider')
  }
  return context
}

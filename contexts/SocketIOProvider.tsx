'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSession } from 'next-auth/react'
import type { Socket } from 'socket.io-client'
import {
  authenticateTeamSocket,
  ensureTeamSocket,
  getTeamSocket,
  subscribeSocketStatus,
} from '@/lib/team-socket'

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

type SocketIOContextValue = {
  socket: Socket | null
  isConnected: boolean
  sendTimerEvent: (event: Omit<TimerEvent, 'timestamp'>) => void
  lastEvent: TimerEvent | null
  activeTimers: Map<string, TimerEvent>
}

const SocketIOContext = createContext<SocketIOContextValue | null>(null)

export function SocketIOProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [socket, setSocket] = useState<Socket | null>(() => getTeamSocket())
  const [isConnected, setIsConnected] = useState(() => Boolean(getTeamSocket()?.connected))
  const [lastEvent, setLastEvent] = useState<TimerEvent | null>(null)
  const [activeTimers, setActiveTimers] = useState<Map<string, TimerEvent>>(new Map())
  const timerHandlersBoundRef = useRef(false)
  const sessionUserRef = useRef(session?.user)
  sessionUserRef.current = session?.user

  useEffect(() => subscribeSocketStatus(setIsConnected), [])

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return

    let cancelled = false

    ensureTeamSocket()
      .then((instance) => {
        if (cancelled) return
        setSocket(instance)
        setIsConnected(instance.connected)
        authenticateTeamSocket(session.user)

        if (timerHandlersBoundRef.current) return
        timerHandlersBoundRef.current = true

        instance.on('connect', () => {
          const user = sessionUserRef.current
          if (user?.id) authenticateTeamSocket(user)
        })

        instance.on('authenticated', () => {
          const user = sessionUserRef.current
          if (user?.id) authenticateTeamSocket(user)
        })

        instance.on('timer_event', (event: TimerEvent) => {
          setLastEvent(event)
          setActiveTimers((prev) => {
            const next = new Map(prev)
            if (event.type === 'timer_start' || event.type === 'timer_update') {
              next.set(event.taskId, event)
            } else if (event.type === 'timer_pause') {
              next.set(event.taskId, { ...event, isPaused: true })
            } else if (event.type === 'timer_stop' || event.type === 'task_complete') {
              next.delete(event.taskId)
            }
            return next
          })
        })

        instance.on('active_timers', (timers: TimerEvent[]) => {
          setActiveTimers(new Map(timers.map((timer) => [timer.taskId, timer])))
        })
      })
      .catch(() => {
        if (!cancelled) setIsConnected(Boolean(getTeamSocket()?.connected))
      })

    return () => {
      cancelled = true
    }
  }, [status, session?.user?.id])

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return
    authenticateTeamSocket(session.user)
  }, [status, session?.user?.id, session?.user?.name, session?.user?.role])

  const sendTimerEvent = useCallback((event: Omit<TimerEvent, 'timestamp'>) => {
    const instance = getTeamSocket()
    if (!instance?.connected) return
    instance.emit('timer_event', {
      ...event,
      timestamp: new Date().toISOString(),
    })
  }, [])

  const value = useMemo(
    () => ({
      socket,
      isConnected,
      sendTimerEvent,
      lastEvent,
      activeTimers,
    }),
    [socket, isConnected, sendTimerEvent, lastEvent, activeTimers]
  )

  return <SocketIOContext.Provider value={value}>{children}</SocketIOContext.Provider>
}

export function useSocketIOContext() {
  const ctx = useContext(SocketIOContext)
  if (!ctx) {
    throw new Error('useSocketIOContext deve ser usado dentro de SocketIOProvider')
  }
  return ctx
}

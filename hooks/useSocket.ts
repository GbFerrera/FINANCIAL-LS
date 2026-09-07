'use client'

import { useSocketIOContext } from '@/contexts/SocketIOProvider'

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
  socket: ReturnType<typeof useSocketIOContext>['socket']
  isConnected: boolean
  sendTimerEvent: (event: Omit<TimerEvent, 'timestamp'>) => void
  lastEvent: TimerEvent | null
  activeTimers: Map<string, TimerEvent>
}

export function useSocket(): UseSocketReturn {
  return useSocketIOContext()
}

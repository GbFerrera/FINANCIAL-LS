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

// Store global para eventos (em produção, usar Redis ou similar)
let eventStore: TimerEvent[] = []

export function addEventToStore(event: TimerEvent) {
  eventStore.push(event)
  
  // Limitar tamanho do store
  if (eventStore.length > 1000) {
    eventStore.splice(0, eventStore.length - 1000)
  }
}

export function getRecentEvents(sinceTimestamp: number): TimerEvent[] {
  return eventStore.filter(event => {
    const eventTime = new Date(event.timestamp).getTime()
    return eventTime > sinceTimestamp
  }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

export function getAllEvents(): TimerEvent[] {
  return [...eventStore]
}

export { eventStore }
export type { TimerEvent }

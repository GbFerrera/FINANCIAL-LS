'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Play, Pause, Square, CheckCircle2, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useSocket } from '@/hooks/useSocket'

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

export function TimerEventsLog() {
  const [events, setEvents] = useState<TimerEvent[]>([])
  const { lastEvent, isConnected } = useSocket()

  useEffect(() => {
    if (lastEvent) {
      setEvents(prev => {
        // Adicionar novo evento no início da lista
        const newEvents = [lastEvent, ...prev]
        // Manter apenas os últimos 50 eventos
        return newEvents.slice(0, 50)
      })
    }
  }, [lastEvent])

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'timer_start':
        return <Play className="w-4 h-4 text-green-600 dark:text-green-400" />
      case 'timer_pause':
        return <Pause className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
      case 'timer_stop':
        return <Square className="w-4 h-4 text-red-600 dark:text-red-400" />
      case 'task_complete':
        return <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      case 'timer_update':
        return <Clock className="w-4 h-4 text-muted-foreground" />
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case 'timer_start':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
      case 'timer_pause':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
      case 'timer_stop':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
      case 'task_complete':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
      case 'timer_update':
        return 'bg-secondary text-muted-foreground'
      default:
        return 'bg-secondary text-muted-foreground'
    }
  }

  const getEventText = (event: TimerEvent) => {
    switch (event.type) {
      case 'timer_start':
        return 'iniciou'
      case 'timer_pause':
        return `pausou em ${formatDuration(event.duration || 0)}`
      case 'timer_stop':
        return `parou em ${formatDuration(event.duration || 0)}`
      case 'task_complete':
        return 'concluiu'
      case 'timer_update':
        return `trabalhando há ${formatDuration(event.duration || 0)}`
      default:
        return 'evento'
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`
    }
    return `${secs}s`
  }

  // Filtrar eventos de update para mostrar apenas a cada 10 segundos
  const filteredEvents = events.filter(event => {
    if (event.type === 'timer_update') {
      return (event.duration || 0) % 10 === 0 // Mostrar apenas múltiplos de 10 segundos
    }
    return true
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          Log de Eventos em Tempo Real
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredEvents.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">
          Nenhum evento registrado ainda
        </p>
      ) : (
        filteredEvents.map((event, index) => (
          <div
            key={`${event.taskId}-${event.timestamp}-${index}`}
            className="flex items-center gap-3 p-2 bg-card/50 rounded-lg"
          >
            {getEventIcon(event.type)}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{event.userName}</span>
                <Badge className={`text-xs ${getEventColor(event.type)}`}>
                  {getEventText(event)}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {event.taskTitle} • {event.projectName}
                {event.sprintName && ` • ${event.sprintName}`}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {format(new Date(event.timestamp), 'HH:mm:ss', { locale: ptBR })}
            </div>
          </div>
        ))
      )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

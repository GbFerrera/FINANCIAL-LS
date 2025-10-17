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
        return <Play className="w-4 h-4 text-green-600" />
      case 'timer_pause':
        return <Pause className="w-4 h-4 text-yellow-600" />
      case 'timer_stop':
        return <Square className="w-4 h-4 text-red-600" />
      case 'task_complete':
        return <CheckCircle2 className="w-4 h-4 text-blue-600" />
      case 'timer_update':
        return <Clock className="w-4 h-4 text-gray-400" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case 'timer_start':
        return 'bg-green-100 text-green-800'
      case 'timer_pause':
        return 'bg-yellow-100 text-yellow-800'
      case 'timer_stop':
        return 'bg-red-100 text-red-800'
      case 'task_complete':
        return 'bg-blue-100 text-blue-800'
      case 'timer_update':
        return 'bg-gray-100 text-gray-600'
      default:
        return 'bg-gray-100 text-gray-600'
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
            <p className="text-gray-500 text-center py-4">
              Nenhum evento registrado ainda
            </p>
          ) : (
            filteredEvents.map((event, index) => (
              <div
                key={`${event.taskId}-${event.timestamp}-${index}`}
                className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
              >
                {getEventIcon(event.type)}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{event.userName}</span>
                    <Badge className={`text-xs ${getEventColor(event.type)}`}>
                      {getEventText(event)}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-600">
                    {event.taskTitle} • {event.projectName}
                    {event.sprintName && ` • ${event.sprintName}`}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {format(new Date(event.timestamp), 'HH:mm:ss', { locale: ptBR })}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Play, 
  Pause, 
  Square, 
  CheckCircle2, 
  Clock, 
  User, 
  Calendar,
  Filter,
  Download
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface TimerEventHistoryProps {
  userId?: string
  taskId?: string
  limit?: number
}

interface TimerEventDB {
  id: string
  type: string
  userId: string
  userName: string
  taskId: string
  taskTitle: string
  projectName: string
  sprintName?: string
  duration?: number
  totalTime?: number
  isPaused: boolean
  pausedTime?: number
  sessionId?: string
  timestamp: string
  user: {
    id: string
    name: string
    email: string
  }
  task: {
    id: string
    title: string
    project: {
      id: string
      name: string
    }
  }
}

export function TimerEventHistory({ userId, taskId, limit = 50 }: TimerEventHistoryProps) {
  const [events, setEvents] = useState<TimerEventDB[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'start' | 'pause' | 'stop' | 'complete'>('all')

  useEffect(() => {
    fetchEvents()
  }, [userId, taskId, limit])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      
      let url = '/api/timer-events/history?'
      
      if (userId) {
        url += `type=user&userId=${userId}&limit=${limit}`
      } else if (taskId) {
        url += `type=task&taskId=${taskId}&limit=${limit}`
      } else {
        url += `type=recent&limit=${limit}`
      }

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setEvents(data.events)
      }
    } catch (error) {
      console.error('Erro ao buscar histórico:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'TIMER_START':
        return <Play className="w-4 h-4 text-green-600 dark:text-green-400" />
      case 'TIMER_PAUSE':
        return <Pause className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
      case 'TIMER_STOP':
        return <Square className="w-4 h-4 text-red-600 dark:text-red-400" />
      case 'TASK_COMPLETE':
        return <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      case 'TIMER_UPDATE':
        return <Clock className="w-4 h-4 text-muted-foreground" />
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case 'TIMER_START':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
      case 'TIMER_PAUSE':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
      case 'TIMER_STOP':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
      case 'TASK_COMPLETE':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
      case 'TIMER_UPDATE':
        return 'bg-card text-muted-foreground'
      default:
        return 'bg-card text-muted-foreground'
    }
  }

  const getEventText = (event: TimerEventDB) => {
    switch (event.type) {
      case 'TIMER_START':
        return 'iniciou'
      case 'TIMER_PAUSE':
        return `pausou em ${formatDuration(event.duration || 0)}`
      case 'TIMER_STOP':
        return `parou em ${formatDuration(event.duration || 0)}`
      case 'TASK_COMPLETE':
        return 'concluiu'
      case 'TIMER_UPDATE':
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

  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true
    
    switch (filter) {
      case 'start':
        return event.type === 'TIMER_START'
      case 'pause':
        return event.type === 'TIMER_PAUSE'
      case 'stop':
        return event.type === 'TIMER_STOP'
      case 'complete':
        return event.type === 'TASK_COMPLETE'
      default:
        return true
    }
  })

  const exportToCSV = () => {
    const csvContent = [
      ['Data/Hora', 'Usuário', 'Evento', 'Tarefa', 'Projeto', 'Duração', 'Sprint'].join(','),
      ...filteredEvents.map(event => [
        format(new Date(event.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }),
        event.userName,
        getEventText(event),
        event.taskTitle,
        event.projectName,
        event.duration ? formatDuration(event.duration) : '',
        event.sprintName || ''
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timer-events-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Carregando histórico...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Histórico de Eventos
          </CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-1 border rounded-md text-sm bg-background text-foreground"
            >
              <option value="all">Todos</option>
              <option value="start">Início</option>
              <option value="pause">Pausa</option>
              <option value="stop">Parada</option>
              <option value="complete">Conclusão</option>
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={exportToCSV}
              className="flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredEvents.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhum evento encontrado
            </p>
          ) : (
            filteredEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 p-3 bg-card/50 rounded-lg hover:bg-card transition-colors"
              >
                {getEventIcon(event.type)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{event.userName}</span>
                    <Badge className={`text-xs ${getEventColor(event.type)}`}>
                      {getEventText(event)}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <div className="font-medium">{event.taskTitle}</div>
                    <div className="text-muted-foreground">
                      {event.projectName}
                      {event.sprintName && ` • ${event.sprintName}`}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(event.timestamp), 'dd/MM HH:mm:ss', { locale: ptBR })}
                  </div>
                  {event.sessionId && (
                    <div className="text-xs text-muted-foreground font-mono">
                      {event.sessionId.slice(-6)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        {filteredEvents.length > 0 && (
          <div className="mt-4 pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground">
              Mostrando {filteredEvents.length} de {events.length} eventos
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

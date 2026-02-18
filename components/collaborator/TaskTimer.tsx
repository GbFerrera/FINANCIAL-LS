'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Play, 
  Pause, 
  Square, 
  Clock,
  CheckCircle2
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useSocket } from '@/hooks/useSocket'

interface TaskTimerProps {
  taskId: string
  taskTitle: string
  currentStatus: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'
  userId: string
  onStatusChange?: () => void
}

interface TimeEntry {
  id: string
  startTime: string
  endTime?: string
  duration?: number
}

export function TaskTimer({ taskId, taskTitle, currentStatus, userId, onStatusChange }: TaskTimerProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [totalTime, setTotalTime] = useState(0)
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null)
  const [projectName, setProjectName] = useState('')
  const [sprintName, setSprintName] = useState('')
  const [userName, setUserName] = useState('')
  const [isPaused, setIsPaused] = useState(false)
  const [pausedTime, setPausedTime] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const { sendTimerEvent, isConnected } = useSocket()

  // Debug logs
  console.log('TaskTimer props:', { taskId, taskTitle, currentStatus, userId })
  console.log('Socket status:', { isConnected })

  useEffect(() => {
    fetchTimeEntries()
    checkActiveTimer()
    fetchTaskData()
  }, [taskId])

  const fetchTaskData = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`)
      if (response.ok) {
        const task = await response.json()
        setProjectName(task.project?.name || '')
        setSprintName(task.sprint?.name || '')
        setUserName(task.assignee?.name || '')
      }
    } catch (error) {
      console.error('Erro ao buscar dados da tarefa:', error)
    }
  }

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1
          
          // Enviar evento de atualização em tempo real via WebSocket
          if (isConnected) {
            sendTimerEvent({
              type: 'timer_update',
              userId,
              userName,
              taskId,
              taskTitle,
              projectName,
              sprintName,
              duration: newTime
            })
          }
          
          return newTime
        })
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, isConnected, userId, userName, taskId, taskTitle, projectName, sprintName, sendTimerEvent])

  const fetchTimeEntries = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/time-entries`)
      if (response.ok) {
        const entries = await response.json()
        const total = entries.reduce((sum: number, entry: TimeEntry) => {
          return sum + (entry.duration || 0)
        }, 0)
        setTotalTime(total)
      }
    } catch (error) {
      console.error('Erro ao buscar entradas de tempo:', error)
    }
  }

  const checkActiveTimer = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/active-timer`)
      if (response.ok) {
        const data = await response.json()
        if (data.activeEntry) {
          setCurrentEntry(data.activeEntry)
          setIsRunning(true)
          const startTime = new Date(data.activeEntry.startTime).getTime()
          const now = new Date().getTime()
          setElapsedTime(Math.floor((now - startTime) / 1000))
        }
      }
    } catch (error) {
      console.error('Erro ao verificar timer ativo:', error)
    }
  }

  const startTimer = async () => {
    console.log('Iniciando timer para tarefa:', taskId, 'usuário:', userId)
    
    if (!userId) {
      console.error('UserId não fornecido!')
      toast.error('Erro: ID do usuário não encontrado')
      return
    }
    
    try {
      console.log('Fazendo requisição para start-timer...')
      const response = await fetch(`/api/tasks/${taskId}/start-timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      
      console.log('Resposta da API start-timer:', response.status)

      if (response.ok) {
        const entry = await response.json()
        setCurrentEntry(entry)
        setIsRunning(true)
        setIsPaused(false) // Limpar estado de pausa
        setPausedTime(0) // Resetar tempo pausado
        setElapsedTime(0)
        
        // Atualizar status da tarefa para IN_PROGRESS se necessário
        if (currentStatus === 'TODO') {
          await updateTaskStatus('IN_PROGRESS')
        }
        
        // Emitir evento de início do timer
        sendTimerEvent({
          type: 'timer_start',
          userId,
          userName,
          taskId,
          taskTitle,
          projectName,
          sprintName,
          duration: 0
        })
        
        toast.success('Timer iniciado!')
      } else {
        toast.error('Erro ao iniciar timer')
      }
    } catch (error) {
      console.error('Erro ao iniciar timer:', error)
      toast.error('Erro ao iniciar timer')
    }
  }

  const pauseTimer = async () => {
    if (!currentEntry) return

    try {
      const response = await fetch(`/api/tasks/${taskId}/pause-timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: currentEntry.id })
      })

      if (response.ok) {
        setIsRunning(false)
        setIsPaused(true)
        setPausedTime(elapsedTime) // Salvar tempo pausado
        setCurrentEntry(null)
        
        // Emitir evento de pausa do timer
        sendTimerEvent({
          type: 'timer_pause',
          userId,
          userName,
          taskId,
          taskTitle,
          projectName,
          sprintName,
          duration: elapsedTime,
          isPaused: true,
          pausedTime: elapsedTime
        })
        
        setElapsedTime(0)
        await fetchTimeEntries()
        toast.success(`Timer pausado em ${formatTimeWithSeconds(elapsedTime)}!`)
      } else {
        toast.error('Erro ao pausar timer')
      }
    } catch (error) {
      console.error('Erro ao pausar timer:', error)
      toast.error('Erro ao pausar timer')
    }
  }

  const completeTask = async () => {
    if (isRunning) {
      await pauseTimer()
    }
    
    try {
      await updateTaskStatus('IN_REVIEW')
      
      // Emitir evento de conclusão da tarefa
      sendTimerEvent({
        type: 'task_complete',
        userId,
        userName,
        taskId,
        taskTitle,
        projectName,
        sprintName,
        totalTime: Math.floor(totalTime / 60) // converter para minutos
      })
      
      toast.success('Tarefa enviada para revisão!')
    } catch (error) {
      toast.error('Erro ao enviar para revisão')
    }
  }

  const updateTaskStatus = async (status: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })

      if (response.ok) {
        if (onStatusChange) {
          onStatusChange()
        }
        toast.success(`Status atualizado para: ${status === 'IN_PROGRESS' ? 'Em Progresso' : status === 'IN_REVIEW' ? 'Para Revisar' : status === 'COMPLETED' ? 'Concluída' : 'A Fazer'}`)
      } else {
        toast.error('Erro ao atualizar status da tarefa')
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      toast.error('Erro ao atualizar status da tarefa')
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const formatTimeWithSeconds = (seconds: number) => {
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

  const formatTotalTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`
    }
    return `${minutes}min`
  }

  if (currentStatus === 'COMPLETED') {
    return (
      <div className="text-center">
        <Badge variant="outline" className="text-green-600 bg-green-100 mb-2">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Concluída
        </Badge>
        {totalTime > 0 && (
          <div className="text-xs text-muted-foreground">
            Tempo total: {formatTotalTime(totalTime)}
          </div>
        )}
      </div>
    )
  }

  if (currentStatus === 'IN_REVIEW') {
    return (
      <div className="text-center">
        <Badge variant="outline" className="text-yellow-600 bg-yellow-100 mb-2">
          <Clock className="w-3 h-3 mr-1" />
          Para Revisar
        </Badge>
        {totalTime > 0 && (
          <div className="text-xs text-muted-foreground">
            Tempo total: {formatTotalTime(totalTime)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="text-center space-y-2">
      {/* Timer Display */}
      <div className="font-mono text-lg font-bold text-foreground">
        {isRunning ? formatTime(elapsedTime) : '00:00'}
      </div>
      
      {/* Total Time */}
      {totalTime > 0 && (
        <div className="text-xs text-muted-foreground">
          Total: {formatTotalTime(totalTime)}
        </div>
      )}
      
      {/* Controls */}
      {/* Connection Status */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className={`text-xs ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
          {isConnected ? 'Tempo Real Ativo' : 'Desconectado'}
        </span>
      </div>

      {/* Timer Display */}
      {isRunning && (
        <div className="text-center mb-3">
          <div className="text-lg font-bold text-blue-600 font-mono">
            {formatTime(elapsedTime)}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatTimeWithSeconds(elapsedTime)} - sessão atual
          </div>
        </div>
      )}

      {/* Paused State Display */}
      {isPaused && pausedTime > 0 && (
        <div className="text-center mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Pause className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">PAUSADO</span>
          </div>
          <div className="text-lg font-bold text-yellow-700 font-mono">
            {formatTime(pausedTime)}
          </div>
          <div className="text-xs text-yellow-600">
            Pausado em {formatTimeWithSeconds(pausedTime)}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-1 justify-center">
        {!isRunning ? (
          <Button
            size="sm"
            onClick={startTimer}
            className="bg-green-600 hover:bg-green-700"
          >
            <Play className="w-3 h-3" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={pauseTimer}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            <Pause className="w-3 h-3" />
          </Button>
        )}
        
        <Button
          size="sm"
          onClick={completeTask}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <CheckCircle2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}

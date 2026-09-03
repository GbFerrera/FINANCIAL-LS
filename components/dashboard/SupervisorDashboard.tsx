'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Users, 
  Clock, 
  Play, 
  Pause, 
  CheckCircle2,
  AlertCircle,
  Timer,
  Target,
  TrendingUp,
  Activity,
  User,
  Building2
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useSocket } from '@/hooks/useSocket'
import { TimerEventsLog } from './TimerEventsLog'
import { TimerEventHistory } from './TimerEventHistory'
import { CollaboratorStats } from './CollaboratorStats'

interface ActiveTask {
  id: string
  title: string
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  estimatedMinutes?: number
  actualMinutes?: number
  storyPoints?: number
  startTime?: string
  project: {
    id: string
    name: string
  }
  sprint?: {
    id: string
    name: string
  }
  assignee: {
    id: string
    name: string
    email: string
  }
  timeEntries: Array<{
    id: string
    startTime: string
    endTime?: string
    duration?: number
  }>
}

interface CollaboratorActivity {
  userId: string
  userName: string
  userEmail: string
  isActive: boolean
  currentTask?: ActiveTask
  todayStats: {
    tasksCompleted: number
    timeWorked: number // em minutos
    tasksInProgress: number
  }
}

export function SupervisorDashboard() {
  const [activities, setActivities] = useState<CollaboratorActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const { lastEvent, activeTimers, isConnected } = useSocket()

  useEffect(() => {
    fetchActivities()
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchActivities, 30000)
    
    return () => clearInterval(interval)
  }, [])

  // Timer para atualizar contagem visual a cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    
    return () => clearInterval(timer)
  }, [])

  // Processar eventos em tempo real
  useEffect(() => {
    if (lastEvent) {
      setLastUpdate(new Date())
      
      // Atualizar atividades baseado no evento
      setActivities(prev => {
        return prev.map(activity => {
          if (activity.userId === lastEvent.userId) {
            const updatedActivity = { ...activity }
            
            if (lastEvent.type === 'timer_start') {
              updatedActivity.isActive = true
              updatedActivity.currentTask = {
                id: lastEvent.taskId,
                title: lastEvent.taskTitle,
                status: 'IN_PROGRESS' as const,
                priority: 'MEDIUM' as const,
                project: { id: '', name: lastEvent.projectName },
                sprint: lastEvent.sprintName ? { id: '', name: lastEvent.sprintName } : undefined,
                assignee: { id: lastEvent.userId, name: lastEvent.userName, email: '' },
                timeEntries: []
              }
            } else if (lastEvent.type === 'timer_pause') {
              updatedActivity.isActive = false
              // Manter tarefa atual mas marcar como pausada
              if (updatedActivity.currentTask) {
                updatedActivity.currentTask = {
                  ...updatedActivity.currentTask,
                  status: 'TODO' as const // Usar TODO para indicar pausado
                }
              }
            } else if (lastEvent.type === 'timer_stop') {
              updatedActivity.isActive = false
              updatedActivity.currentTask = undefined
            } else if (lastEvent.type === 'task_complete') {
              updatedActivity.isActive = false
              updatedActivity.currentTask = undefined
              updatedActivity.todayStats.tasksCompleted += 1
              updatedActivity.todayStats.tasksInProgress = Math.max(0, updatedActivity.todayStats.tasksInProgress - 1)
            }
            
            return updatedActivity
          }
          return activity
        })
      })
    }
  }, [lastEvent])

  const fetchActivities = async () => {
    try {
      const response = await fetch('/api/supervisor/collaborator-activities')
      if (response.ok) {
        const data = await response.json()
        setActivities(data.activities)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Erro ao carregar atividades:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-500 dark:bg-red-600'
      case 'HIGH': return 'bg-orange-500 dark:bg-orange-600'
      case 'MEDIUM': return 'bg-yellow-500 dark:bg-yellow-600'
      case 'LOW': return 'bg-green-500 dark:bg-green-600'
    default: return 'bg-card text-muted-foreground'
  }
}

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20'
      case 'IN_PROGRESS': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20'
      case 'TODO': return 'text-muted-foreground bg-card'
      default: return 'text-muted-foreground bg-card'
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}min`
    }
    return `${mins}min`
  }

  const getActiveTimeEntry = (task: ActiveTask) => {
    return task.timeEntries.find(entry => !entry.endTime)
  }

  const calculateCurrentSessionTime = (task: ActiveTask) => {
    // Verificar se há timer ativo para esta tarefa via WebSocket
    const activeTimer = activeTimers.get(task.id)
    
    // Se está pausado, retornar tempo pausado
    if (activeTimer?.isPaused && activeTimer.pausedTime) {
      return activeTimer.pausedTime
    }
    
    // Se há timer ativo com duração em tempo real
    if (activeTimer && activeTimer.duration !== undefined) {
      return activeTimer.duration // Tempo em segundos vindo do WebSocket
    }
    
    // Fallback para método anterior usando time entries
    const activeEntry = getActiveTimeEntry(task)
    if (!activeEntry) return 0
    
    const startTime = new Date(activeEntry.startTime).getTime()
    const now = new Date().getTime()
    return Math.floor((now - startTime) / 1000)
  }

  const formatTimeInSeconds = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const activeCollaborators = activities.filter(a => a.isActive).length
  const totalTasksInProgress = activities.reduce((sum, a) => sum + a.todayStats.tasksInProgress, 0)
  const totalTasksCompleted = activities.reduce((sum, a) => sum + a.todayStats.tasksCompleted, 0)
  const totalTimeWorked = activities.reduce((sum, a) => sum + a.todayStats.timeWorked, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard do Supervisor</h2>
          <p className="text-muted-foreground">
            Acompanhe o progresso da equipe em tempo real
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
              {isConnected ? 'Tempo Real Ativo' : 'Desconectado'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="w-4 h-4" />
            Última atualização: {format(lastUpdate, 'HH:mm:ss')}
            <Button variant="outline" size="sm" onClick={fetchActivities}>
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Colaboradores Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{activeCollaborators}</div>
            <p className="text-xs text-muted-foreground">
              de {activities.length} colaboradores
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tarefas em Progresso</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalTasksInProgress}</div>
            <p className="text-xs text-muted-foreground">
              sendo executadas agora
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas Hoje</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{totalTasksCompleted}</div>
            <p className="text-xs text-muted-foreground">
              tarefas finalizadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Total</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatDuration(totalTimeWorked)}</div>
            <p className="text-xs text-muted-foreground">
              trabalhado hoje
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Layout com três seções */}
      <div className="">
        {/* Atividades dos Colaboradores */}
        <div className="xl:col-span-5 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Atividade dos Colaboradores</h3>
          
          {activities.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma atividade encontrada</h3>
                <p className="text-muted-foreground">Não há colaboradores com atividade no momento.</p>
              </CardContent>
            </Card>
        ) : (
          activities.map(activity => (
            <div key={activity.userId} className="space-y-4">
              <Card className={`${activity.isActive ? 'ring-2 ring-green-500 dark:ring-green-400 bg-green-50/50 dark:bg-green-900/10' : ''}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${activity.isActive ? 'bg-green-500' : 'bg-card-foreground'}`} />
                      <div>
                        <CardTitle className="text-lg">{activity.userName}</CardTitle>
                        <CardDescription>{activity.userEmail}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedUserId(selectedUserId === activity.userId ? null : activity.userId)}
                        className="text-xs"
                      >
                        {selectedUserId === activity.userId ? 'Ocultar' : 'Ver Stats'}
                      </Button>
                      <Badge variant={activity.isActive ? 'default' : 'secondary'}>
                        {activity.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-4">
                    {/* Tarefa Atual */}
                    {activity.currentTask ? (
                      <div className="border rounded-lg p-4 bg-blue-50/50 dark:bg-blue-900/10">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium text-blue-900 dark:text-blue-100">{activity.currentTask.title}</h4>
                              <Badge 
                                variant={activity.currentTask.status === 'IN_PROGRESS' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {activity.currentTask.status === 'IN_PROGRESS' ? 'Em Progresso' : 'Pausado'}
                              </Badge>
                            </div>
                            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                              <div className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {activity.currentTask.project?.name}
                              </div>
                              {activity.currentTask.sprint && (
                                <div className="flex items-center gap-1">
                                  <Target className="w-3 h-3" />
                                  {activity.currentTask.sprint.name}
                                </div>
                              )}
                              {activity.currentTask.estimatedMinutes && (
                                <span className="flex items-center gap-1">
                                  <Timer className="w-3 h-3" />
                                  {formatDuration(activity.currentTask.estimatedMinutes)} estimado
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-right">
                            {/* Verificar se está pausado */}
                            {activeTimers.get(activity.currentTask.id)?.isPaused ? (
                              <div>
                                <div className="flex items-center justify-end gap-1 mb-1">
                                  <Pause className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                                  <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">PAUSADO</span>
                                </div>
                                <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400 font-mono">
                                  {formatTimeInSeconds(activeTimers.get(activity.currentTask.id)?.pausedTime || 0)}
                                </div>
                                <div className="text-xs text-yellow-600 dark:text-yellow-400">pausado em</div>
                              </div>
                            ) : (
                              <div>
                                <div className="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono">
                                  {formatTimeInSeconds(calculateCurrentSessionTime(activity.currentTask))}
                                </div>
                                <div className="text-xs text-muted-foreground">tempo atual</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-4 bg-card/50 text-center">
                        <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">Nenhuma tarefa em andamento</p>
                      </div>
                    )}

                    {/* Estatísticas do Dia */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">{activity.todayStats.tasksCompleted}</div>
                        <div className="text-xs text-muted-foreground">Concluídas</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{activity.todayStats.tasksInProgress}</div>
                        <div className="text-xs text-muted-foreground">Em Progresso</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{formatDuration(activity.todayStats.timeWorked)}</div>
                        <div className="text-xs text-muted-foreground">Tempo Hoje</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Estatísticas Detalhadas */}
              {selectedUserId === activity.userId && (
                <CollaboratorStats 
                  userId={activity.userId} 
                  userName={activity.userName} 
                />
              )}
            </div>
          ))
        )}
        </div>

       
      </div>
    </div>
  )
}

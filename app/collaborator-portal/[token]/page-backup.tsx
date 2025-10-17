'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Pause,
  Square,
  Timer,
  TrendingUp,
  User,
  Building2,
  Target,
  Award,
  Filter,
  Grid,
  List
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { calculateEstimatedTime } from '@/lib/time-utils'
import { ContributionHeatmap } from '@/components/dashboard/contribution-heatmap'
import { WeeklySprintView } from '@/components/collaborator/WeeklySprintView'

interface Task {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate?: string
  estimatedHours?: number
  actualHours?: number
  startTime?: string
  endTime?: string
  createdAt: string
  updatedAt: string
  project: {
    id: string
    name: string
    client: {
      name: string
    }
  }
  milestone?: {
    id: string
    name: string
  }
}

interface CollaboratorData {
  user: {
    name: string
    email: string
  }
  tasks: {
    today: Task[]
    overdue: Task[]
    inProgress: Task[]
    completed: Task[]
  }
  summary: {
    total: number
    today: number
    overdue: number
    inProgress: number
    completed: number
    totalEstimatedHours: number
    totalActualHours: number
  }
  stats: {
    totalTasks: number
    completedTasks: number
    totalEstimatedHours: number
    totalActualHours: number
    efficiency: number
  }
}

interface TimeTracker {
  taskId: string
  startTime: number
  elapsedTime: number
  isPaused: boolean
  pausedAt?: number
  totalPausedTime: number
  duration: number // duração total em segundos
}

export default function CollaboratorPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params)
  const [data, setData] = useState<CollaboratorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [timeTrackers, setTimeTrackers] = useState<Map<string, TimeTracker>>(new Map())
  const [activeTimer, setActiveTimer] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'sections' | 'unified' | 'weekly'>('weekly')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/collaborator-portal/${resolvedParams.token}?date=${selectedDate}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao carregar dados')
      }
      
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
      setError(error instanceof Error ? error.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [selectedDate, resolvedParams.token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (activeTimer) {
      interval = setInterval(() => {
        setTimeTrackers(prev => {
          const newTrackers = new Map(prev)
          const tracker = newTrackers.get(activeTimer)
          if (tracker && !tracker.isPaused) {
            const currentTime = Date.now()
            const totalElapsed = Math.floor((currentTime - tracker.startTime) / 1000)
            tracker.elapsedTime = totalElapsed - tracker.totalPausedTime
            tracker.duration = tracker.elapsedTime
            newTrackers.set(activeTimer, tracker)
          }
          // Se estiver pausado, não atualiza o elapsedTime, mantém o valor atual
          return newTrackers
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [activeTimer])

  const startTimer = async (taskId: string) => {
    if (activeTimer && activeTimer !== taskId) {
      await stopTimer(activeTimer)
    }
    
    try {
      const response = await fetch(`/api/collaborator-portal/${resolvedParams.token}/time-entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taskId,
          action: 'start'
        })
      })
      
      if (response.ok) {
        const now = Date.now()
        setTimeTrackers(prev => {
          const newTrackers = new Map(prev)
          newTrackers.set(taskId, {
            taskId,
            startTime: now,
            elapsedTime: 0,
            isPaused: false,
            totalPausedTime: 0,
            duration: 0
          })
          return newTrackers
        })
        setActiveTimer(taskId)
      } else {
        console.error('Erro ao iniciar cronômetro')
      }
    } catch (error) {
      console.error('Erro ao iniciar cronômetro:', error)
    }
  }

  const pauseTimer = async (taskId: string) => {
    const tracker = timeTrackers.get(taskId)
    if (tracker && !tracker.isPaused) {
      try {
        const response = await fetch(`/api/collaborator-portal/${resolvedParams.token}/time-entries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            taskId,
            action: 'pause'
          })
        })
        
        if (response.ok) {
          setTimeTrackers(prev => {
            const newTrackers = new Map(prev)
            const currentTracker = newTrackers.get(taskId)
            if (currentTracker) {
              const pausedTime = Date.now()
              newTrackers.set(taskId, {
                ...currentTracker,
                isPaused: true,
                pausedAt: pausedTime
              })
            }
            return newTrackers
          })
        } else {
          console.error('Erro ao pausar cronômetro')
        }
      } catch (error) {
        console.error('Erro ao pausar cronômetro:', error)
      }
    }
  }

  const resumeTimer = async (taskId: string) => {
    const tracker = timeTrackers.get(taskId)
    if (tracker && tracker.isPaused && tracker.pausedAt) {
      try {
        const response = await fetch(`/api/collaborator-portal/${resolvedParams.token}/time-entries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            taskId,
            action: 'resume'
          })
        })
        
        if (response.ok) {
          setTimeTrackers(prev => {
            const newTrackers = new Map(prev)
            const currentTracker = newTrackers.get(taskId)
            if (currentTracker && currentTracker.pausedAt) {
              const pausedDuration = Math.floor((Date.now() - currentTracker.pausedAt) / 1000)
              newTrackers.set(taskId, {
                ...currentTracker,
                totalPausedTime: currentTracker.totalPausedTime + pausedDuration,
                isPaused: false,
                pausedAt: undefined
              })
            }
            return newTrackers
          })
        } else {
          console.error('Erro ao retomar cronômetro')
        }
      } catch (error) {
        console.error('Erro ao retomar cronômetro:', error)
      }
    }
  }

  const stopTimer = async (taskId: string) => {
    const tracker = timeTrackers.get(taskId)
    if (tracker) {
      try {
        const response = await fetch(`/api/collaborator-portal/${resolvedParams.token}/time-entries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            taskId,
            action: 'stop'
          })
        })
        
        if (response.ok) {
          fetchData() // Refresh data
        } else {
          console.error('Erro ao parar cronômetro')
        }
      } catch (error) {
        console.error('Erro ao parar cronômetro:', error)
      }
    }
    
    setTimeTrackers(prev => {
      const newTrackers = new Map(prev)
      newTrackers.delete(taskId)
      return newTrackers
    })
    
    if (activeTimer === taskId) {
      setActiveTimer(null)
    }
  }

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      const response = await fetch(`/api/collaborator-portal/${resolvedParams.token}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ taskId, status })
      })
      
      if (response.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
    }
  }

  const getCurrentTask = (taskId: string): Task | undefined => {
    if (!data) return undefined
    return [...data.tasks.today, ...data.tasks.overdue, ...data.tasks.inProgress, ...data.tasks.completed]
      .find(task => task.id === taskId)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-500'
      case 'HIGH': return 'bg-orange-500'
      case 'MEDIUM': return 'bg-yellow-500'
      case 'LOW': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO': return 'bg-gray-500'
      case 'IN_PROGRESS': return 'bg-blue-500'
      case 'IN_REVIEW': return 'bg-purple-500'
      case 'COMPLETED': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const formatTime = (hours: number) => {
    const totalSeconds = Math.floor(hours * 3600)
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    
    if (h > 0) {
      return `${h}h ${m}m ${s}s`
    } else if (m > 0) {
      return `${m}m ${s}s`
    } else {
      return `${s}s`
    }
  }

  const formatElapsedTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Função para filtrar tasks
  const filterTasks = (tasks: Task[]) => {
    return tasks.filter(task => {
      const statusMatch = statusFilter === 'all' || task.status === statusFilter
      const priorityMatch = priorityFilter === 'all' || task.priority === priorityFilter
      return statusMatch && priorityMatch
    })
  }

  // Função para obter todas as tasks filtradas
  const getAllFilteredTasks = () => {
    if (!data) return []
    
    const allTasks = [
      ...data.tasks.today,
      ...data.tasks.overdue,
      ...data.tasks.inProgress,
      ...data.tasks.completed
    ]
    
    // Remove duplicatas (uma task pode aparecer em múltiplas categorias)
    const uniqueTasks = allTasks.filter((task, index, self) => 
      index === self.findIndex(t => t.id === task.id)
    )
    
    return filterTasks(uniqueTasks).sort((a, b) => {
      // Ordenação: TODO primeiro, depois por prioridade, depois por data
      const statusOrder = { 'TODO': 0, 'IN_PROGRESS': 1, 'IN_REVIEW': 2, 'COMPLETED': 3 }
      const priorityOrder = { 'URGENT': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 }
      
      if (a.status !== b.status) {
        return statusOrder[a.status] - statusOrder[b.status]
      }
      
      if (a.priority !== b.priority) {
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      }
      
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      }
      
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Erro de Acesso</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{error}</p>
            <Button onClick={() => fetchData()} className="mt-4 w-full">
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Portal do Colaborador</h1>
              <p className="text-gray-600">
                Olá, {data.user.name}! Aqui estão suas atividades.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'weekly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('weekly')}
                  className="flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Semanal
                </Button>
                <Button
                  variant={viewMode === 'sections' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('sections')}
                  className="flex items-center gap-2"
                >
                  <List className="h-4 w-4" />
                  Lista
                </Button>
                <Button
                  onClick={() => window.location.href = `/collaborator-portal/${resolvedParams.token}/sprints`}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Target className="h-4 w-4" />
                  Sprints
                </Button>
              </div>
              {viewMode !== 'weekly' && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-auto"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters and View Controls */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Filtros:</span>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="min-w-[140px]">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Status</SelectItem>
                        <SelectItem value="TODO">A Fazer</SelectItem>
                        <SelectItem value="IN_PROGRESS">Em Progresso</SelectItem>
                        <SelectItem value="IN_REVIEW">Em Revisão</SelectItem>
                        <SelectItem value="COMPLETED">Concluído</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="min-w-[140px]">
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Prioridade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as Prioridades</SelectItem>
                        <SelectItem value="URGENT">Urgente</SelectItem>
                        <SelectItem value="HIGH">Alta</SelectItem>
                        <SelectItem value="MEDIUM">Média</SelectItem>
                        <SelectItem value="LOW">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 border rounded-lg p-1 bg-gray-50">
                <Button
                  variant={viewMode === 'sections' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('sections')}
                  className="h-8 px-3"
                >
                  <Grid className="h-4 w-4 mr-1" />
                  Seções
                </Button>
                <Button
                  variant={viewMode === 'unified' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('unified')}
                  className="h-8 px-3"
                >
                  <List className="h-4 w-4 mr-1" />
                  Lista
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tarefas de Hoje</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.today}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Atraso</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{data.summary.overdue}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Horas Trabalhadas</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatTime(data.summary.totalActualHours)}
              </div>
              <p className="text-xs text-muted-foreground">
                de {formatTime(data.summary.totalEstimatedHours)} estimadas
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Eficiência</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.efficiency}%</div>
              <p className="text-xs text-muted-foreground">
                {data.stats.completedTasks} de {data.stats.totalTasks} concluídas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Content based on view mode */}
        {viewMode === 'weekly' ? (
          <WeeklySprintView token={resolvedParams.token} />
        ) : (
          <>
            {/* Contribution Heatmap */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Atividades Concluídas</CardTitle>
                <CardDescription>
                  Visualize suas contribuições diárias ao longo do tempo
                </CardDescription>
              </CardHeader>
              <CardContent>
                 <ContributionHeatmap 
                   token={resolvedParams.token}
                 />
               </CardContent>
            </Card>

            {/* Tasks Sections */}
            <div className="space-y-6">
              {viewMode === 'sections' ? (
            <>
              {/* Today's Tasks */}
              {filterTasks(data.tasks.today).length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold mb-4 text-gray-900">
                    Tarefas de Hoje ({filterTasks(data.tasks.today).length})
                  </h2>
                  <div className="space-y-4">
                    {filterTasks(data.tasks.today).map((task) => (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        timeTracker={timeTrackers.get(task.id)}
                        isActive={activeTimer === task.id}
                        onStartTimer={() => startTimer(task.id)}
                        onPauseTimer={() => pauseTimer(task.id)}
                        onResumeTimer={() => resumeTimer(task.id)}
                        onStopTimer={() => stopTimer(task.id)}
                        onUpdateStatus={updateTaskStatus}
                        getPriorityColor={getPriorityColor}
                        getStatusColor={getStatusColor}
                        formatTime={formatTime}
                        formatElapsedTime={formatElapsedTime}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Overdue Tasks */}
              {filterTasks(data.tasks.overdue).length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold mb-4 text-red-600">
                    Tarefas Atrasadas ({filterTasks(data.tasks.overdue).length})
                  </h2>
                  <div className="space-y-4">
                    {filterTasks(data.tasks.overdue).map((task) => (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        timeTracker={timeTrackers.get(task.id)}
                        isActive={activeTimer === task.id}
                        onStartTimer={() => startTimer(task.id)}
                        onPauseTimer={() => pauseTimer(task.id)}
                        onResumeTimer={() => resumeTimer(task.id)}
                        onStopTimer={() => stopTimer(task.id)}
                        onUpdateStatus={updateTaskStatus}
                        getPriorityColor={getPriorityColor}
                        getStatusColor={getStatusColor}
                        formatTime={formatTime}
                        formatElapsedTime={formatElapsedTime}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* In Progress Tasks */}
              {filterTasks(data.tasks.inProgress).length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold mb-4 text-blue-600">
                    Em Progresso ({filterTasks(data.tasks.inProgress).length})
                  </h2>
                  <div className="space-y-4">
                    {filterTasks(data.tasks.inProgress).map((task) => (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        timeTracker={timeTrackers.get(task.id)}
                        isActive={activeTimer === task.id}
                        onStartTimer={() => startTimer(task.id)}
                        onPauseTimer={() => pauseTimer(task.id)}
                        onResumeTimer={() => resumeTimer(task.id)}
                        onStopTimer={() => stopTimer(task.id)}
                        onUpdateStatus={updateTaskStatus}
                        getPriorityColor={getPriorityColor}
                        getStatusColor={getStatusColor}
                        formatTime={formatTime}
                        formatElapsedTime={formatElapsedTime}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Tasks */}
              {filterTasks(data.tasks.completed).length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold mb-4 text-green-600">
                    Concluídas ({filterTasks(data.tasks.completed).slice(0, 5).length})
                  </h2>
                  <div className="space-y-4">
                    {filterTasks(data.tasks.completed).slice(0, 5).map((task) => (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        timeTracker={timeTrackers.get(task.id)}
                        isActive={false}
                        onStartTimer={() => {}}
                        onPauseTimer={() => {}}
                        onResumeTimer={() => {}}
                        onStopTimer={() => {}}
                        onUpdateStatus={() => {}}
                        getPriorityColor={getPriorityColor}
                        getStatusColor={getStatusColor}
                        formatTime={formatTime}
                        formatElapsedTime={formatElapsedTime}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Unified View */
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-900">
                Todas as Tarefas ({getAllFilteredTasks().length})
              </h2>
              <div className="space-y-4">
                {getAllFilteredTasks().map((task) => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    timeTracker={timeTrackers.get(task.id)}
                    isActive={activeTimer === task.id}
                    onStartTimer={() => startTimer(task.id)}
                    onPauseTimer={() => pauseTimer(task.id)}
                    onResumeTimer={() => resumeTimer(task.id)}
                    onStopTimer={() => stopTimer(task.id)}
                    onUpdateStatus={updateTaskStatus}
                    getPriorityColor={getPriorityColor}
                    getStatusColor={getStatusColor}
                    formatTime={formatTime}
                    formatElapsedTime={formatElapsedTime}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No tasks message */}
          {(viewMode === 'sections' ? 
            (filterTasks(data.tasks.today).length === 0 && 
             filterTasks(data.tasks.overdue).length === 0 && 
             filterTasks(data.tasks.inProgress).length === 0 && 
             filterTasks(data.tasks.completed).length === 0) :
            getAllFilteredTasks().length === 0
          ) && (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  {statusFilter === 'all' && priorityFilter === 'all' ? (
                    <>
                      <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma tarefa para hoje!</h3>
                      <p className="text-gray-500">Você está em dia com suas atividades.</p>
                    </>
                  ) : (
                    <>
                      <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma tarefa encontrada</h3>
                      <p className="text-gray-500">Tente ajustar os filtros para ver mais tarefas.</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

interface TaskCardProps {
  task: Task
  timeTracker?: TimeTracker
  isActive: boolean
  onStartTimer: () => void
  onPauseTimer: () => void
  onResumeTimer: () => void
  onStopTimer: () => void
  onUpdateStatus: (taskId: string, status: string) => void
  getPriorityColor: (priority: string) => string
  getStatusColor: (status: string) => string
  formatTime: (hours: number) => string
  formatElapsedTime: (seconds: number) => string
}

function TaskCard({ 
  task, 
  timeTracker, 
  isActive, 
  onStartTimer, 
  onPauseTimer,
  onResumeTimer,
  onStopTimer, 
  onUpdateStatus,
  getPriorityColor,
  getStatusColor,
  formatTime,
  formatElapsedTime
}: TaskCardProps) {
  return (
    <Card className={`transition-all duration-200 ${isActive ? 'ring-2 ring-blue-500 shadow-lg' : 'shadow-sm'} hover:shadow-md`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg">{task.title}</CardTitle>
              <Badge className={`${getPriorityColor(task.priority)} text-white text-xs`}>
                {task.priority}
              </Badge>
              <Badge className={`${getStatusColor(task.status)} text-white text-xs`}>
                {task.status.replace('_', ' ')}
              </Badge>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                <span>{task.project.client.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>{task.project.name}</span>
              </div>
              {task.milestone && (
                <div className="flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  <span>{task.milestone.name}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            {task.status !== 'COMPLETED' && (
              <>
                {task.status === 'TODO' ? (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => onUpdateStatus(task.id, 'IN_PROGRESS')}
                  >
                    Iniciar Tarefa
                  </Button>
                ) : (
                  <>
                    {!isActive ? (
                      <Button size="sm" onClick={onStartTimer} className="gap-1">
                        <Play className="h-4 w-4" />
                        Iniciar Cronômetro
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        {timeTracker?.isPaused ? (
                          <Button size="sm" onClick={onResumeTimer} className="gap-1">
                            <Play className="h-4 w-4" />
                            Retomar
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={onPauseTimer} className="gap-1">
                            <Pause className="h-4 w-4" />
                            Pausar
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={onStopTimer} className="gap-1">
                          <Square className="h-4 w-4" />
                          Parar
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            
            {task.status === 'IN_PROGRESS' && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onUpdateStatus(task.id, 'COMPLETED')}
              >
                Concluir
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {task.description && (
          <p className="text-sm text-muted-foreground">{task.description}</p>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Estimado</span>
            </div>
            <p className="font-medium">
              {calculateEstimatedTime(task) ? formatTime(calculateEstimatedTime(task)) : 'Não definido'}
            </p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Timer className="h-4 w-4" />
              <span>Trabalhado</span>
            </div>
            <p className="font-medium">
              {task.actualHours ? formatTime(task.actualHours) : '0h 0m'}
            </p>
          </div>
          
          {timeTracker && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Sessão Atual</span>
              </div>
              <p className="font-medium text-blue-600">
                {formatElapsedTime(timeTracker.elapsedTime)}
              </p>
            </div>
          )}
        </div>
        
        {task.dueDate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              Vencimento: {format(new Date(task.dueDate), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
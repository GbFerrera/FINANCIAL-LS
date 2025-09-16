'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
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
  Building2
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Task {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate?: string
  estimatedHours?: number
  actualHours?: number
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

interface TasksData {
  tasks: {
    today: Task[]
    overdue: Task[]
    inProgress: Task[]
  }
  summary: {
    total: number
    today: number
    overdue: number
    inProgress: number
    totalEstimatedHours: number
    totalActualHours: number
  }
}

interface TimeTracker {
  taskId: string
  startTime: number
  elapsedTime: number
}

export default function CollaboratorPage() {
  const { data: session } = useSession()
  const [tasksData, setTasksData] = useState<TasksData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [timeTrackers, setTimeTrackers] = useState<Map<string, TimeTracker>>(new Map())
  const [activeTimer, setActiveTimer] = useState<string | null>(null)

  useEffect(() => {
    fetchTasks()
  }, [selectedDate])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (activeTimer) {
      interval = setInterval(() => {
        setTimeTrackers(prev => {
          const newTrackers = new Map(prev)
          const tracker = newTrackers.get(activeTimer)
          if (tracker) {
            tracker.elapsedTime = Date.now() - tracker.startTime
            newTrackers.set(activeTimer, tracker)
          }
          return newTrackers
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [activeTimer])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/collaborator/tasks?date=${selectedDate}`)
      if (response.ok) {
        const data = await response.json()
        setTasksData(data)
      }
    } catch (error) {
      console.error('Erro ao buscar tarefas:', error)
    } finally {
      setLoading(false)
    }
  }

  const startTimer = async (taskId: string) => {
    if (activeTimer && activeTimer !== taskId) {
      await stopTimer(activeTimer)
    }
    
    try {
      const response = await fetch('/api/time-entries', {
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
            elapsedTime: 0
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

  const stopTimer = async (taskId: string) => {
    const tracker = timeTrackers.get(taskId)
    if (tracker) {
      try {
        const response = await fetch('/api/time-entries', {
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
          fetchTasks() // Refresh tasks
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
      const response = await fetch('/api/collaborator/tasks', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ taskId, status })
      })
      
      if (response.ok) {
        fetchTasks()
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
    }
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
    const h = Math.floor(hours)
    const m = Math.floor((hours - h) * 60)
    return `${h}h ${m}m`
  }

  const formatElapsedTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Minhas Atividades</h1>
          <p className="text-muted-foreground">
            Olá, {session?.user?.name}! Aqui estão suas tarefas para hoje.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
        </div>
      </div>

      {/* Summary Cards */}
      {tasksData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Tarefas</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasksData.summary.total}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Para Hoje</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasksData.summary.today}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Atraso</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{tasksData.summary.overdue}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Horas Trabalhadas</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatTime(tasksData.summary.totalActualHours)}
              </div>
              <p className="text-xs text-muted-foreground">
                de {formatTime(tasksData.summary.totalEstimatedHours)} estimadas
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tasks Tabs */}
      {tasksData && (
        <Tabs defaultValue="today" className="space-y-4">
          <TabsList>
            <TabsTrigger value="today">Hoje ({tasksData.summary.today})</TabsTrigger>
            <TabsTrigger value="overdue">Atrasadas ({tasksData.summary.overdue})</TabsTrigger>
            <TabsTrigger value="inProgress">Em Progresso ({tasksData.summary.inProgress})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="today" className="space-y-4">
            {tasksData.tasks.today.map((task) => (
              <TaskCard 
                key={task.id} 
                task={task} 
                timeTracker={timeTrackers.get(task.id)}
                isActive={activeTimer === task.id}
                onStartTimer={() => startTimer(task.id)}
                onStopTimer={() => stopTimer(task.id)}
                onUpdateStatus={updateTaskStatus}
                getPriorityColor={getPriorityColor}
                getStatusColor={getStatusColor}
                formatTime={formatTime}
                formatElapsedTime={formatElapsedTime}
              />
            ))}
            {tasksData.tasks.today.length === 0 && (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">Nenhuma tarefa para hoje!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="overdue" className="space-y-4">
            {tasksData.tasks.overdue.map((task) => (
              <TaskCard 
                key={task.id} 
                task={task} 
                timeTracker={timeTrackers.get(task.id)}
                isActive={activeTimer === task.id}
                onStartTimer={() => startTimer(task.id)}
                onStopTimer={() => stopTimer(task.id)}
                onUpdateStatus={updateTaskStatus}
                getPriorityColor={getPriorityColor}
                getStatusColor={getStatusColor}
                formatTime={formatTime}
                formatElapsedTime={formatElapsedTime}
              />
            ))}
            {tasksData.tasks.overdue.length === 0 && (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">Nenhuma tarefa atrasada!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="inProgress" className="space-y-4">
            {tasksData.tasks.inProgress.map((task) => (
              <TaskCard 
                key={task.id} 
                task={task} 
                timeTracker={timeTrackers.get(task.id)}
                isActive={activeTimer === task.id}
                onStartTimer={() => startTimer(task.id)}
                onStopTimer={() => stopTimer(task.id)}
                onUpdateStatus={updateTaskStatus}
                getPriorityColor={getPriorityColor}
                getStatusColor={getStatusColor}
                formatTime={formatTime}
                formatElapsedTime={formatElapsedTime}
              />
            ))}
            {tasksData.tasks.inProgress.length === 0 && (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">Nenhuma tarefa em progresso!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

interface TaskCardProps {
  task: Task
  timeTracker?: TimeTracker
  isActive: boolean
  onStartTimer: () => void
  onStopTimer: () => void
  onUpdateStatus: (taskId: string, status: string) => void
  getPriorityColor: (priority: string) => string
  getStatusColor: (status: string) => string
  formatTime: (hours: number) => string
  formatElapsedTime: (milliseconds: number) => string
}

function TaskCard({ 
  task, 
  timeTracker, 
  isActive, 
  onStartTimer, 
  onStopTimer, 
  onUpdateStatus,
  getPriorityColor,
  getStatusColor,
  formatTime,
  formatElapsedTime
}: TaskCardProps) {
  return (
    <Card className={`transition-all duration-200 ${isActive ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{task.title}</CardTitle>
              <Badge className={`${getPriorityColor(task.priority)} text-white`}>
                {task.priority}
              </Badge>
              <Badge className={`${getStatusColor(task.status)} text-white`}>
                {task.status.replace('_', ' ')}
              </Badge>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{task.milestone.name}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {task.status !== 'COMPLETED' && (
              <>
                {task.status === 'IN_PROGRESS' && (
                  <>
                    {!isActive ? (
                      <Button size="sm" onClick={onStartTimer} className="gap-1">
                        <Play className="h-4 w-4" />
                        Iniciar Cronômetro
                      </Button>
                    ) : (
                      <Button size="sm" variant="destructive" onClick={onStopTimer} className="gap-1">
                        <Square className="h-4 w-4" />
                        Parar Cronômetro
                      </Button>
                    )}
                  </>
                )}
                
                {task.status === 'TODO' && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => onUpdateStatus(task.id, 'IN_PROGRESS')}
                  >
                    Iniciar Tarefa
                  </Button>
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
              </>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {task.description && (
          <p className="text-sm text-muted-foreground">{task.description}</p>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span>Tempo Estimado</span>
            </div>
            <p className="font-medium">
              {task.estimatedHours ? formatTime(task.estimatedHours) : 'Não definido'}
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Timer className="h-4 w-4" />
              <span>Tempo Trabalhado</span>
            </div>
            <div className="space-y-1">
              <p className="font-medium">
                {timeTracker ? (
                  <span>
                    {task.actualHours ? formatTime(task.actualHours) : '0h 0m'}
                    <span className="text-blue-600 ml-1">
                      + {formatElapsedTime(timeTracker.elapsedTime)}
                    </span>
                  </span>
                ) : (
                  task.actualHours ? formatTime(task.actualHours) : '0h 0m'
                )}
              </p>
              {timeTracker && (
                <p className="text-xs text-muted-foreground">
                  Sessão atual: {formatElapsedTime(timeTracker.elapsedTime)}
                </p>
              )}
            </div>
          </div>
          
          {timeTracker && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4" />
                <span>Tempo Total</span>
              </div>
              <p className="font-medium text-green-600">
                {(() => {
                  const totalHours = (task.actualHours || 0) + (timeTracker.elapsedTime / (1000 * 60 * 60));
                  return formatTime(totalHours);
                })()}
              </p>
            </div>
          )}
        </div>
        
        {task.estimatedHours && task.actualHours && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progresso</span>
              <span>{Math.round((task.actualHours / task.estimatedHours) * 100)}%</span>
            </div>
            <Progress value={(task.actualHours / task.estimatedHours) * 100} />
          </div>
        )}
        
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
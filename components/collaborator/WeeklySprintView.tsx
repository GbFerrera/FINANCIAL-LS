'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Calendar, 
  Target, 
  Clock, 
  Play, 
  Pause, 
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Timer
} from 'lucide-react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TaskTimer } from './TaskTimer'

interface Task {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate?: string
  startDate?: string
  startTime?: string
  estimatedMinutes?: number
  actualMinutes?: number
  storyPoints?: number
  sprint?: {
    id: string
    name: string
    status: string
  }
  project: {
    id: string
    name: string
  }
}

interface WeeklySprintViewProps {
  token: string
}

export function WeeklySprintView({ token }: WeeklySprintViewProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [weeklyTasks, setWeeklyTasks] = useState<Record<string, Task[]>>({})
  const [loading, setLoading] = useState(true)
  const [collaborator, setCollaborator] = useState<any>(null)

  const weekStart = startOfWeek(currentWeek, { locale: ptBR })
  const weekEnd = endOfWeek(currentWeek, { locale: ptBR })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  useEffect(() => {
    fetchWeeklyTasks()
  }, [token, currentWeek])

  const fetchWeeklyTasks = async () => {
    try {
      setLoading(true)
      const startDate = format(weekStart, 'yyyy-MM-dd')
      const endDate = format(weekEnd, 'yyyy-MM-dd')
      
      const response = await fetch(`/api/collaborator-portal/${token}/weekly-tasks?startDate=${startDate}&endDate=${endDate}`)
      if (response.ok) {
        const data = await response.json()
        setCollaborator(data.collaborator)
        
        // Organizar tarefas por dia
        const tasksByDay: Record<string, Task[]> = {}
        weekDays.forEach(day => {
          const dayKey = format(day, 'yyyy-MM-dd')
          tasksByDay[dayKey] = []
        })

        data.tasks.forEach((task: Task) => {
          // Verificar se a tarefa tem data de início ou vencimento na semana
          const taskDate = task.startDate || task.dueDate
          if (taskDate) {
            const taskDay = format(new Date(taskDate), 'yyyy-MM-dd')
            if (tasksByDay[taskDay]) {
              tasksByDay[taskDay].push(task)
            }
          } else {
            // Se não tem data específica, colocar na segunda-feira
            const mondayKey = format(weekDays[1], 'yyyy-MM-dd')
            tasksByDay[mondayKey].push(task)
          }
        })

        setWeeklyTasks(tasksByDay)
      }
    } catch (error) {
      console.error('Erro ao carregar tarefas semanais:', error)
    } finally {
      setLoading(false)
    }
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentWeek(subWeeks(currentWeek, 1))
    } else {
      setCurrentWeek(addWeeks(currentWeek, 1))
    }
  }

  const goToCurrentWeek = () => {
    setCurrentWeek(new Date())
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
      case 'COMPLETED': return 'text-green-600 bg-green-100'
      case 'IN_PROGRESS': return 'text-blue-600 bg-blue-100'
      case 'TODO': return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="w-3 h-3" />
      case 'IN_PROGRESS': return <Clock className="w-3 h-3" />
      case 'TODO': return <AlertCircle className="w-3 h-3" />
      default: return <AlertCircle className="w-3 h-3" />
    }
  }

  const getDayName = (date: Date) => {
    return format(date, 'EEEE', { locale: ptBR })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header com navegação da semana */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Planejamento Semanal</h2>
          <p className="text-gray-600">
            {format(weekStart, 'dd/MM', { locale: ptBR })} - {format(weekEnd, 'dd/MM/yyyy', { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateWeek('prev')}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToCurrentWeek}
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateWeek('next')}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Grid dos dias da semana */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        {weekDays.map((day, index) => {
          const dayKey = format(day, 'yyyy-MM-dd')
          const dayTasks = weeklyTasks[dayKey] || []
          const isCurrentDay = isToday(day)

          return (
            <Card 
              key={dayKey} 
              className={`${isCurrentDay ? 'ring-2 ring-blue-500 bg-blue-50' : ''} min-h-[300px]`}
            >
              <CardHeader className="pb-3">
                <CardTitle className={`text-sm font-medium ${isCurrentDay ? 'text-blue-700' : 'text-gray-700'}`}>
                  <div className="flex items-center justify-between">
                    <span className="capitalize">{getDayName(day)}</span>
                    <span className={`text-xs ${isCurrentDay ? 'text-blue-600' : 'text-gray-500'}`}>
                      {format(day, 'dd/MM')}
                    </span>
                  </div>
                  {isCurrentDay && (
                    <Badge variant="default" className="mt-1 text-xs">
                      Hoje
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {dayTasks.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">
                    Nenhuma tarefa
                  </p>
                ) : (
                  dayTasks.map(task => (
                    <div key={task.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                      <div className="space-y-2">
                        {/* Sprint info */}
                        {task.sprint && (
                          <div className="flex items-center gap-1">
                            <Target className="w-3 h-3 text-blue-500" />
                            <span className="text-xs text-blue-600 font-medium">
                              {task.sprint.name}
                            </span>
                          </div>
                        )}
                        
                        {/* Task title and priority */}
                        <div className="flex items-start gap-2">
                          <div className={`w-2 h-2 rounded-full mt-1 ${getPriorityColor(task.priority)}`} />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {task.title}
                            </h4>
                            <p className="text-xs text-gray-500">{task.project.name}</p>
                          </div>
                        </div>

                        {/* Status and info */}
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className={`${getStatusColor(task.status)} text-xs`}>
                            {getStatusIcon(task.status)}
                            <span className="ml-1">
                              {task.status === 'TODO' ? 'A Fazer' :
                               task.status === 'IN_PROGRESS' ? 'Em Progresso' : 'Concluída'}
                            </span>
                          </Badge>
                          
                          {task.estimatedMinutes && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Timer className="w-3 h-3" />
                              {Math.floor(task.estimatedMinutes / 60)}h {task.estimatedMinutes % 60}min
                            </span>
                          )}
                        </div>

                        {/* Timer controls */}
                        <div className="flex justify-center pt-2">
                          <TaskTimer 
                            taskId={task.id}
                            taskTitle={task.title}
                            currentStatus={task.status}
                            userId={collaborator?.userId || ''}
                            onStatusChange={fetchWeeklyTasks}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Resumo da semana */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo da Semana</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(() => {
              const allTasks = Object.values(weeklyTasks).flat()
              const totalTasks = allTasks.length
              const completedTasks = allTasks.filter(t => t.status === 'COMPLETED').length
              const inProgressTasks = allTasks.filter(t => t.status === 'IN_PROGRESS').length
              const todoTasks = allTasks.filter(t => t.status === 'TODO').length

              return (
                <>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{totalTasks}</div>
                    <div className="text-sm text-gray-600">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
                    <div className="text-sm text-gray-600">Concluídas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{inProgressTasks}</div>
                    <div className="text-sm text-gray-600">Em Progresso</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">{todoTasks}</div>
                    <div className="text-sm text-gray-600">A Fazer</div>
                  </div>
                </>
              )
            })()}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

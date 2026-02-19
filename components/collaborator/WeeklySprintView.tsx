'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Calendar, 
  Target, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Timer,
  Grid3X3,
  List
} from 'lucide-react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ContributionHeatmap } from '@/components/dashboard/contribution-heatmap'
import { TaskDetailsModal } from './TaskDetailsModal'

// Função para formatar data sem problemas de fuso horário
const formatDateSafe = (dateString: string) => {
  // Se a data já está no formato ISO, extrair apenas a parte da data
  if (dateString.includes('T')) {
    dateString = dateString.split('T')[0]
  }
  
  // Dividir a data em partes (YYYY-MM-DD)
  const [year, month, day] = dateString.split('-')
  
  // Criar data local sem conversão de fuso horário
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  
  return date.toLocaleDateString('pt-BR')
}

// Função para obter data segura no formato YYYY-MM-DD
const getDateStringSafe = (dateString: string) => {
  if (dateString.includes('T')) {
    return dateString.split('T')[0]
  }
  return dateString
}

interface Task {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'
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
  const [viewType, setViewType] = useState<'columns' | 'list'>('columns')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

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
            const taskDay = getDateStringSafe(taskDate)
            if (tasksByDay[taskDay]) {
              tasksByDay[taskDay].push(task)
            }
          } else {
            // Se não tem data específica, colocar no domingo (primeiro dia da semana)
            const sundayKey = format(weekDays[0], 'yyyy-MM-dd')
            tasksByDay[sundayKey].push(task)
          }
        })

        // Ordenar tarefas por horário de início em cada dia
        Object.keys(tasksByDay).forEach(dayKey => {
          tasksByDay[dayKey].sort((a, b) => {
            // Primeiro por status (IN_PROGRESS primeiro)
            const statusOrder = { 'IN_PROGRESS': 0, 'IN_REVIEW': 1, 'TODO': 2, 'COMPLETED': 3 }
            const statusDiff = (statusOrder[a.status as keyof typeof statusOrder] || 3) - 
                              (statusOrder[b.status as keyof typeof statusOrder] || 3)
            if (statusDiff !== 0) return statusDiff

            // Depois por horário de início
            if (a.startTime && b.startTime) {
              return a.startTime.localeCompare(b.startTime)
            }
            if (a.startTime && !b.startTime) return -1
            if (!a.startTime && b.startTime) return 1

            // Por último por prioridade
            const priorityOrder = { 'URGENT': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 }
            const priorityDiff = (priorityOrder[a.priority as keyof typeof priorityOrder] || 4) - 
                                (priorityOrder[b.priority as keyof typeof priorityOrder] || 4)
            if (priorityDiff !== 0) return priorityDiff

            // Por último por título (ordem alfabética)
            return a.title.localeCompare(b.title)
          })
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
      default: return 'bg-card0'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-600 bg-green-100'
      case 'IN_PROGRESS': return 'text-blue-600 bg-blue-100'
      case 'IN_REVIEW': return 'text-yellow-600 bg-yellow-100'
      case 'TODO': return 'text-muted-foreground bg-gray-100'
      default: return 'text-muted-foreground bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="w-3 h-3" />
      case 'IN_PROGRESS': return <Clock className="w-3 h-3" />
      case 'IN_REVIEW': return <Clock className="w-3 h-3" />
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-border"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header com navegação da semana */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Planejamento Semanal</h2>
          <p className="text-muted-foreground">
            {format(weekStart, 'dd/MM', { locale: ptBR })} - {format(weekEnd, 'dd/MM/yyyy', { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Controles de visualização */}
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button
              variant={viewType === 'columns' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewType('columns')}
              className="h-8 px-3"
            >
              <Grid3X3 className="w-4 h-4 mr-1" />
              Colunas
            </Button>
            <Button
              variant={viewType === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewType('list')}
              className="h-8 px-3"
            >
              <List className="w-4 h-4 mr-1" />
              Lista
            </Button>
          </div>

          {/* Navegação da semana */}
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
      </div>

      {/* Conteúdo baseado no tipo de visualização */}
      {viewType === 'columns' ? (
        /* Visualização em Colunas */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
          {weekDays.map((day, index) => {
            const dayKey = format(day, 'yyyy-MM-dd')
            const dayTasks = weeklyTasks[dayKey] || []
            const isCurrentDay = isToday(day)

            return (
              <Card 
                key={dayKey} 
                className={`${isCurrentDay ? 'ring-2 ring-ring bg-accent/20' : ''} min-h-[300px]`}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className={isCurrentDay ? 'text-foreground' : 'text-muted-foreground'}>
                      {format(day, 'EEEE', { locale: ptBR })}
                    </span>
                    <span className={`text-xs ${isCurrentDay ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                      {format(day, 'dd/MM')}
                    </span>
                    {isCurrentDay && (
                      <Badge variant="secondary" className="text-xs">
                        Hoje
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {dayTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhuma tarefa
                    </p>
                  ) : (
                    dayTasks.map(task => (
                      <button
                        key={task.id}
                        onClick={() => {
                          setSelectedTask(task)
                          setDetailsOpen(true)
                        }}
                        className="w-full text-left border rounded-lg p-2 hover:bg-accent/40 transition-colors focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <h4 className="text-sm font-medium text-foreground line-clamp-1">
                          {task.title}
                        </h4>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        /* Visualização em Lista */
        <div className="space-y-4">
          {weekDays.map((day, index) => {
            const dayKey = format(day, 'yyyy-MM-dd')
            const dayTasks = weeklyTasks[dayKey] || []
            const isCurrentDay = isToday(day)

            return (
              <Card key={dayKey} className={isCurrentDay ? 'ring-2 ring-ring bg-accent/20' : ''}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-medium flex items-center gap-3">
                    <span className={isCurrentDay ? 'text-foreground' : 'text-muted-foreground'}>
                      {format(day, 'EEEE, dd/MM', { locale: ptBR })}
                    </span>
                    {isCurrentDay && (
                      <Badge variant="secondary" className="text-xs">
                        Hoje
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {dayTasks.length} tarefa{dayTasks.length !== 1 ? 's' : ''}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                
                <CardContent>
                  {dayTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma tarefa agendada para este dia
                    </p>
                  ) : (
                    <div className="grid gap-3">
                      {dayTasks.map(task => (
                        <button
                          key={task.id}
                          onClick={() => {
                            setSelectedTask(task)
                            setDetailsOpen(true)
                          }}
                          className="w-full text-left border rounded-lg p-3 hover:bg-accent/40 transition-colors focus-visible:ring-ring focus-visible:outline-none"
                        >
                          <h4 className="text-sm font-medium text-foreground line-clamp-1">
                            {task.title}
                          </h4>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

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
                    <div className="text-2xl font-bold text-foreground">{totalTasks}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
                    <div className="text-sm text-muted-foreground">Concluídas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{inProgressTasks}</div>
                    <div className="text-sm text-muted-foreground">Em Progresso</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-muted-foreground">{todoTasks}</div>
                    <div className="text-sm text-muted-foreground">A Fazer</div>
                  </div>
                </>
              )
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Heatmap de Produtividade removido daqui pois foi movido para o layout pai */}
      <TaskDetailsModal
        task={selectedTask}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        token={token}
      />
    </div>
  )
}

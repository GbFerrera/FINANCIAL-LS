'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calendar, Clock, CheckCircle2, AlertCircle, Target, X } from 'lucide-react'
import { format, eachDayOfInterval, isToday, isBefore, isAfter, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Task {
  id: string
  title: string
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  storyPoints?: number
  dueDate?: string
  startDate?: string
}

interface Sprint {
  id: string
  name: string
  startDate: string
  endDate: string
  status: string
  tasks: Task[]
}

interface SprintTimelineProps {
  sprint: Sprint
}

interface DayData {
  date: Date
  isToday: boolean
  isPast: boolean
  isFuture: boolean
  isWeekend: boolean
  tasksStarting: Task[]
  tasksDue: Task[]
  tasksInProgress: Task[]
  completedTasks: Task[]
}

export function SprintTimeline({ sprint }: SprintTimelineProps) {
  const [days, setDays] = useState<DayData[]>([])
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null)
  const [showDayModal, setShowDayModal] = useState(false)

  useEffect(() => {
    if (!sprint.startDate || !sprint.endDate) return

    const startDate = parseISO(sprint.startDate)
    const endDate = parseISO(sprint.endDate)
    const today = new Date()

    const sprintDays = eachDayOfInterval({ start: startDate, end: endDate })

    const daysData = sprintDays.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd')
      
      return {
        date,
        isToday: isToday(date),
        isPast: isBefore(date, today),
        isFuture: isAfter(date, today),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        tasksStarting: sprint.tasks.filter(task => 
          task.startDate && format(parseISO(task.startDate), 'yyyy-MM-dd') === dateStr
        ),
        tasksDue: sprint.tasks.filter(task => 
          task.dueDate && format(parseISO(task.dueDate), 'yyyy-MM-dd') === dateStr
        ),
        tasksInProgress: sprint.tasks.filter(task => 
          task.status === 'IN_PROGRESS' && 
          task.startDate && 
          isBefore(parseISO(task.startDate), date) &&
          (!task.dueDate || isAfter(parseISO(task.dueDate), date))
        ),
        completedTasks: sprint.tasks.filter(task => 
          task.status === 'COMPLETED'
        )
      }
    })

    setDays(daysData)
  }, [sprint])

  const getTasksByStatus = () => {
    const todo = sprint.tasks.filter(t => t.status === 'TODO').length
    const inProgress = sprint.tasks.filter(t => t.status === 'IN_PROGRESS').length
    const inReview = sprint.tasks.filter(t => t.status === 'IN_REVIEW').length
    const completed = sprint.tasks.filter(t => t.status === 'COMPLETED').length
    const total = sprint.tasks.length

    return { todo, inProgress, inReview, completed, total }
  }

  const getDayClass = (day: DayData) => {
    let classes = 'p-3 border rounded-lg transition-all hover:shadow-md cursor-pointer hover:scale-105 '
    
    if (day.isToday) {
      classes += 'border-blue-500 bg-blue-50 hover:bg-blue-100 '
    } else if (day.isPast) {
      classes += 'border-gray-200 bg-gray-50 hover:bg-gray-100 '
    } else if (day.isWeekend) {
      classes += 'border-gray-300 bg-gray-100 hover:bg-gray-200 '
    } else {
      classes += 'border-gray-200 bg-white hover:bg-gray-50 '
    }

    return classes
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-800'
      case 'HIGH': return 'bg-orange-100 text-orange-800'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800'
      case 'LOW': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const stats = getTasksByStatus()
  const progressPercentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  const handleDayClick = (day: DayData) => {
    setSelectedDay(day)
    setShowDayModal(true)
  }

  const getAllTasksWithDates = () => {
    const tasksWithDates = sprint.tasks.filter(task => task.startDate || task.dueDate)
    return tasksWithDates.sort((a, b) => {
      const dateA = a.startDate || a.dueDate || ''
      const dateB = b.startDate || b.dueDate || ''
      return dateA.localeCompare(dateB)
    })
  }

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Timeline da Sprint: {sprint.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{stats.todo}</div>
              <div className="text-sm text-gray-500">A Fazer</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
              <div className="text-sm text-gray-500">Em Progresso</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.inReview}</div>
              <div className="text-sm text-gray-500">Em Revisão</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-sm text-gray-500">Concluídas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{progressPercentage}%</div>
              <div className="text-sm text-gray-500">Progresso</div>
            </div>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Timeline dos dias */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Cronograma Diário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {days.map((day, index) => (
              <div key={index} className={getDayClass(day)} onClick={() => handleDayClick(day)}>
                {/* Cabeçalho do dia */}
                <div className="text-center mb-2">
                  <div className={`text-sm font-medium ${day.isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                    {format(day.date, 'EEE', { locale: ptBR })}
                  </div>
                  <div className={`text-lg font-bold ${day.isToday ? 'text-blue-700' : 'text-gray-900'}`}>
                    {format(day.date, 'dd')}
                  </div>
                  <div className="text-xs text-gray-500">
                    {format(day.date, 'MMM', { locale: ptBR })}
                  </div>
                </div>

                {/* Indicadores do dia */}
                <div className="space-y-1">
                  {day.isToday && (
                    <Badge variant="default" className="w-full text-xs bg-blue-500">
                      <Clock className="w-3 h-3 mr-1" />
                      Hoje
                    </Badge>
                  )}

                  {/* Todas as tarefas do dia */}
                  {(day.tasksStarting.length > 0 || day.tasksDue.length > 0) && (
                    <div className="space-y-2">
                      {/* Tarefas iniciando */}
                      {day.tasksStarting.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-green-700 flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            Iniciam ({day.tasksStarting.length})
                          </div>
                          {day.tasksStarting.map(task => (
                            <div key={`start-${task.id}`} className="text-xs p-2 bg-green-50 rounded border-l-2 border-green-400">
                              <div className="font-medium mb-1">{task.title}</div>
                              <div className="flex items-center justify-between">
                                <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                                  {task.priority} • {task.storyPoints || 0}SP
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {task.status === 'TODO' ? 'A Fazer' : 
                                   task.status === 'IN_PROGRESS' ? 'Em Progresso' :
                                   task.status === 'IN_REVIEW' ? 'Em Revisão' : 'Concluída'}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Tarefas com prazo */}
                      {day.tasksDue.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-red-700 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Prazo Final ({day.tasksDue.length})
                          </div>
                          {day.tasksDue.map(task => (
                            <div key={`due-${task.id}`} className="text-xs p-2 bg-red-50 rounded border-l-2 border-red-400">
                              <div className="font-medium mb-1">{task.title}</div>
                              <div className="flex items-center justify-between">
                                <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                                  {task.priority} • {task.storyPoints || 0}SP
                                </Badge>
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-xs">
                                    {task.status === 'TODO' ? 'A Fazer' : 
                                     task.status === 'IN_PROGRESS' ? 'Em Progresso' :
                                     task.status === 'IN_REVIEW' ? 'Em Revisão' : 'Concluída'}
                                  </Badge>
                                  {task.status === 'COMPLETED' && (
                                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Indicador de fim de semana */}
                  {day.isWeekend && (
                    <div className="text-xs text-gray-400 text-center py-1">
                      Fim de semana
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lista detalhada de todas as tarefas com datas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Todas as Tarefas com Datas ({getAllTasksWithDates().length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {getAllTasksWithDates().length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma tarefa possui data de início ou prazo definido</p>
                <p className="text-sm">Adicione datas às tarefas para visualizar no cronograma</p>
              </div>
            ) : (
              getAllTasksWithDates().map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 mb-1">{task.title}</div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      {task.startDate && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span>Início: {format(parseISO(task.startDate), 'dd/MM/yyyy', { locale: ptBR })}</span>
                        </div>
                      )}
                      {task.dueDate && (
                        <div className="flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-red-500" />
                          <span>Prazo: {format(parseISO(task.dueDate), 'dd/MM/yyyy', { locale: ptBR })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                      {task.priority}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {task.storyPoints || 0}SP
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        task.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200' :
                        task.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        task.status === 'IN_REVIEW' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        'bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      {task.status === 'TODO' ? 'A Fazer' : 
                       task.status === 'IN_PROGRESS' ? 'Em Progresso' :
                       task.status === 'IN_REVIEW' ? 'Em Revisão' : 'Concluída'}
                      {task.status === 'COMPLETED' && (
                        <CheckCircle2 className="w-3 h-3 ml-1" />
                      )}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de detalhes do dia */}
      <Dialog open={showDayModal} onOpenChange={setShowDayModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {selectedDay && format(selectedDay.date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              {selectedDay?.isToday && (
                <Badge className="bg-blue-500">Hoje</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedDay && (
            <div className="space-y-4">
              {/* Resumo do dia */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {selectedDay.tasksStarting.length}
                  </div>
                  <div className="text-sm text-gray-600">Tarefas Iniciando</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {selectedDay.tasksDue.length}
                  </div>
                  <div className="text-sm text-gray-600">Prazos Finais</div>
                </div>
              </div>

              {/* Tarefas iniciando */}
              {selectedDay.tasksStarting.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-green-700 mb-3 flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                    Tarefas Iniciando ({selectedDay.tasksStarting.length})
                  </h3>
                  <div className="space-y-3">
                    {selectedDay.tasksStarting.map(task => (
                      <div key={`modal-start-${task.id}`} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{task.title}</h4>
                          <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                            {task.priority}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <span>Story Points: {task.storyPoints || 0}</span>
                          <span>•</span>
                          <span>Status: {
                            task.status === 'TODO' ? 'A Fazer' : 
                            task.status === 'IN_PROGRESS' ? 'Em Progresso' :
                            task.status === 'IN_REVIEW' ? 'Em Revisão' : 'Concluída'
                          }</span>
                          {task.dueDate && (
                            <>
                              <span>•</span>
                              <span>Prazo: {format(parseISO(task.dueDate), 'dd/MM/yyyy', { locale: ptBR })}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tarefas com prazo */}
              {selectedDay.tasksDue.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-red-700 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Prazos Finais ({selectedDay.tasksDue.length})
                  </h3>
                  <div className="space-y-3">
                    {selectedDay.tasksDue.map(task => (
                      <div key={`modal-due-${task.id}`} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{task.title}</h4>
                          <div className="flex items-center gap-2">
                            <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                              {task.priority}
                            </Badge>
                            {task.status === 'COMPLETED' && (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <span>Story Points: {task.storyPoints || 0}</span>
                          <span>•</span>
                          <span>Status: {
                            task.status === 'TODO' ? 'A Fazer' : 
                            task.status === 'IN_PROGRESS' ? 'Em Progresso' :
                            task.status === 'IN_REVIEW' ? 'Em Revisão' : 'Concluída'
                          }</span>
                          {task.startDate && (
                            <>
                              <span>•</span>
                              <span>Início: {format(parseISO(task.startDate), 'dd/MM/yyyy', { locale: ptBR })}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Caso não tenha tarefas */}
              {selectedDay.tasksStarting.length === 0 && selectedDay.tasksDue.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma tarefa agendada para este dia</p>
                  {selectedDay.isWeekend && (
                    <p className="text-sm mt-1">Este é um fim de semana</p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

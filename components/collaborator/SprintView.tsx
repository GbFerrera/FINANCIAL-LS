'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  Calendar, 
  Target, 
  Clock, 
  Play, 
  Pause, 
  Square,
  CheckCircle2,
  AlertCircle,
  Timer
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TaskTimer } from './TaskTimer'

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

// Função para formatar data no padrão dd/MM ou dd/MM/yyyy
const formatDatePattern = (dateString: string, pattern: 'dd/MM' | 'dd/MM/yyyy') => {
  // Se a data já está no formato ISO, extrair apenas a parte da data
  if (dateString.includes('T')) {
    dateString = dateString.split('T')[0]
  }
  
  // Dividir a data em partes (YYYY-MM-DD)
  const [year, month, day] = dateString.split('-')
  
  if (pattern === 'dd/MM') {
    return `${day}/${month}`
  } else {
    return `${day}/${month}/${year}`
  }
}

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
  project: {
    id: string
    name: string
  }
}

interface Sprint {
  id: string
  name: string
  description?: string
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED'
  startDate: string
  endDate: string
  goal?: string
  capacity?: number
  tasks: Task[]
  project: {
    id: string
    name: string
  }
}

interface SprintViewProps {
  token: string
}

interface CollaboratorData {
  id: string
  userId: string
  user: {
    id: string
    name: string
    email: string
  }
}

export function SprintView({ token }: SprintViewProps) {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTimers, setActiveTimers] = useState<Record<string, boolean>>({})
  const [collaborator, setCollaborator] = useState<CollaboratorData | null>(null)

  useEffect(() => {
    fetchSprints()
  }, [token])

  const fetchSprints = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/collaborator-portal/${token}/sprints`)
      if (response.ok) {
        const data = await response.json()
        setCollaborator(data.collaborator)
        setSprints(data.sprints)
      }
    } catch (error) {
      console.error('Erro ao carregar sprints:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSprintProgress = (sprint: Sprint) => {
    const totalTasks = sprint.tasks.length
    const completedTasks = sprint.tasks.filter(task => task.status === 'COMPLETED').length
    return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  }

  const getSprintDaysRemaining = (sprint: Sprint) => {
    const today = new Date()
    const endDate = new Date(sprint.endDate)
    return differenceInDays(endDate, today)
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
      case 'COMPLETED': return <CheckCircle2 className="w-4 h-4" />
      case 'IN_PROGRESS': return <Clock className="w-4 h-4" />
      case 'TODO': return <AlertCircle className="w-4 h-4" />
      default: return <AlertCircle className="w-4 h-4" />
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Minhas Sprints</h2>
          <p className="text-gray-600">Acompanhe suas tarefas organizadas por sprint</p>
        </div>
      </div>

      {sprints.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma sprint encontrada</h3>
            <p className="text-gray-600">Você não possui tarefas atribuídas em sprints ativas no momento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sprints.map(sprint => {
            const progress = getSprintProgress(sprint)
            const daysRemaining = getSprintDaysRemaining(sprint)
            const myTasks = sprint.tasks || []

            return (
              <Card key={sprint.id} className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        {sprint.name}
                        <Badge variant={sprint.status === 'ACTIVE' ? 'default' : 'secondary'}>
                          {sprint.status === 'ACTIVE' ? 'Ativa' : 
                           sprint.status === 'PLANNING' ? 'Planejamento' : 'Concluída'}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {sprint.project.name} • {myTasks.length} tarefa{myTasks.length !== 1 ? 's' : ''}
                      </CardDescription>
                      {sprint.goal && (
                        <p className="text-sm text-gray-600 mt-2">{sprint.goal}</p>
                      )}
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <div className="flex items-center gap-1 mb-1">
                        <Calendar className="w-4 h-4" />
                        {formatDatePattern(sprint.startDate, 'dd/MM')} - {formatDatePattern(sprint.endDate, 'dd/MM/yyyy')}
                      </div>
                      {daysRemaining >= 0 ? (
                        <span className="text-blue-600">{daysRemaining} dias restantes</span>
                      ) : (
                        <span className="text-red-600">{Math.abs(daysRemaining)} dias em atraso</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                      <span>Progresso</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3">
                    {myTasks.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">Nenhuma tarefa atribuída nesta sprint</p>
                    ) : (
                      myTasks.map(task => (
                        <div key={task.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`w-3 h-3 rounded-full ${getPriorityColor(task.priority)}`} />
                                <h4 className="font-medium text-gray-900">{task.title}</h4>
                                <Badge variant="outline" className={getStatusColor(task.status)}>
                                  {getStatusIcon(task.status)}
                                  <span className="ml-1">
                                    {task.status === 'TODO' ? 'A Fazer' :
                                     task.status === 'IN_PROGRESS' ? 'Em Progresso' : 'Concluída'}
                                  </span>
                                </Badge>
                              </div>
                              
                              {task.description && (
                                <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                              )}
                              
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                {task.dueDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDateSafe(task.dueDate)}
                                  </span>
                                )}
                                {task.estimatedMinutes && (
                                  <span className="flex items-center gap-1">
                                    <Timer className="w-3 h-3" />
                                    {Math.floor(task.estimatedMinutes / 60)}h {task.estimatedMinutes % 60}min
                                  </span>
                                )}
                                {task.storyPoints && (
                                  <span className="flex items-center gap-1">
                                    <Target className="w-3 h-3" />
                                    {task.storyPoints} SP
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="ml-4">
                              <TaskTimer 
                                taskId={task.id}
                                taskTitle={task.title}
                                currentStatus={task.status}
                                userId={collaborator?.userId || ''}
                                onStatusChange={fetchSprints}
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

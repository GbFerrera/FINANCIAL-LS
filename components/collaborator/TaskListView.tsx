'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Calendar, 
  Target, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  Timer,
  Search,
  Filter,
  Building2
} from 'lucide-react'
import { TaskTimer } from './TaskTimer'
import { TaskChecklist } from './TaskChecklist'
import { TaskDetailsModal } from './TaskDetailsModal'
import { FileText } from 'lucide-react'
import { AddTaskImagesModal } from './AddTaskImagesModal'

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

// Função para ordenar tarefas por horário de início
const sortTasksByStartTime = (tasks: Task[]) => {
  return tasks.sort((a, b) => {
    // Prioridade 1: Tarefas em progresso primeiro
    if (a.status === 'IN_PROGRESS' && b.status !== 'IN_PROGRESS') return -1
    if (b.status === 'IN_PROGRESS' && a.status !== 'IN_PROGRESS') return 1
    
    // Prioridade 2: Tarefas com horário de início definido
    const aHasStartTime = a.startTime && a.startDate
    const bHasStartTime = b.startTime && b.startDate
    
    if (aHasStartTime && !bHasStartTime) return -1
    if (bHasStartTime && !aHasStartTime) return 1
    
    // Se ambas têm horário, ordenar por data e hora
    if (aHasStartTime && bHasStartTime) {
      const aDateTime = new Date(`${a.startDate}T${a.startTime}`)
      const bDateTime = new Date(`${b.startDate}T${b.startTime}`)
      return aDateTime.getTime() - bDateTime.getTime()
    }
    
    // Prioridade 3: Tarefas com data de início (sem horário)
    const aHasStartDate = a.startDate
    const bHasStartDate = b.startDate
    
    if (aHasStartDate && !bHasStartDate) return -1
    if (bHasStartDate && !aHasStartDate) return 1
    
    if (aHasStartDate && bHasStartDate) {
      return new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime()
    }
    
    // Prioridade 4: Tarefas com data de vencimento
    const aHasDueDate = a.dueDate
    const bHasDueDate = b.dueDate
    
    if (aHasDueDate && !bHasDueDate) return -1
    if (bHasDueDate && !aHasDueDate) return 1
    
    if (aHasDueDate && bHasDueDate) {
      return new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
    }
    
    // Prioridade 5: Por prioridade da tarefa
    const priorityOrder = { 'URGENT': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 }
    const aPriority = priorityOrder[a.priority] ?? 4
    const bPriority = priorityOrder[b.priority] ?? 4
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority
    }
    
    // Prioridade 6: Por data de criação (mais recente primeiro)
    return 0 // Fallback se não houver outros critérios
  })
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

interface TaskListViewProps {
  token: string
}

export function TaskListView({ token }: TaskListViewProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  type CollaboratorInfo = {
    id: string
    user?: {
      id: string
      name: string
      email: string
    }
  }
  const [collaborator, setCollaborator] = useState<CollaboratorInfo | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sprintFilter, setSprintFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<'today' | 'all'>('today')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)

  useEffect(() => {
    fetchTasks()
  }, [token, dateFilter])

  useEffect(() => {
    filterTasks()
  }, [tasks, searchTerm, statusFilter, priorityFilter, sprintFilter])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const endpoint = dateFilter === 'today' 
        ? `/api/collaborator-portal/${token}/today-tasks-simple`
        : `/api/collaborator-portal/${token}/all-tasks`
      
      const response = await fetch(endpoint)
      if (response.ok) {
        const data = await response.json()
        setCollaborator(data.collaborator)
        setTasks(data.tasks)
      }
    } catch (error) {
      console.error('Erro ao carregar tarefas:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterTasks = () => {
    let filtered = [...tasks]

    // Filtro por texto
    if (searchTerm) {
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.sprint?.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtro por status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter)
    }

    // Filtro por prioridade
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(task => task.priority === priorityFilter)
    }

    // Filtro por sprint
    if (sprintFilter !== 'all') {
      if (sprintFilter === 'no-sprint') {
        filtered = filtered.filter(task => !task.sprint)
      } else {
        filtered = filtered.filter(task => task.sprint?.id === sprintFilter)
      }
    }

    // Aplicar ordenação por horário de início
    filtered = sortTasksByStartTime(filtered)

    setFilteredTasks(filtered)
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
      case 'COMPLETED': return <CheckCircle2 className="w-4 h-4" />
      case 'IN_PROGRESS': return <Clock className="w-4 h-4" />
      case 'IN_REVIEW': return <Clock className="w-4 h-4" />
      case 'TODO': return <AlertCircle className="w-4 h-4" />
      default: return <AlertCircle className="w-4 h-4" />
    }
  }

  const getUniqueValues = (key: keyof Task | 'sprint.id' | 'sprint.name') => {
    const values = new Set<string>()
    tasks.forEach(task => {
      if (key === 'sprint.id') {
        if (task.sprint?.id) values.add(task.sprint.id)
      } else if (key === 'sprint.name') {
        if (task.sprint?.name) values.add(task.sprint.name)
      } else {
        const value = task[key as keyof Task]
        if (value && typeof value === 'string') values.add(value)
      }
    })
    return Array.from(values)
  }

  const groupTasksBySprint = () => {
    const grouped: Record<string, Task[]> = {}
    
    filteredTasks.forEach(task => {
      const sprintName = task.sprint?.name || 'Sem Sprint'
      if (!grouped[sprintName]) {
        grouped[sprintName] = []
      }
      grouped[sprintName].push(task)
    })

    return grouped
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const groupedTasks = groupTasksBySprint()

  return (
    <div className="space-y-6">
      {/* Header e Filtros */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Minhas Tarefas {dateFilter === 'today' ? '- Hoje' : ''}
          </h2>
          <p className="text-muted-foreground">
            {filteredTasks.length} de {tasks.length} tarefas {dateFilter === 'today' ? 'para hoje' : 'no total'}
          </p>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar tarefas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filtro Status */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="TODO">A Fazer</SelectItem>
                  <SelectItem value="IN_PROGRESS">Em Progresso</SelectItem>
                  <SelectItem value="COMPLETED">Concluída</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtro Prioridade */}
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
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

              {/* Filtro Sprint */}
              <Select value={sprintFilter} onValueChange={setSprintFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Sprint" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Sprints</SelectItem>
                  <SelectItem value="no-sprint">Sem Sprint</SelectItem>
                  {getUniqueValues('sprint.name').map(sprintName => (
                    <SelectItem key={sprintName} value={tasks.find(t => t.sprint?.name === sprintName)?.sprint?.id || ''}>
                      {sprintName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtro Data */}
              <Select value={dateFilter} onValueChange={(value: 'today' | 'all') => setDateFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="all">Todas as Tarefas</SelectItem>
                </SelectContent>
              </Select>

              {/* Limpar Filtros */}
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('all')
                  setPriorityFilter('all')
                  setSprintFilter('all')
                  setDateFilter('today')
                }}
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Tarefas Agrupadas por Sprint */}
      <div className="space-y-6">
        {Object.keys(groupedTasks).length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma tarefa encontrada</h3>
              <p className="text-muted-foreground">Tente ajustar os filtros para ver mais resultados.</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedTasks).map(([sprintName, sprintTasks]) => (
            <Card key={sprintName}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-500" />
                    <CardTitle className="text-lg">{sprintName}</CardTitle>
                    <Badge variant="outline">{sprintTasks.length} tarefa{sprintTasks.length !== 1 ? 's' : ''}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sprintTasks.map(task => (
                    <div key={task.id} className="border rounded-lg p-4 hover:bg-card transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          {/* Título e prioridade */}
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${getPriorityColor(task.priority)}`} />
                            <h4 className="font-medium text-foreground">{task.title}</h4>
                            <Badge variant="outline" className={getStatusColor(task.status)}>
                              {getStatusIcon(task.status)}
                              <span className="ml-1">
                                  {task.status === 'TODO' ? 'A Fazer' :
                                   task.status === 'IN_PROGRESS' ? 'Em Progresso' :
                                   task.status === 'IN_REVIEW' ? 'Para Revisar' : 'Concluída'}
                              </span>
                            </Badge>
                          </div>

                          {/* Descrição */}
                          {task.description && (
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                          )}

                          {/* Informações adicionais */}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {task.project.name}
                            </span>
                            
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

                        {/* Ações e Timer */}
                        <div className="ml-4 flex flex-col items-end gap-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => {
                                setSelectedTask(task)
                                setDetailsModalOpen(true)
                              }}
                            >
                              <FileText className="w-4 h-4" />
                              Ver Detalhes
                            </Button>
                            <AddTaskImagesModal 
                              token={token} 
                              taskId={task.id} 
                              onUpdated={fetchTasks} 
                            />
                          </div>

                          <TaskTimer 
                            taskId={task.id}
                            taskTitle={task.title}
                            currentStatus={task.status}
                            userId={collaborator?.id || ''}
                            onStatusChange={fetchTasks}
                          />
                        </div>
                      </div>
                      <div className="mt-3">
                        <TaskChecklist token={token} taskId={task.id} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      
        <TaskDetailsModal
          task={selectedTask}
          open={detailsModalOpen}
          onOpenChange={setDetailsModalOpen}
          token={token}
        />
    </div>
  )
}

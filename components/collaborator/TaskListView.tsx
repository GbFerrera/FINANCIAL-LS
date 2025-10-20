'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  User,
  Building2
} from 'lucide-react'
import { format } from 'date-fns'
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

interface TaskListViewProps {
  token: string
}

export function TaskListView({ token }: TaskListViewProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [collaborator, setCollaborator] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sprintFilter, setSprintFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<'today' | 'all'>('today')

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

    setFilteredTasks(filtered)
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
          <h2 className="text-2xl font-bold text-gray-900">
            Minhas Tarefas {dateFilter === 'today' ? '- Hoje' : ''}
          </h2>
          <p className="text-gray-600">
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma tarefa encontrada</h3>
              <p className="text-gray-600">Tente ajustar os filtros para ver mais resultados.</p>
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
                    <div key={task.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          {/* Título e prioridade */}
                          <div className="flex items-center gap-2">
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

                          {/* Descrição */}
                          {task.description && (
                            <p className="text-sm text-gray-600">{task.description}</p>
                          )}

                          {/* Informações adicionais */}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
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

                        {/* Timer */}
                        <div className="ml-4">
                          <TaskTimer 
                            taskId={task.id}
                            taskTitle={task.title}
                            currentStatus={task.status}
                            userId={collaborator?.userId || ''}
                            onStatusChange={fetchTasks}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

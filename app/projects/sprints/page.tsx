'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { 
  Target, 
  Calendar, 
  TrendingUp, 
  Search,
  Filter,
  Eye,
  Edit,
  Play,
  Pause,
  CheckCircle2,
  Plus
} from 'lucide-react'
import Link from 'next/link'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CreateSprintModal } from '@/components/scrum/CreateSprintModal'

interface Sprint {
  id: string
  name: string
  description?: string
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  startDate: string
  endDate: string
  goal?: string
  capacity?: number
  project?: {
    id: string
    name: string
    client: {
      name: string
    }
  }
  projects?: Array<{
    id: string
    name: string
    client: {
      id: string
      name: string
    }
  }>
  tasks: Array<{
    id: string
    storyPoints?: number
    status: string
  }>
}

export default function SprintsPage() {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [filteredSprints, setFilteredSprints] = useState<Sprint[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showCreateSprint, setShowCreateSprint] = useState(false)

  useEffect(() => {
    fetchSprints()
  }, [])

  useEffect(() => {
    filterSprints()
  }, [sprints, searchTerm, statusFilter])

  const fetchSprints = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/sprints/all')
      if (response.ok) {
        const data = await response.json()
        console.log('Sprints carregadas:', data)
        setSprints(data)
      } else {
        console.error('Erro na resposta:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Erro ao carregar sprints:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterSprints = () => {
    let filtered = sprints || []

    // Filtro por texto
    if (searchTerm) {
      filtered = filtered.filter(sprint => {
        const searchLower = searchTerm.toLowerCase()
        return sprint.name.toLowerCase().includes(searchLower) ||
          sprint.project?.name.toLowerCase().includes(searchLower) ||
          sprint.project?.client.name.toLowerCase().includes(searchLower) ||
          (sprint.projects && sprint.projects.some(p => 
            p.name.toLowerCase().includes(searchLower) ||
            p.client.name.toLowerCase().includes(searchLower)
          ))
      })
    }

    // Filtro por status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(sprint => sprint.status === statusFilter)
    }

    setFilteredSprints(filtered)
  }

  const getSprintMetrics = (sprint: Sprint) => {
    const totalStoryPoints = sprint.tasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0)
    const completedStoryPoints = sprint.tasks
      .filter(task => task.status === 'COMPLETED')
      .reduce((sum, task) => sum + (task.storyPoints || 0), 0)
    
    const progress = totalStoryPoints > 0 ? Math.round((completedStoryPoints / totalStoryPoints) * 100) : 0
    const completedTasks = sprint.tasks.filter(t => t.status === 'COMPLETED').length
    
    return {
      totalStoryPoints,
      completedStoryPoints,
      progress,
      totalTasks: sprint.tasks.length,
      completedTasks
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return 'bg-yellow-100 text-yellow-800'
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return <Calendar className="w-4 h-4" />
      case 'ACTIVE':
        return <Play className="w-4 h-4" />
      case 'COMPLETED':
        return <CheckCircle2 className="w-4 h-4" />
      case 'CANCELLED':
        return <Pause className="w-4 h-4" />
      default:
        return <Calendar className="w-4 h-4" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return 'Planejamento'
      case 'ACTIVE':
        return 'Ativa'
      case 'COMPLETED':
        return 'Concluída'
      case 'CANCELLED':
        return 'Cancelada'
      default:
        return 'Planejamento'
    }
  }

  const getDaysRemaining = (sprint: Sprint) => {
    const today = new Date()
    const endDate = new Date(sprint.endDate)
    const startDate = new Date(sprint.startDate)
    
    if (sprint.status === 'COMPLETED' || sprint.status === 'CANCELLED') {
      return null
    }
    
    if (today < startDate) {
      const daysToStart = differenceInDays(startDate, today)
      return `Inicia em ${daysToStart} dia${daysToStart !== 1 ? 's' : ''}`
    }
    
    if (today > endDate) {
      const daysOverdue = differenceInDays(today, endDate)
      return `Atrasada ${daysOverdue} dia${daysOverdue !== 1 ? 's' : ''}`
    }
    
    const daysRemaining = differenceInDays(endDate, today)
    return `${daysRemaining} dia${daysRemaining !== 1 ? 's' : ''} restante${daysRemaining !== 1 ? 's' : ''}`
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Todas as Sprints</h1>
          <p className="text-gray-600">Visualize e gerencie todas as sprints dos seus projetos</p>
        </div>
        <Button
          onClick={() => setShowCreateSprint(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Sprint
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar sprints, projetos ou clientes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">Todos os Status</option>
                <option value="PLANNING">Planejamento</option>
                <option value="ACTIVE">Ativa</option>
                <option value="COMPLETED">Concluída</option>
                <option value="CANCELLED">Cancelada</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Sprints */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredSprints.map(sprint => {
          const metrics = getSprintMetrics(sprint)
          const daysRemaining = getDaysRemaining(sprint)
          
          return (
            <Card key={sprint.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-1">{sprint.name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {sprint.project?.name || (sprint.projects && sprint.projects.length > 0 
                        ? `${sprint.projects.length} projeto${sprint.projects.length > 1 ? 's' : ''}` 
                        : 'Nenhum projeto')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {sprint.project?.client?.name || (sprint.projects && sprint.projects.length > 0 
                        ? sprint.projects.map(p => p.client.name).join(', ')
                        : 'Sem cliente')}
                    </p>
                  </div>
                  <Badge className={`${getStatusColor(sprint.status)} flex items-center gap-1 ml-2`}>
                    {getStatusIcon(sprint.status)}
                    {getStatusLabel(sprint.status)}
                  </Badge>
                </div>
                
                {sprint.goal && (
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{sprint.goal}</p>
                )}
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {/* Datas */}
                  <div className="text-sm text-gray-600">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {format(new Date(sprint.startDate), 'dd/MM', { locale: ptBR })} - {format(new Date(sprint.endDate), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    </div>
                    {daysRemaining && (
                      <p className="text-xs text-gray-500 ml-6">{daysRemaining}</p>
                    )}
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-500" />
                      <span>{metrics.completedTasks}/{metrics.totalTasks} tarefas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-purple-500" />
                      <span>{metrics.completedStoryPoints}/{metrics.totalStoryPoints} SP</span>
                    </div>
                  </div>

                  {/* Barra de Progresso */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Progresso</span>
                      <span>{metrics.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${metrics.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2 pt-2">
                    <Link href={`/projects/${sprint.project?.id || (sprint.projects && sprint.projects[0]?.id) || 'unknown'}/scrum?sprint=${sprint.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Eye className="w-4 h-4 mr-2" />
                        Ver
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredSprints.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || statusFilter !== 'all' ? 'Nenhuma sprint encontrada' : 'Nenhuma sprint criada'}
            </h3>
            <p className="text-gray-600">
              {searchTerm || statusFilter !== 'all' 
                ? 'Tente ajustar os filtros de busca' 
                : 'Crie sprints nos seus projetos para vê-las aqui'
              }
            </p>
          </CardContent>
        </Card>
      )}
      </div>

      {/* Modal de Criação de Sprint */}
      <CreateSprintModal
        isOpen={showCreateSprint}
        onClose={() => setShowCreateSprint(false)}
        onSuccess={fetchSprints}
      />
    </DashboardLayout>
  )
}

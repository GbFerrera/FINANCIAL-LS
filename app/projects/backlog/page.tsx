'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { 
  Calendar, 
  Search,
  Filter,
  User,
  Flag,
  Target,
  Plus,
  Eye,
  Edit
} from 'lucide-react'
import Link from 'next/link'
import { TaskCard } from '@/components/scrum/TaskCard'
import { TaskFilters } from '@/components/scrum/TaskFilters'

interface Task {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  storyPoints?: number
  dueDate?: string
  assignee?: {
    id: string
    name: string
    email: string
    avatar?: string
  }
  project: {
    id: string
    name: string
    client: {
      name: string
    }
  }
}

interface FilterOptions {
  search?: string
  status?: string[]
  priority?: string[]
  assigneeId?: string[]
  projectId?: string
  storyPointsMin?: number
  storyPointsMax?: number
}

export default function BacklogPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterOptions>({})
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards')

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    filterTasks()
  }, [tasks, filters])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Buscar todas as tarefas do backlog
      const [tasksRes, projectsRes, teamRes] = await Promise.all([
        fetch('/api/backlog/all'),
        fetch('/api/projects'),
        fetch('/api/team')
      ])

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        setTasks(tasksData)
      }

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json()
        // A API retorna { projects: [], pagination: {} }
        setProjects(projectsData.projects || [])
      }

      if (teamRes.ok) {
        const teamData = await teamRes.json()
        // A API retorna { users: [], pagination: {} }
        setTeamMembers(teamData.users || [])
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterTasks = () => {
    let filtered = tasks || []

    // Filtro por texto
    if (filters.search) {
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(filters.search!.toLowerCase()) ||
        task.description?.toLowerCase().includes(filters.search!.toLowerCase()) ||
        task.project.name.toLowerCase().includes(filters.search!.toLowerCase()) ||
        task.project.client.name.toLowerCase().includes(filters.search!.toLowerCase())
      )
    }

    // Filtro por status
    if (filters.status?.length) {
      filtered = filtered.filter(task => filters.status!.includes(task.status))
    }

    // Filtro por prioridade
    if (filters.priority?.length) {
      filtered = filtered.filter(task => filters.priority!.includes(task.priority))
    }

    // Filtro por responsável
    if (filters.assigneeId?.length) {
      filtered = filtered.filter(task => 
        task.assignee && filters.assigneeId!.includes(task.assignee.id)
      )
    }

    // Filtro por projeto
    if (filters.projectId) {
      filtered = filtered.filter(task => task.project.id === filters.projectId)
    }

    // Filtro por story points
    if (filters.storyPointsMin !== undefined) {
      filtered = filtered.filter(task => (task.storyPoints || 0) >= filters.storyPointsMin!)
    }
    if (filters.storyPointsMax !== undefined) {
      filtered = filtered.filter(task => (task.storyPoints || 0) <= filters.storyPointsMax!)
    }

    setFilteredTasks(filtered)
  }

  const getBacklogStats = () => {
    const totalTasks = tasks.length
    const totalStoryPoints = tasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0)
    const tasksByPriority = tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const tasksByProject = tasks.reduce((acc, task) => {
      const projectName = task.project.name
      acc[projectName] = (acc[projectName] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalTasks,
      totalStoryPoints,
      tasksByPriority,
      tasksByProject
    }
  }

  const stats = getBacklogStats()

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
          <h1 className="text-2xl font-bold text-gray-900">Backlog Geral</h1>
          <p className="text-gray-600">Todas as tarefas não atribuídas a sprints</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'cards' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('cards')}
          >
            Cards
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            Lista
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Tarefas</p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalTasks}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Story Points</p>
                <p className="text-2xl font-bold text-purple-600">{stats.totalStoryPoints}</p>
              </div>
              <Target className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Alta Prioridade</p>
                <p className="text-2xl font-bold text-red-600">
                  {(stats.tasksByPriority.HIGH || 0) + (stats.tasksByPriority.URGENT || 0)}
                </p>
              </div>
              <Flag className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Projetos</p>
                <p className="text-2xl font-bold text-green-600">
                  {Object.keys(stats.tasksByProject).length}
                </p>
              </div>
              <User className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <TaskFilters
        filters={filters}
        onFiltersChange={setFilters}
        teamMembers={teamMembers}
        sprints={[]} // Backlog não tem sprints
      />

      {/* Filtro adicional por projeto */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filters.projectId || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, projectId: e.target.value || undefined }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Todos os Projetos</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} - {project.client.name}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-500">
              {filteredTasks.length} de {tasks.length} tarefas
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Tarefas */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tarefa
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Projeto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prioridade
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SP
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Responsável
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTasks.map(task => (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{task.title}</div>
                          {task.description && (
                            <div className="text-sm text-gray-500 line-clamp-1">{task.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900">{task.project.name}</div>
                        <div className="text-sm text-gray-500">{task.project.client.name}</div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge 
                          variant={task.priority === 'URGENT' || task.priority === 'HIGH' ? 'destructive' : 'secondary'}
                        >
                          {task.priority === 'LOW' ? 'Baixa' : 
                           task.priority === 'MEDIUM' ? 'Média' :
                           task.priority === 'HIGH' ? 'Alta' : 'Urgente'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {task.storyPoints || '-'}
                      </td>
                      <td className="px-4 py-4">
                        {task.assignee ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-xs">
                              {task.assignee.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm text-gray-900">{task.assignee.name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">Não atribuído</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <Link href={`/projects/${task.project.id}/scrum`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredTasks.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {Object.keys(filters).length > 0 ? 'Nenhuma tarefa encontrada' : 'Backlog vazio'}
            </h3>
            <p className="text-gray-600">
              {Object.keys(filters).length > 0 
                ? 'Tente ajustar os filtros de busca' 
                : 'Todas as tarefas foram atribuídas a sprints ou não há tarefas criadas'
              }
            </p>
          </CardContent>
        </Card>
      )}
      </div>
    </DashboardLayout>
  )
}

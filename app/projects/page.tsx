"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { parseISO } from "date-fns"
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  FolderOpen,
  Target,
  ListTodo
} from "lucide-react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { StatsCard } from "@/components/ui/stats-card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import toast from "react-hot-toast"

interface Project {
  id: string
  name: string
  description: string
  status: 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
  startDate: string
  endDate: string | null
  budget: number
  clientName: string
  teamCount: number
  milestonesCount: number
  completedMilestones: number
  tasksCount: number
  completedTasks: number
  progress: number
  createdAt: string
}

interface ProjectStats {
  totalProjects: number
  activeProjects: number
  completedProjects: number
  totalBudget: number
  averageProgress: number
}

interface Client {
  id: string
  name: string
  email: string
  company: string
}

interface NewProject {
  name: string
  description: string
  clientId: string
  status: 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
  startDate: string
  endDate: string
  budget: number
}

export default function ProjectsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [stats, setStats] = useState<ProjectStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [newProject, setNewProject] = useState<NewProject>({
    name: '',
    description: '',
    clientId: '',
    status: 'PLANNING',
    startDate: '',
    endDate: '',
    budget: 0
  })
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    fetchProjects()
  }, [session, status, router])

  useEffect(() => {
    if (session && status === "authenticated") {
      fetchClients()
    }
  }, [session, status])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/projects/list')
      
      if (!response.ok) {
        throw new Error('Falha ao carregar projetos')
      }
      
      const data = await response.json()
      setProjects(data.projects)
      setStats(data.stats)
    } catch (error) {
      console.error('Erro ao buscar projetos:', error)
      toast.error('Erro ao carregar projetos')
    } finally {
      setLoading(false)
    }
  }

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients')
      if (response.ok) {
        const data = await response.json()
        setClients(data.clients.map((client: any) => ({
          id: client.id,
          name: client.name,
          email: client.email,
          company: client.company || ''
        })))
      }
    } catch (error) {
      console.error('Erro ao buscar clientes:', error)
    }
  }

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newProject.name || !newProject.clientId || !newProject.startDate) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    try {
      const isEditing = editingProject !== null
      const url = isEditing ? `/api/projects/${editingProject.id}` : '/api/projects'
      const method = isEditing ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newProject.name,
          description: newProject.description,
          clientId: newProject.clientId,
          status: newProject.status,
          startDate: newProject.startDate,
          endDate: newProject.endDate || undefined,
          budget: newProject.budget || undefined
        })
      })

      if (response.ok) {
        toast.success(isEditing ? 'Projeto atualizado com sucesso!' : 'Projeto criado com sucesso!')
        setShowAddModal(false)
        setEditingProject(null)
        setNewProject({
          name: '',
          description: '',
          clientId: '',
          status: 'PLANNING',
          startDate: '',
          endDate: '',
          budget: 0
        })
        fetchProjects()
      } else {
        const error = await response.json()
        toast.error(error.error || (isEditing ? 'Erro ao atualizar projeto' : 'Erro ao criar projeto'))
      }
    } catch (error) {
      console.error('Erro ao salvar projeto:', error)
      toast.error('Erro ao salvar projeto')
    }
  }

  const handleEditProject = (project: Project) => {
    setEditingProject(project)
    setNewProject({
      name: project.name,
      description: project.description,
      clientId: '', // Será preenchido quando tivermos a relação client
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate || '',
      budget: project.budget
    })
    setShowAddModal(true)
  }

  const handleDeleteProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return

    const confirmMessage = `⚠️ ATENÇÃO: Esta ação irá excluir permanentemente o projeto "${project.name}" e TODOS os dados relacionados:

` +
      `• ${project.tasksCount} tarefa(s)
` +
      `• ${project.milestonesCount} milestone(s)
` +
      `• ${project.teamCount} membro(s) da equipe
` +
      `• Todos os arquivos do projeto
` +
      `• Todos os comentários
` +
      `• Notificações relacionadas
\n` +
      `Esta ação NÃO PODE ser desfeita!\n\n` +
      `Tem certeza que deseja continuar?`

    if (!confirm(confirmMessage)) {
      return
    }

    try {
      setDeletingProjectId(projectId)
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Projeto e todos os dados relacionados foram excluídos com sucesso!')
        fetchProjects()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Erro ao excluir projeto')
      }
    } catch (error) {
      console.error('Erro ao excluir projeto:', error)
      toast.error('Erro ao excluir projeto')
    } finally {
      setDeletingProjectId(null)
    }
  }

  const filteredProjects = projects.filter(project => {
    const matchesSearch = searchTerm === '' ||
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.clientName.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter
    const matchesClient = clientFilter === 'all' || project.clientName === clientFilter
    
    return matchesSearch && matchesStatus && matchesClient
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return 'bg-blue-100 text-blue-800'
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800'
      case 'ON_HOLD':
        return 'bg-gray-100 text-gray-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return Clock
      case 'IN_PROGRESS':
        return AlertCircle
      case 'ON_HOLD':
        return XCircle
      case 'COMPLETED':
        return CheckCircle
      case 'CANCELLED':
        return XCircle
      default:
        return Clock
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return 'Planejamento'
      case 'IN_PROGRESS':
        return 'Em Andamento'
      case 'ON_HOLD':
        return 'Pausado'
      case 'COMPLETED':
        return 'Concluído'
      case 'CANCELLED':
        return 'Cancelado'
      default:
        return status
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return parseISO(dateString).toLocaleDateString('pt-BR')
  }

  if (status === "loading" || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Gestão de Projetos
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Gerencie projetos, milestones e tarefas da sua equipe
            </p>
          </div>
          <div className="mt-4 flex space-x-3 md:mt-0 md:ml-4">
            {session?.user.role === 'ADMIN' && (
              <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
                <DialogTrigger asChild>
                  <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="-ml-1 mr-2 h-5 w-5" />
                    Novo Projeto
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingProject ? 'Editar Projeto' : 'Novo Projeto'}</DialogTitle>
                    <DialogDescription>
                      {editingProject ? 'Edite as informações do projeto.' : 'Crie um novo projeto vinculado a um cliente existente.'}
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleSubmitProject} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome do Projeto *
                      </label>
                      <input
                        type="text"
                        value={newProject.name}
                        onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Digite o nome do projeto"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descrição
                      </label>
                      <textarea
                        value={newProject.description}
                        onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Descreva o projeto"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cliente *
                      </label>
                      <select
                        value={newProject.clientId}
                        onChange={(e) => setNewProject({ ...newProject, clientId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Selecione um cliente</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name} {client.company && `- ${client.company}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Status
                        </label>
                        <select
                          value={newProject.status}
                          onChange={(e) => setNewProject({ ...newProject, status: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="PLANNING">Planejamento</option>
                          <option value="IN_PROGRESS">Em Andamento</option>
                          <option value="ON_HOLD">Pausado</option>
                          <option value="COMPLETED">Concluído</option>
                          <option value="CANCELLED">Cancelado</option>
                        </select>
                      </div>

                      <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">
                           Orçamento (R$)
                         </label>
                         <input
                           type="text"
                           value={newProject.budget ? formatCurrency(newProject.budget) : ''}
                           onChange={(e) => {
                             const value = e.target.value.replace(/\D/g, '')
                             const numericValue = value ? Number(value) / 100 : 0
                             setNewProject({ ...newProject, budget: numericValue })
                           }}
                           className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                           placeholder="R$ 0,00"
                         />
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Data de Início *
                        </label>
                        <input
                          type="date"
                          value={newProject.startDate}
                          onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Data de Fim
                        </label>
                        <input
                          type="date"
                          value={newProject.endDate}
                          onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddModal(false)
                          setEditingProject(null)
                          setNewProject({
                            name: '',
                            description: '',
                            clientId: '',
                            status: 'PLANNING',
                            startDate: '',
                            endDate: '',
                            budget: 0
                          })
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                      >
                        {editingProject ? 'Atualizar Projeto' : 'Criar Projeto'}
                      </button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
            <StatsCard
              title="Total de Projetos"
              value={stats.totalProjects.toString()}
              icon={FolderOpen}
              color="blue"
              change={{
                value: `${stats.activeProjects} ativos`,
                type: 'neutral'
              }}
            />
            <StatsCard
              title="Em Andamento"
              value={stats.activeProjects.toString()}
              icon={AlertCircle}
              color="yellow"
              change={{
                value: `${((stats.activeProjects / stats.totalProjects) * 100).toFixed(0)}% do total`,
                type: 'neutral'
              }}
            />
            <StatsCard
              title="Concluídos"
              value={stats.completedProjects.toString()}
              icon={CheckCircle}
              color="green"
              change={{
                value: `${((stats.completedProjects / stats.totalProjects) * 100).toFixed(0)}% do total`,
                type: 'neutral'
              }}
            />
            <StatsCard
              title="Orçamento Total"
              value={formatCurrency(stats.totalBudget)}
              icon={Target}
              color="blue"
              change={{
                value: `${stats.totalProjects} projetos`,
                type: 'neutral'
              }}
            />
            <StatsCard
              title="Progresso Médio"
              value={`${stats.averageProgress.toFixed(1)}%`}
              icon={ListTodo}
              color="purple"
              change={{
                value: 'Todos os projetos',
                type: 'neutral'
              }}
            />
          </div>
        )}

        {/* Filters */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Search */}
              <div className="sm:col-span-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por nome do projeto ou cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              
              {/* Status Filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                >
                  <option value="all">Todos os status</option>
                  <option value="PLANNING">Planejamento</option>
                  <option value="IN_PROGRESS">Em Andamento</option>
                  <option value="ON_HOLD">Pausado</option>
                  <option value="COMPLETED">Concluído</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
              </div>
              
              {/* Client Filter */}
              <div>
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                >
                  <option value="all">Todos os clientes</option>
                  {Array.from(new Set(projects.map(p => p.clientName))).sort().map((clientName) => (
                    <option key={clientName} value={clientName}>
                      {clientName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Projetos ({filteredProjects.length})
            </h3>
            
            {filteredProjects.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum projeto encontrado</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm || statusFilter !== 'all' || clientFilter !== 'all' ? 'Tente ajustar os filtros' : 'Comece criando um novo projeto'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.map((project) => {
                  const StatusIcon = getStatusIcon(project.status)
                  return (
                    <div key={project.id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-6">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h4 className="text-lg font-medium text-gray-900 truncate">
                              {project.name}
                            </h4>
                            <p className="text-sm text-gray-500 mt-1">
                              Cliente: {project.clientName}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {getStatusLabel(project.status)}
                            </span>
                            <button className="text-gray-400 hover:text-gray-600">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                          {project.description}
                        </p>

                        {/* Progress */}
                        <div className="mb-4">
                          <div className="flex justify-between text-sm text-gray-600 mb-1">
                            <span>Progresso</span>
                            <span>{project.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${project.progress}%` }}
                            />
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="text-center">
                            <div className="text-lg font-semibold text-gray-900">
                              {project.completedMilestones}/{project.milestonesCount}
                            </div>
                            <div className="text-xs text-gray-500">Milestones</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold text-gray-900">
                              {project.completedTasks}/{project.tasksCount}
                            </div>
                            <div className="text-xs text-gray-500">Tarefas</div>
                          </div>
                        </div>

                        {/* Meta info */}
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            {project.teamCount} membros
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {formatDate(project.startDate)}
                          </div>
                        </div>

                        {/* Budget */}
                        <div className="text-sm text-gray-600 mb-4">
                          <strong>Orçamento:</strong> {formatCurrency(project.budget)}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                          <button 
                            onClick={() => router.push(`/projects/${project.id}`)}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver Detalhes
                          </button>
                          
                          {session?.user.role === 'ADMIN' && (
                            <div className="flex space-x-2">
                              <button 
                                onClick={() => handleEditProject(project)}
                                className="text-gray-400 hover:text-gray-600"
                                title="Editar projeto"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteProject(project.id)}
                                disabled={deletingProjectId === project.id}
                                className="text-red-400 hover:text-red-600 disabled:opacity-50"
                                title="Excluir projeto"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>


    </DashboardLayout>
  )
}
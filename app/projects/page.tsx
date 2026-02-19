"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { } from "date-fns"
import {
  Plus,
  Search,
  Calendar,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  FolderOpen,
  Target,
  Presentation,
  Telescope,
  LayoutGrid,
  List
} from "lucide-react"
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
  partners?: string[]
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
  additionalClientIds: string[]
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
    budget: 0,
    additionalClientIds: []
  })
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const openOrCreateSprint = async (projectId: string) => {
    try {
      const sprintsRes = await fetch(`/api/sprints?projectId=${projectId}`)
      if (!sprintsRes.ok) throw new Error('Falha ao verificar sprints')
      const sprintsData = await sprintsRes.json()
      const hasSprints = Array.isArray(sprintsData) ? sprintsData.length > 0 : (sprintsData?.sprints?.length > 0)
      if (hasSprints) {
        router.push('/projects/sprints')
        return
      }
      const now = new Date()
      const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
      const name = `Sprint ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const createRes = await fetch('/api/sprints/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: '',
          projectIds: [projectId],
          startDate: now.toISOString(),
          endDate: end.toISOString(),
          goal: '',
          capacity: null
        })
      })
      if (!createRes.ok) throw new Error('Falha ao criar sprint')
      toast.success('Sprint criada')
      router.push('/projects/sprints')
    } catch (e) {
      toast.error('Não foi possível abrir/criar a sprint')
      console.error(e)
    }
  }

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
        setClients(data.clients.map((client: { id: string; name: string; email: string; company?: string }) => ({
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
      
      // Converter datas para ISO com meio-dia UTC para evitar problema de fuso horário
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
          startDate: newProject.startDate ? newProject.startDate + 'T12:00:00.000Z' : newProject.startDate,
          endDate: newProject.endDate ? newProject.endDate + 'T12:00:00.000Z' : undefined,
          budget: newProject.budget || undefined,
          additionalClientIds: newProject.additionalClientIds.filter(id => id && id !== newProject.clientId)
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
          budget: 0,
          additionalClientIds: []
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
      clientId: '',
      status: project.status,
      startDate: toDateInput(project.startDate),
      endDate: toDateInput(project.endDate),
      budget: project.budget,
      additionalClientIds: []
    })
    setShowAddModal(true)
    fetch(`/api/projects/${project.id}`).then(async (res) => {
      if (!res.ok) return
      const full = await res.json()
      setNewProject({
        name: full.name || project.name,
        description: full.description || project.description || '',
        clientId: full.client?.id || '',
        status: full.status || project.status,
        startDate: toDateInput(full.startDate || project.startDate),
        endDate: toDateInput(full.endDate || project.endDate),
        budget: Number(full.budget) || 0,
        additionalClientIds: (full.clients || [])
          .map((pc: { client: { id: string } }) => pc.client.id)
          .filter((cid: string) => cid && cid !== full.client?.id)
      })
    }).catch(() => {})
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

  const LINK_SYSTEM_PROJECT_ID = 'cmfv5cmde001lm701frdbxgo4'
  
  const filteredProjects = projects.filter(project => {
    const matchesSearch = searchTerm === '' ||
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.clientName.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter
    const matchesClient = clientFilter === 'all' || project.clientName === clientFilter
    
    return matchesSearch && matchesStatus && matchesClient
  })

  // Separar projeto Link System dos demais
  const linkSystemProject = filteredProjects.find(p => p.id === LINK_SYSTEM_PROJECT_ID)
  const otherProjects = filteredProjects.filter(p => p.id !== LINK_SYSTEM_PROJECT_ID)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'ON_HOLD':
        return 'bg-muted text-muted-foreground'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      default:
        return 'bg-muted text-muted-foreground'
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
    // Extrair apenas a parte da data (YYYY-MM-DD) sem conversão de fuso horário
    const datePart = dateString.split('T')[0]
    const [year, month, day] = datePart.split('-')
    return `${day}/${month}/${year}`
  }
  
  const toDateInput = (iso: string | null) => {
    if (!iso) return ''
    const parts = iso.split('T')
    return parts[0] || ''
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 md:flex-nowrap">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-foreground sm:text-3xl sm:truncate">
              Gestão de Projetos
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie projetos, milestones e tarefas da sua equipe
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 md:mt-0 md:ml-4">
            <div className="inline-flex items-center bg-card p-1 rounded-lg border border-input shadow-sm">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
                title="Visualização em Grade"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="text-sm font-medium">Grade</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
                title="Visualização em Lista"
              >
                <List className="h-4 w-4" />
                <span className="text-sm font-medium">Linha</span>
              </button>
            </div>
            <button
              onClick={() => router.push('/projects/cmfv5cmde001lm701frdbxgo4/canvas')}
              className="inline-flex items-center px-4 py-2 border border-primary rounded-md shadow-sm text-sm font-medium text-primary bg-card hover:bg-primary/10 transition-colors"
              title="Ver Canvas da Link System"
            >
              <Presentation className="-ml-1 mr-2 h-5 w-5" />
              Canvas Link System
            </button>
            {session?.user.role === 'ADMIN' && (
              <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
                <DialogTrigger asChild>
                  <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors">
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
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Nome do Projeto *
                      </label>
                      <input
                        type="text"
                        value={newProject.name}
                        onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                        className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
                        placeholder="Digite o nome do projeto"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Descrição
                      </label>
                      <textarea
                        value={newProject.description}
                        onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                        className="w-full h-[300px] px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
                        placeholder="Descreva o projeto"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Cliente *
                      </label>
                      <select
                        value={newProject.clientId}
                        onChange={(e) => setNewProject({ ...newProject, clientId: e.target.value })}
                        className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
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

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Clientes adicionais (opcional)
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-input rounded p-2 bg-card">
                        {clients
                          .filter(c => c.id !== newProject.clientId)
                          .map((client) => {
                            const checked = newProject.additionalClientIds.includes(client.id)
                            return (
                              <label key={client.id} className="flex items-center gap-2 text-sm text-foreground">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    setNewProject(prev => ({
                                      ...prev,
                                      additionalClientIds: e.target.checked
                                        ? [...prev.additionalClientIds, client.id]
                                        : prev.additionalClientIds.filter(id => id !== client.id)
                                    }))
                                  }}
                                />
                                <span>
                                  {client.name} {client.company && `- ${client.company}`}
                                </span>
                              </label>
                            )
                          })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Status
                        </label>
                        <select
                          value={newProject.status}
                          onChange={(e) => setNewProject({ ...newProject, status: e.target.value as NewProject['status'] })}
                          className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
                        >
                          <option value="PLANNING">Planejamento</option>
                          <option value="IN_PROGRESS">Em Andamento</option>
                          <option value="ON_HOLD">Pausado</option>
                          <option value="COMPLETED">Concluído</option>
                          <option value="CANCELLED">Cancelado</option>
                        </select>
                      </div>

                      <div>
                         <label className="block text-sm font-medium text-foreground mb-1">
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
                           className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
                           placeholder="R$ 0,00"
                         />
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Data de Início *
                        </label>
                        <input
                          type="date"
                          value={newProject.startDate}
                          onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                          className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Data de Fim
                        </label>
                        <input
                          type="date"
                          value={newProject.endDate}
                          onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
                          className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
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
                            budget: 0,
                            additionalClientIds: []
                          })
                        }}
                        className="px-4 py-2 text-sm font-medium text-secondary-foreground bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
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
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2">
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
  
          </div>
        )}

        {/* Filters */}
        <div className="bg-secondary shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Search */}
              <div className="sm:col-span-2 lg:col-span-1">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-input rounded-md leading-5 bg-card placeholder:text-muted-foreground focus:outline-none focus:placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
                  />
                </div>
              </div>
              
              {/* Status Filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="block w-full pl-3 pr-10 py-2 text-base border-input focus:outline-none focus:ring-primary focus:border-primary rounded-md bg-card text-foreground"
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
                  className="block w-full pl-3 pr-10 py-2 text-base border-input focus:outline-none focus:ring-primary focus:border-primary rounded-md bg-card text-foreground"
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
        <div className="bg-card shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-foreground mb-6">
              Projetos ({filteredProjects.length})
            </h3>
            
            {filteredProjects.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium text-foreground">Nenhum projeto encontrado</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchTerm || statusFilter !== 'all' || clientFilter !== 'all' ? 'Tente ajustar os filtros' : 'Comece criando um novo projeto'}
                </p>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? "grid grid-cols-1 gap-6 sm:grid-cols-2" : "flex flex-col gap-4"}>
                {/* Projeto Link System sempre primeiro */}
                {linkSystemProject && (() => {
                  const StatusIcon = getStatusIcon(linkSystemProject.status)
                  return viewMode === 'grid' ? (
                    <div key={linkSystemProject.id} className="bg-card border-2 border-indigo-400 rounded-lg shadow-md hover:shadow-lg transition-shadow relative">
                      {/* Badge Fixo */}
                      <div className="absolute -top-2 -left-2 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                        FIXO
                      </div>
                      <div className="p-6">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h4 className="text-lg font-medium text-foreground truncate">
                              {linkSystemProject.name}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Cliente: {linkSystemProject.clientName}
                            </p>
                            {linkSystemProject.partners && linkSystemProject.partners.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Parceiros: {linkSystemProject.partners.join(', ')}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(linkSystemProject.status)}`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {getStatusLabel(linkSystemProject.status)}
                            </span>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                          {linkSystemProject.description}
                        </p>

                        {/* Progress */}
                        <div className="mb-4">
                          <div className="flex justify-between text-sm text-muted-foreground mb-1">
                            <span>Progresso</span>
                            <span>{linkSystemProject.progress}%</span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div 
                              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${linkSystemProject.progress}%` }}
                            />
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="text-center">
                            <div className="text-lg font-semibold text-foreground">
                              {linkSystemProject.completedMilestones}/{linkSystemProject.milestonesCount}
                            </div>
                            <div className="text-xs text-muted-foreground">Milestones</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold text-foreground">
                              {linkSystemProject.completedTasks}/{linkSystemProject.tasksCount}
                            </div>
                            <div className="text-xs text-muted-foreground">Tarefas</div>
                          </div>
                        </div>

                        {/* Meta info */}
                        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            {linkSystemProject.teamCount} membros
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {formatDate(linkSystemProject.startDate)}
                          </div>
                        </div>

                        {/* Budget */}
                        <div className="text-sm text-muted-foreground mb-4">
                          <strong>Orçamento:</strong> {formatCurrency(linkSystemProject.budget)}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-muted">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => router.push(`/projects/${linkSystemProject.id}`)}
                              className="inline-flex items-center px-3 py-1.5 border border-input shadow-sm text-xs font-medium rounded text-foreground bg-card hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                              <Telescope className="h-3 w-3 mr-1" />
                              Ver Detalhes
                            </button>
                            <button 
                              onClick={() => router.push(`/projects/notes?projectId=${linkSystemProject.id}`)}
                              className="inline-flex items-center px-3 py-1.5 border border-input shadow-sm text-xs font-medium rounded text-foreground bg-card hover:bg-accent hover:text-accent-foreground transition-colors"
                              title="Abrir anotações do projeto"
                            >
                              <FolderOpen className="h-3 w-3 mr-1" />
                              Docs
                            </button>
                            <button 
                              onClick={() => openOrCreateSprint(linkSystemProject.id)}
                              className="inline-flex items-center px-3 py-1.5 border border-primary shadow-sm text-xs font-medium rounded text-primary bg-card hover:bg-primary/10 transition-colors"
                              title="Abrir Sprints"
                            >
        
                              Sprints
                            </button>
                            <button 
                              onClick={() => router.push(`/projects/${linkSystemProject.id}/canvas`)}
                              className="inline-flex items-center px-3 py-1.5 border border-primary shadow-sm text-xs font-medium rounded text-primary bg-card hover:bg-primary/10 transition-colors"
                              title="Abrir Canvas (Excalidraw)"
                            >
                              Canvas
                            </button>
                          </div>
                          
                          {session?.user.role === 'ADMIN' && (
                            <div className="flex space-x-2">
                              <button 
                                onClick={() => handleEditProject(linkSystemProject)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                title="Editar projeto"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteProject(linkSystemProject.id)}
                                disabled={deletingProjectId === linkSystemProject.id}
                                className="text-destructive/70 hover:text-destructive disabled:opacity-50 transition-colors"
                                title="Excluir projeto"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div key={linkSystemProject.id} className="bg-card border-2 border-indigo-400 rounded-lg shadow-md hover:shadow-lg transition-shadow relative p-4 flex flex-col md:flex-row items-center gap-4">
                      {/* Badge Fixo */}
                      <div className="absolute -top-2 -left-2 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md z-10">
                        FIXO
                      </div>
                      
                      {/* Info Principal */}
                      <div className="flex-1 min-w-0 w-full md:w-auto ml-2">
                        <div className="flex items-center gap-2">
                            <h4 className="text-lg font-medium text-foreground truncate cursor-pointer hover:underline" onClick={() => router.push(`/projects/${linkSystemProject.id}`)}>
                              {linkSystemProject.name}
                            </h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center"><Users className="h-3 w-3 mr-1"/> {linkSystemProject.clientName}</span>
                            <span className="flex items-center"><Calendar className="h-3 w-3 mr-1"/> {formatDate(linkSystemProject.startDate)}</span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(linkSystemProject.status)}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {getStatusLabel(linkSystemProject.status)}
                        </span>
                      </div>

                      {/* Progresso Compacto */}
                      <div className="w-full md:w-32 flex-shrink-0 flex flex-col gap-1 hidden sm:flex">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{linkSystemProject.progress}%</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-1.5">
                          <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${linkSystemProject.progress}%` }} />
                        </div>
                      </div>

                      {/* Métricas Compactas */}
                      <div className="hidden lg:flex items-center gap-4 text-sm text-muted-foreground">
                         <div title="Milestones" className="flex items-center gap-1">
                            <Target className="w-4 h-4" />
                            <span>{linkSystemProject.completedMilestones}/{linkSystemProject.milestonesCount}</span>
                         </div>
                         <div title="Tarefas" className="flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            <span>{linkSystemProject.completedTasks}/{linkSystemProject.tasksCount}</span>
                         </div>
                      </div>

                      {/* Ações Simplificadas */}
                      <div className="flex items-center gap-2 ml-auto">
                        <button 
                          onClick={() => router.push(`/projects/${linkSystemProject.id}`)}
                          className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="Ver Detalhes"
                        >
                          <Telescope className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => openOrCreateSprint(linkSystemProject.id)}
                          className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="Sprints"
                        >
                           <Clock className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => router.push(`/projects/${linkSystemProject.id}/canvas`)}
                          className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="Canvas"
                        >
                           <Presentation className="h-4 w-4" />
                        </button>
                        
                        {session?.user.role === 'ADMIN' && (
                            <>
                              <button 
                                onClick={() => handleEditProject(linkSystemProject)}
                                className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                title="Editar"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteProject(linkSystemProject.id)}
                                disabled={deletingProjectId === linkSystemProject.id}
                                className="p-2 rounded-md hover:bg-destructive/10 text-destructive/70 hover:text-destructive transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Demais projetos */}
                {otherProjects.map((project) => {
                  const StatusIcon = getStatusIcon(project.status)
                  return viewMode === 'grid' ? (
                    <div key={project.id} className="bg-card border border-muted rounded-lg shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-6">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h4 className="text-lg font-medium text-foreground truncate">
                              {project.name}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Cliente: {project.clientName}
                            </p>
                            {project.partners && project.partners.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Parceiros: {project.partners.join(', ')}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {getStatusLabel(project.status)}
                            </span>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                          {project.description}
                        </p>

                        {/* Progress */}
                        <div className="mb-4">
                          <div className="flex justify-between text-sm text-muted-foreground mb-1">
                            <span>Progresso</span>
                            <span>{project.progress}%</span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div 
                              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${project.progress}%` }}
                            />
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="text-center">
                            <div className="text-lg font-semibold text-foreground">
                              {project.completedMilestones}/{project.milestonesCount}
                            </div>
                            <div className="text-xs text-muted-foreground">Milestones</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold text-foreground">
                              {project.completedTasks}/{project.tasksCount}
                            </div>
                            <div className="text-xs text-muted-foreground">Tarefas</div>
                          </div>
                        </div>

                        {/* Meta info */}
                        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
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
                        <div className="text-sm text-muted-foreground mb-4">
                          <strong>Orçamento:</strong> {formatCurrency(project.budget)}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-muted">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => router.push(`/projects/${project.id}`)}
                              className="inline-flex items-center px-3 py-1.5 border border-input shadow-sm text-xs font-medium rounded text-foreground bg-card hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                              <Telescope className="h-3 w-3 mr-1" />
                              Ver Detalhes
                            </button>
                            <button 
                              onClick={() => router.push(`/projects/notes?projectId=${project.id}`)}
                              className="inline-flex items-center px-3 py-1.5 border border-input shadow-sm text-xs font-medium rounded text-foreground bg-card hover:bg-accent hover:text-accent-foreground transition-colors"
                              title="Abrir anotações do projeto"
                            >
                              <FolderOpen className="h-3 w-3 mr-1" />
                              Docs
                            </button>
                            <button 
                              onClick={() => openOrCreateSprint(project.id)}
                              className="inline-flex items-center px-3 py-1.5 border border-primary shadow-sm text-xs font-medium rounded text-primary bg-card hover:bg-primary/10 transition-colors"
                              title="Abrir Sprints"
                            >
                              Sprints
                            </button>
                            <button 
                              onClick={() => router.push(`/projects/${project.id}/canvas`)}
                              className="inline-flex items-center px-3 py-1.5 border border-primary shadow-sm text-xs font-medium rounded text-primary bg-card hover:bg-primary/10 transition-colors"
                              title="Abrir Canvas (Excalidraw)"
                            >
                              Canvas
                            </button>
                          </div>
                          
                          {session?.user.role === 'ADMIN' && (
                            <div className="flex space-x-2">
                              <button 
                                onClick={() => handleEditProject(project)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                title="Editar projeto"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteProject(project.id)}
                                disabled={deletingProjectId === project.id}
                                className="text-destructive/70 hover:text-destructive disabled:opacity-50 transition-colors"
                                title="Excluir projeto"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div key={project.id} className="bg-card border border-muted rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col md:flex-row items-center gap-4">
                      {/* Info Principal */}
                      <div className="flex-1 min-w-0 w-full md:w-auto ml-2">
                        <div className="flex items-center gap-2">
                            <h4 className="text-lg font-medium text-foreground truncate cursor-pointer hover:underline" onClick={() => router.push(`/projects/${project.id}`)}>
                              {project.name}
                            </h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center"><Users className="h-3 w-3 mr-1"/> {project.clientName}</span>
                            <span className="flex items-center"><Calendar className="h-3 w-3 mr-1"/> {formatDate(project.startDate)}</span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {getStatusLabel(project.status)}
                        </span>
                      </div>

                      {/* Progresso Compacto */}
                      <div className="w-full md:w-32 flex-shrink-0 flex flex-col gap-1 hidden sm:flex">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{project.progress}%</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-1.5">
                          <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${project.progress}%` }} />
                        </div>
                      </div>

                      {/* Métricas Compactas */}
                      <div className="hidden lg:flex items-center gap-4 text-sm text-muted-foreground">
                         <div title="Milestones" className="flex items-center gap-1">
                            <Target className="w-4 h-4" />
                            <span>{project.completedMilestones}/{project.milestonesCount}</span>
                         </div>
                         <div title="Tarefas" className="flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            <span>{project.completedTasks}/{project.tasksCount}</span>
                         </div>
                      </div>

                      {/* Ações Simplificadas */}
                      <div className="flex items-center gap-2 ml-auto">
                        <button 
                          onClick={() => router.push(`/projects/${project.id}`)}
                          className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="Ver Detalhes"
                        >
                          <Telescope className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => router.push(`/projects/notes?projectId=${project.id}`)}
                          className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="Docs"
                        >
                          <FolderOpen className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => openOrCreateSprint(project.id)}
                          className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="Sprints"
                        >
                           <Clock className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => router.push(`/projects/${project.id}/canvas`)}
                          className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="Canvas"
                        >
                           <Presentation className="h-4 w-4" />
                        </button>
                        
                        {session?.user.role === 'ADMIN' && (
                            <>
                              <button 
                                onClick={() => handleEditProject(project)}
                                className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                title="Editar"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteProject(project.id)}
                                disabled={deletingProjectId === project.id}
                                className="p-2 rounded-md hover:bg-destructive/10 text-destructive/70 hover:text-destructive transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>


  )
}

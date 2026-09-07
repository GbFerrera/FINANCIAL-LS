"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { MODULES_LABEL, MODULES_LABEL_LOWER, MODULE_LABEL_LOWER } from '@/lib/module-labels'
import {
  Plus,
  Search,
  FolderOpen,
  Presentation,
  LayoutGrid,
  List,
} from "lucide-react"
import { StatsCard } from "@/components/ui/stats-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ProjectCatalogItem } from "@/components/projects/ProjectCatalogItem"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { ClientMultiPicker, ClientPicker } from "@/components/clients/client-picker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import toast from "react-hot-toast"
import { PageLoadingGate } from "@/components/ui/loading-animation"

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
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [stats, setStats] = useState<ProjectStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [showAddModal, setShowAddModal] = useState(false)
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

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

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId || loading || projects.length === 0) return
    const project = projects.find((p) => p.id === editId)
    if (!project) return
    handleEditProject(project)
    router.replace('/projects')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- abrir modal uma vez via query ?edit=
  }, [searchParams, loading, projects])

  const handleDeleteProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return

    const confirmMessage = `⚠️ ATENÇÃO: Esta ação irá excluir permanentemente o projeto "${project.name}" e TODOS os dados relacionados:

` +
      `• ${project.tasksCount} tarefa(s)
` +
      `• ${project.milestonesCount} ${MODULE_LABEL_LOWER}(s)
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

  const isAdmin = session?.user.role === 'ADMIN'

  const renderProjectItem = (project: Project, pinned = false) => (
    <ProjectCatalogItem
      key={project.id}
      project={project}
      viewMode={viewMode}
      pinned={pinned}
      modulesLabel={MODULES_LABEL}
      isAdmin={!!isAdmin}
      isDeleting={deletingProjectId === project.id}
      onOpen={() => router.push(`/projects/${project.id}`)}
      onNotes={() => router.push(`/projects/notes?projectId=${project.id}`)}
      onSprints={() => openOrCreateSprint(project.id)}
      onCanvas={() => router.push(`/projects/${project.id}/canvas`)}
      onEdit={isAdmin ? () => handleEditProject(project) : undefined}
      onDelete={isAdmin ? () => handleDeleteProject(project.id) : undefined}
    />
  )

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const toDateInput = (iso: string | null) => {
    if (!iso) return ''
    const parts = iso.split('T')
    return parts[0] || ''
  }

  return (
    <PageLoadingGate loading={status === "loading" || loading}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Projetos</h1>
            <p className="mt-1 text-muted-foreground">
              Gerencie projetos, {MODULES_LABEL_LOWER} e tarefas da sua equipe
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-md border border-border/80 bg-muted/30 p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('grid')}
                className={cn(
                  'h-8 gap-1.5 rounded-sm px-3 text-xs font-medium text-muted-foreground',
                  viewMode === 'grid' && 'bg-background text-foreground shadow-sm'
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Grade
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('list')}
                className={cn(
                  'h-8 gap-1.5 rounded-sm px-3 text-xs font-medium text-muted-foreground',
                  viewMode === 'list' && 'bg-background text-foreground shadow-sm'
                )}
              >
                <List className="h-3.5 w-3.5" />
                Lista
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push('/projects/cmfv5cmde001lm701frdbxgo4/canvas')}
            >
              <Presentation className="mr-2 h-4 w-4" />
              Canvas Link System
            </Button>
            {isAdmin && (
              <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo projeto
                  </Button>
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
                      <ClientPicker
                        value={newProject.clientId}
                        onChange={(clientId) =>
                          setNewProject((prev) => ({
                            ...prev,
                            clientId,
                            additionalClientIds: prev.additionalClientIds.filter((id) => id !== clientId),
                          }))
                        }
                        placeholder="Selecione um cliente"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Clientes adicionais (opcional)
                      </label>
                      <ClientMultiPicker
                        values={newProject.additionalClientIds}
                        onChange={(ids) =>
                          setNewProject((prev) => ({
                            ...prev,
                            additionalClientIds: ids.filter((id) => id && id !== prev.clientId),
                          }))
                        }
                        excludeIds={[newProject.clientId]}
                        placeholder="Nenhum cliente adicional selecionado"
                      />
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

        {stats && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatsCard
              title="Total de projetos"
              value={stats.totalProjects}
              change={{ value: `${stats.activeProjects} ativos`, type: 'neutral' }}
            />
            <StatsCard
              title="Em andamento"
              value={stats.activeProjects}
              change={{
                value: `${stats.totalProjects > 0 ? ((stats.activeProjects / stats.totalProjects) * 100).toFixed(0) : 0}% do total`,
                type: 'neutral',
              }}
            />
            <StatsCard
              title="Concluídos"
              value={stats.completedProjects}
              change={{
                value: `${stats.totalProjects > 0 ? ((stats.completedProjects / stats.totalProjects) * 100).toFixed(0) : 0}% do total`,
                type: 'neutral',
              }}
            />
            {isAdmin && (
              <StatsCard
                title="Orçamento total"
                value={formatCurrency(stats.totalBudget)}
                change={{ value: `${stats.totalProjects} projetos`, type: 'neutral' }}
              />
            )}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar projeto ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 border-border/80 bg-background pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-full min-w-[160px] sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="PLANNING">Planejamento</SelectItem>
                  <SelectItem value="IN_PROGRESS">Em andamento</SelectItem>
                  <SelectItem value="ON_HOLD">Pausado</SelectItem>
                  <SelectItem value="COMPLETED">Concluído</SelectItem>
                  <SelectItem value="CANCELLED">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-9 w-full min-w-[160px] sm:w-[200px]">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {Array.from(new Set(projects.map((p) => p.clientName)))
                    .sort()
                    .map((clientName) => (
                      <SelectItem key={clientName} value={clientName}>
                        {clientName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <TooltipProvider delayDuration={200}>
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-medium text-foreground">
                {filteredProjects.length} projeto{filteredProjects.length !== 1 ? 's' : ''}
              </h2>
            </div>

            {filteredProjects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground" />
                <h3 className="mt-3 text-sm font-medium text-foreground">Nenhum projeto encontrado</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchTerm || statusFilter !== 'all' || clientFilter !== 'all'
                    ? 'Tente ajustar os filtros'
                    : 'Comece criando um novo projeto'}
                </p>
                {isAdmin && !searchTerm && statusFilter === 'all' && clientFilter === 'all' && (
                  <Button className="mt-4" onClick={() => setShowAddModal(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo projeto
                  </Button>
                )}
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-4 xl:grid-cols-2' : 'flex flex-col gap-3'}>
                {linkSystemProject && renderProjectItem(linkSystemProject, true)}
                {otherProjects.map((project) => renderProjectItem(project))}
              </div>
            )}
          </div>
        </TooltipProvider>

      </div>


    </PageLoadingGate>
  )
}

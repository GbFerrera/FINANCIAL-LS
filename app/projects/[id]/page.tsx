"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { parseISO, format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { calculateEstimatedTime, formatEstimatedTime } from "@/lib/time-utils"
import { calculateBasicProjectProgress } from "@/lib/progress-utils"
import {
  ArrowLeft,
  Calendar,
  Users,
  DollarSign,
  Target,
  CheckCircle,
  Plus,
  Edit,
  Trash2,
  User,
  Flag,
  LayoutList,

  Kanban as KanbanIcon,
  Maximize,
  Minimize,
  Telescope,
 GitBranch,
  File as FileIcon,
  FileText,
  Image,
  Archive,
  Video,
  Music,
  Download
} from "lucide-react"
import {

  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import toast from "react-hot-toast"
import { KanbanBoard } from "@/components/projects/KanbanBoard"
import { ProjectCreateTaskModal } from "@/components/projects/ProjectCreateTaskModal"

interface ProjectDetails {
  id: string
  name: string
  description: string
  status: string
  startDate: string
  endDate: string | null
  budget: number
  client: {
    id: string
    name: string
    email: string
    company: string | null
  }
  team: Array<{
    id: string
    role: string
    joinedAt: string
    user: {
      id: string
      name: string
      email: string
      avatar: string | null
    }
  }>
  milestones: Array<{
    id: string
    name: string
    status: string
    dueDate: string | null
    completedAt: string | null
    order: number
  }>
  tasks: Array<{
    id: string
    title: string
    description: string | null
    status: string
    priority: string
    dueDate: string | null
    estimatedMinutes: number | null
    startDate: string | null
    startTime: string | null
    endTime: string | null
    milestone: {
      id: string
      name: string
      status: string
    } | null
    assignee: {
      id: string
      name: string
      email: string
      avatar: string | null
    } | null
  }>
  _count: {
    tasks: number
    milestones: number
    team: number
    comments: number
    files: number
  }
}

export default function ProjectDetailsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams() as { id: string }
  const [project, setProject] = useState<ProjectDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'milestones' | 'tasks' | 'team' | 'sprints' | 'files'>('overview')
  const [showAddMilestoneModal, setShowAddMilestoneModal] = useState(false)
  const [newMilestone, setNewMilestone] = useState({
    name: '',
    dueDate: '',
    status: 'PENDING'
  })
  const [editingMilestone, setEditingMilestone] = useState<any>(null)
  const [showAddTaskModal, setShowAddTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<any>(null)
  const [showAddTeamMemberModal, setShowAddTeamMemberModal] = useState(false)
  const [newTeamMember, setNewTeamMember] = useState({
    userId: '',
    role: 'MEMBER'
  })
  const [availableUsers, setAvailableUsers] = useState<Array<{id: string, name: string, email: string}>>([])  
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [sprints, setSprints] = useState<Array<{
    id: string
    name: string
    description: string | null
    startDate: string
    endDate: string
    goal: string | null
    capacity: number | null
    tasks?: Array<{ id: string; status: string }>
  }>>([])
  const [loadingSprints, setLoadingSprints] = useState(false)
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [kanbanFullScreen, setKanbanFullScreen] = useState(false)
  const [projectNotes, setProjectNotes] = useState<Array<{
    id: string
    title: string
    project: { id: string; name: string }
    createdBy: { id: string; name: string; email: string }
  }>>([])
  const [loadingProjectNotes, setLoadingProjectNotes] = useState(false)

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    if (params.id && typeof params.id === 'string') {
      fetchProjectDetails(params.id)
    }
  }, [session, status, router, params.id])

  useEffect(() => {
    if (activeTab === 'sprints' && params.id) {
      fetchSprints()
    }
    if (activeTab === 'files' && params.id) {
      fetchProjectNotes()
    }
  }, [activeTab, params.id])

  const isAdmin = session?.user.role === 'ADMIN'

  const fetchProjectDetails = async (projectId: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${projectId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Projeto não encontrado')
          router.push('/projects')
          return
        }
        throw new Error('Falha ao carregar detalhes do projeto')
      }
      
      const data = await response.json()
      setProject(data)
    } catch (error) {
      console.error('Erro ao buscar detalhes do projeto:', error)
      toast.error('Erro ao carregar detalhes do projeto')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNING':
      case 'PENDING':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'ON_HOLD':
        return 'bg-muted text-muted-foreground'
      case 'COMPLETED':
      case 'DONE':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      case 'TODO':
        return 'bg-secondary text-secondary-foreground'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const fetchSprints = async () => {
    if (!params.id) return
    try {
      setLoadingSprints(true)
      const response = await fetch(`/api/sprints?projectId=${params.id}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Falha ao carregar sprints')
      }
      const data = await response.json()
      setSprints(data || [])
    } catch (error) {
      console.error('Erro ao buscar sprints:', error)
      toast.error('Erro ao carregar sprints')
      setSprints([])
    } finally {
      setLoadingSprints(false)
    }
  }

  const fetchProjectNotes = async () => {
    if (!params.id) return
    try {
      setLoadingProjectNotes(true)
      const response = await fetch(`/api/notes?projectId=${params.id}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Falha ao carregar notas')
      }
      const data = await response.json()
      setProjectNotes(data.notes || [])
    } catch (error) {
      console.error('Erro ao buscar notas:', error)
      toast.error('Erro ao carregar notas')
      setProjectNotes([])
    } finally {
      setLoadingProjectNotes(false)
    }
  }


  // removido: lógica de SSE de comentários

  // removido: envio de comentários

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'text-red-700 dark:text-red-400'
      case 'MEDIUM':
        return 'text-yellow-700 dark:text-yellow-400'
      case 'LOW':
        return 'text-green-700 dark:text-green-400'
      default:
        return 'text-muted-foreground'
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

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '-'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (mime?: string, type?: string) => {
    if (type === 'folder') {
      return <Archive className="h-8 w-8 text-yellow-600" />
    }
    if (mime?.startsWith('image/')) {
      return <Image className="h-8 w-8 text-green-500" />
    } else if (mime?.startsWith('video/')) {
      return <Video className="h-8 w-8 text-red-500" />
    } else if (mime?.startsWith('audio/')) {
      return <Music className="h-8 w-8 text-purple-500" />
    } else if (mime?.includes('pdf')) {
      return <FileText className="h-8 w-8 text-red-600" />
    }
    return <FileIcon className="h-8 w-8 text-muted-foreground" />
  }

  const handleAddMilestone = async () => {
    if (!newMilestone.name.trim()) {
      toast.error('Nome do milestone é obrigatório')
      return
    }

    try {
      const response = await fetch(`/api/projects/${params.id}/milestones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newMilestone.name,
          dueDate: newMilestone.dueDate || null,
          status: newMilestone.status
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao criar milestone')
      }

      toast.success('Milestone criado com sucesso!')
      setShowAddMilestoneModal(false)
      setNewMilestone({ name: '', dueDate: '', status: 'PENDING' })
      
      // Recarregar dados do projeto
      if (params.id && typeof params.id === 'string') {
        fetchProjectDetails(params.id)
      }
    } catch (error) {
      console.error('Erro ao criar milestone:', error)
      toast.error('Erro ao criar milestone')
    }
  }

  const handleEditMilestone = async (milestoneId: string) => {
    if (!editingMilestone?.name.trim()) {
      toast.error('Nome do milestone é obrigatório')
      return
    }

    try {
      const response = await fetch(`/api/projects/${params.id}/milestones/${milestoneId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingMilestone.name,
          dueDate: editingMilestone.dueDate || null,
          status: editingMilestone.status
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao atualizar milestone')
      }

      toast.success('Milestone atualizado com sucesso!')
      setEditingMilestone(null)
      
      // Recarregar dados do projeto
      if (params.id && typeof params.id === 'string') {
        fetchProjectDetails(params.id)
      }
    } catch (error) {
      console.error('Erro ao atualizar milestone:', error)
      toast.error('Erro ao atualizar milestone')
    }
  }

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!confirm('Tem certeza que deseja excluir este milestone?')) {
      return
    }

    try {
      const response = await fetch(`/api/projects/${params.id}/milestones/${milestoneId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Erro ao excluir milestone')
      }

      toast.success('Milestone excluído com sucesso!')
      
      // Recarregar dados do projeto
      if (params.id && typeof params.id === 'string') {
        fetchProjectDetails(params.id)
      }
    } catch (error) {
      console.error('Erro ao excluir milestone:', error)
      toast.error('Erro ao excluir milestone')
    }
  }

  // Criação de tarefas agora utiliza ProjectCreateTaskModal (Scrum CreateTaskModal)



  const fetchAvailableUsers = async () => {
    try {
      setLoadingUsers(true)
      const response = await fetch('/api/team')
      if (response.ok) {
        const data = await response.json()
        const users = data.users || []
        // Filtrar usuários que já estão na equipe do projeto
        const currentTeamUserIds = project?.team.map(member => member.user.id) || []
        const availableUsers = users.filter((user: any) => !currentTeamUserIds.includes(user.id))
        setAvailableUsers(availableUsers)
      }
    } catch (error) {
      console.error('Erro ao buscar usuários:', error)
      toast.error('Erro ao carregar usuários disponíveis')
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleAddTeamMember = async () => {
    if (!newTeamMember.userId) {
      toast.error('Selecione um usuário')
      return
    }

    try {
      const response = await fetch(`/api/projects/${params.id}/team`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: newTeamMember.userId,
          role: newTeamMember.role,
        }),
      })

      if (response.ok) {
        toast.success('Membro adicionado à equipe com sucesso!')
        setShowAddTeamMemberModal(false)
        setNewTeamMember({ userId: '', role: 'MEMBER' })
        setAvailableUsers([])
        // Recarregar dados do projeto
        window.location.reload()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Erro ao adicionar membro à equipe')
      }
    } catch (error) {
      console.error('Erro ao adicionar membro à equipe:', error)
      toast.error('Erro ao adicionar membro à equipe')
    }
  }

  const handleRemoveTeamMember = async (userId: string) => {
    if (!confirm('Tem certeza que deseja remover este membro da equipe?')) {
      return
    }

    try {
      const response = await fetch(`/api/projects/${params.id}/team/${userId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Erro ao remover membro')
      }

      toast.success('Membro removido da equipe com sucesso!')
      
      // Recarregar dados do projeto
      if (params.id && typeof params.id === 'string') {
        fetchProjectDetails(params.id)
      }
    } catch (error) {
      console.error('Erro ao remover membro:', error)
      toast.error('Erro ao remover membro')
    }
  }

  const handleViewTaskDetails = async (taskId: string) => {
    try {
      const response = await fetch(`/api/projects/${params.id}/tasks/${taskId}`)
      if (response.ok) {
        const task = await response.json()
        setSelectedTask(task)
        setShowTaskDetailsModal(true)
      } else {
        toast.error('Erro ao carregar detalhes da tarefa')
      }
    } catch (error) {
      console.error('Erro ao carregar tarefa:', error)
      toast.error('Erro ao carregar detalhes da tarefa')
    }
  }

  const handleEditTask = async (task: any) => {
    try {
      const response = await fetch(`/api/projects/${params.id}/tasks/${task.id}`)
      if (!response.ok) {
        throw new Error('Falha ao carregar detalhes da tarefa')
      }
      const full = await response.json()
      setEditingTask({
        id: full.id,
        title: full.title,
        description: full.description || '',
        status: full.status,
        priority: full.priority,
        storyPoints: full.storyPoints ?? 1,
        assigneeId: full.assignee?.id ?? full.assigneeId,
        milestoneId: full.milestoneId ?? full.milestone?.id,
        dueDate: full.dueDate ? new Date(full.dueDate).toISOString().split('T')[0] : undefined,
        startDate: full.startDate ? new Date(full.startDate).toISOString().split('T')[0] : undefined,
        startTime: full.startTime || undefined,
        estimatedMinutes: full.estimatedMinutes ?? undefined
      })
      setShowAddTaskModal(true)
    } catch (error) {
      console.error('Erro ao carregar detalhes da tarefa para edição:', error)
      toast.error('Erro ao carregar detalhes da tarefa para edição')
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) {
      return
    }

    try {
      const response = await fetch(`/api/projects/${params.id}/tasks/${taskId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Tarefa excluída com sucesso!')
        if (params.id && typeof params.id === 'string') {
          fetchProjectDetails(params.id)
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Erro ao excluir tarefa')
      }
    } catch (error) {
      console.error('Erro ao excluir tarefa:', error)
      toast.error('Erro ao excluir tarefa')
    }
  }

  const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
    if (!project || !params?.id) return;
    
    const taskToUpdate = project.tasks.find(t => t.id === taskId);
    if (!taskToUpdate) return;

    try {
      const response = await fetch(`/api/projects/${params.id}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atualizar status')
      }
      setProject(prev => {
        if (!prev) return prev
        return {
          ...prev,
          tasks: prev.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
        }
      })
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      toast.error('Erro ao atualizar status')
      throw error;
    }
  }

  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), 'dd/MM/yyyy', { locale: ptBR })
  }

  const formatTaskEstimatedTime = (task: any) => {
    const hours = calculateEstimatedTime(task)
    return formatEstimatedTime(hours)
  }

  if (status === "loading" || loading) {
    return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
    )
  }

  if (!project) {
    return (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-foreground">Projeto não encontrado</h3>
          <button
            onClick={() => router.push('/projects')}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-secondary-foreground bg-secondary hover:bg-secondary/80"
          >
            <ArrowLeft className="-ml-1 mr-2 h-4 w-4" />
            Voltar aos Projetos
          </button>
        </div>
    )
  }

  const completedMilestones = project.milestones.filter(m => m.status === 'COMPLETED' || !!m.completedAt).length
  const completedTasks = project.tasks.filter(t => t.status === 'DONE' || t.status === 'COMPLETED').length
  const progress = calculateBasicProjectProgress(project.milestones, project.tasks)

  return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-card shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => router.push('/projects')}
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar aos Projetos
              </button>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => params?.id && router.push(`/projects/${params.id}/canvas`)}
                  className="inline-flex items-center px-3 py-1.5 border border-primary/30 shadow-sm text-sm font-medium rounded text-primary bg-card hover:bg-primary/5 transition-colors"
                  title="Abrir Canvas (Excalidraw)"
                >
                  Canvas
                </button>
                {session?.user.role === 'ADMIN' && (
                  <button className="inline-flex items-center px-3 py-1.5 border border-input shadow-sm text-sm font-medium rounded text-foreground bg-card hover:bg-accent hover:text-accent-foreground transition-colors">
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
                <p className="mt-2 text-muted-foreground">{project.description}</p>
                
                <div className="mt-4 flex items-center space-x-6">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <User className="h-4 w-4 mr-1" />
                    Cliente: {project.client.name}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-1" />
                    Início: {formatDate(project.startDate)}
                  </div>
                  {project.endDate && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-1" />
                      Fim: {formatDate(project.endDate)}
                    </div>
                  )}
                  {session?.user.role === 'ADMIN' && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4 mr-1" />
                      {formatCurrency(project.budget)}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-end space-y-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                  {project.status === 'IN_PROGRESS' ? 'Em Andamento' : 
                   project.status === 'COMPLETED' ? 'Concluído' :
                   project.status === 'PLANNING' ? 'Planejamento' :
                   project.status === 'ON_HOLD' ? 'Pausado' : 'Cancelado'}
                </span>
                
                <div className="text-right">
                  <div className="text-2xl font-bold text-foreground">{progress}%</div>
                  <div className="text-sm text-muted-foreground">Progresso</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-card shadow rounded-lg">
          <div className="border-b border-border">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { id: 'overview', name: 'Visão Geral', icon: Telescope },
                { id: 'milestones', name: 'Milestones', icon: Flag },
                { id: 'tasks', name: 'Tarefas', icon: CheckCircle },
                { id: 'team', name: 'Equipe', icon: Users },
                { id: 'sprints', name: 'Sprints', icon: GitBranch },
                { id: 'files', name: 'Docs', icon: FileIcon }
              ].map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`${activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center relative transition-colors`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {tab.name}
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center">
                      <Flag className="h-8 w-8 text-primary" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-muted-foreground">Milestones</p>
                        <p className="text-2xl font-semibold text-foreground">
                          {completedMilestones}/{project.milestones.length}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center">
                      <CheckCircle className="h-8 w-8 text-primary" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-muted-foreground">Tarefas</p>
                        <p className="text-2xl font-semibold text-foreground">
                          {completedTasks}/{project.tasks.length}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center">
                      <Users className="h-8 w-8 text-primary" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-muted-foreground">Equipe</p>
                        <p className="text-2xl font-semibold text-foreground">
                          {project.team.length}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {session?.user.role === 'ADMIN' && (
                    <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                      <div className="flex items-center">
                        <DollarSign className="h-8 w-8 text-primary" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-muted-foreground">Orçamento</p>
                          <p className="text-lg font-semibold text-foreground">
                            {formatCurrency(project.budget)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-sm text-muted-foreground mb-2">
                    <span>Progresso Geral</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-3">
                    <div 
                      className="bg-primary h-3 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Milestones Tab */}
            {activeTab === 'milestones' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-foreground">
                    Milestones ({project.milestones.length})
                  </h3>
                  {session?.user.role === 'ADMIN' && (
                    <Dialog open={showAddMilestoneModal} onOpenChange={setShowAddMilestoneModal}>
                      <DialogTrigger asChild>
                        <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 transition-colors">
                          <Plus className="-ml-1 mr-2 h-4 w-4" />
                          Novo Milestone
                        </button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Novo Milestone</DialogTitle>
                          <DialogDescription>
                            Adicione um novo milestone ao projeto.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="name" className="text-right text-sm font-medium text-foreground">
                              Nome
                            </label>
                            <input
                              id="name"
                              value={newMilestone.name}
                              onChange={(e) => setNewMilestone({...newMilestone, name: e.target.value})}
                              className="col-span-3 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder="Nome do milestone"
                            />
                          </div>
                          <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="dueDate" className="text-right text-sm font-medium text-foreground">
                              Data
                            </label>
                            <input
                              id="dueDate"
                              type="date"
                              value={newMilestone.dueDate}
                              onChange={(e) => setNewMilestone({...newMilestone, dueDate: e.target.value})}
                              className="col-span-3 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="status" className="text-right text-sm font-medium text-foreground">
                              Status
                            </label>
                            <select
                              id="status"
                              value={newMilestone.status}
                              onChange={(e) => setNewMilestone({...newMilestone, status: e.target.value})}
                              className="col-span-3 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              <option value="PENDING">Pendente</option>
                              <option value="IN_PROGRESS">Em Andamento</option>
                              <option value="COMPLETED">Concluído</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              setShowAddMilestoneModal(false)
                              setNewMilestone({ name: '', dueDate: '', status: 'PENDING' })
                            }}
                            className="px-4 py-2 text-sm font-medium text-secondary-foreground bg-secondary border border-transparent rounded-md hover:bg-secondary/80 transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleAddMilestone}
                            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary border border-transparent rounded-md hover:bg-primary/90 transition-colors"
                          >
                            Criar Milestone
                          </button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                
                <div className="space-y-3">
                  {project.milestones.map((milestone) => (
                    <div key={milestone.id} className="border border-border rounded-lg p-4 bg-card">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h4 className="text-lg font-medium text-foreground">
                              {milestone.name}
                            </h4>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(milestone.status)}`}>
                              {milestone.status === 'PENDING' ? 'Pendente' :
                               milestone.status === 'IN_PROGRESS' ? 'Em Andamento' :
                               milestone.status === 'COMPLETED' ? 'Concluído' : milestone.status}
                            </span>
                          </div>
                          
                          <div className="mt-3 flex items-center space-x-4 text-sm text-muted-foreground">
                            {milestone.dueDate && (
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                Prazo: {formatDate(milestone.dueDate)}
                              </div>
                            )}
                            <div className="flex items-center">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Milestone #{milestone.order}
                            </div>
                          </div>
                        </div>
                        
                        {session?.user.role === 'ADMIN' && (
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => {
                                setEditingMilestone({
                                  id: milestone.id,
                                  name: milestone.name,
                                  dueDate: milestone.dueDate ? milestone.dueDate.split('T')[0] : '',
                                  status: milestone.status
                                })
                              }}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteMilestone(milestone.id)}
                              className="text-red-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal de Edição de Milestone */}
            {editingMilestone && (
              <Dialog open={!!editingMilestone} onOpenChange={() => setEditingMilestone(null)}>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Editar Milestone</DialogTitle>
                    <DialogDescription>
                      Edite as informações do milestone.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="edit-name" className="text-right text-sm font-medium text-foreground">
                        Nome
                      </label>
                      <input
                        id="edit-name"
                        value={editingMilestone.name}
                        onChange={(e) => setEditingMilestone({...editingMilestone, name: e.target.value})}
                        className="col-span-3 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Nome do milestone"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="edit-dueDate" className="text-right text-sm font-medium text-foreground">
                        Data
                      </label>
                      <input
                        id="edit-dueDate"
                        type="date"
                        value={editingMilestone.dueDate}
                        onChange={(e) => setEditingMilestone({...editingMilestone, dueDate: e.target.value})}
                        className="col-span-3 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="edit-status" className="text-right text-sm font-medium text-foreground">
                        Status
                      </label>
                      <select
                        id="edit-status"
                        value={editingMilestone.status}
                        onChange={(e) => setEditingMilestone({...editingMilestone, status: e.target.value})}
                        className="col-span-3 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="PENDING">Pendente</option>
                        <option value="IN_PROGRESS">Em Andamento</option>
                        <option value="COMPLETED">Concluído</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setEditingMilestone(null)}
                      className="px-4 py-2 text-sm font-medium text-secondary-foreground bg-secondary border border-transparent rounded-md hover:bg-secondary/80 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleEditMilestone(editingMilestone.id)}
                      className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary border border-transparent rounded-md hover:bg-primary/90 transition-colors"
                    >
                      Salvar Alterações
                    </button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Modal de Criação/Edição de Tarefa */}
            <ProjectCreateTaskModal
              isOpen={showAddTaskModal}
              onClose={() => {
                setShowAddTaskModal(false)
                setEditingTask(null)
              }}
              projectId={typeof params.id === 'string' ? params.id : ''}
              milestones={project.milestones}
              onSuccess={() => {
                if (typeof params.id === 'string') {
                  fetchProjectDetails(params.id)
                }
                setEditingTask(null)
              }}
              editingTask={editingTask}
            />

            {/* Modal de Adicionar Membro da Equipe */}
            <Dialog open={showAddTeamMemberModal} onOpenChange={setShowAddTeamMemberModal}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Adicionar Membro à Equipe</DialogTitle>
                  <DialogDescription>
                    Adicione um novo membro à equipe do projeto.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="team-user" className="text-right text-sm font-medium text-foreground">
                      Usuário *
                    </label>
                    <select
                      id="team-user"
                      value={newTeamMember.userId}
                      onChange={(e) => setNewTeamMember({...newTeamMember, userId: e.target.value})}
                      className="col-span-3 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={loadingUsers}
                    >
                      <option value="">Selecionar usuário</option>
                      {availableUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="team-role" className="text-right text-sm font-medium text-foreground">
                      Função
                    </label>
                    <select
                      id="team-role"
                      value={newTeamMember.role}
                      onChange={(e) => setNewTeamMember({...newTeamMember, role: e.target.value})}
                      className="col-span-3 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="MEMBER">Membro</option>
                      <option value="LEAD">Líder</option>
                      <option value="DEVELOPER">Desenvolvedor</option>
                      <option value="DESIGNER">Designer</option>
                      <option value="ANALYST">Analista</option>
                    </select>
                  </div>
                  {loadingUsers && (
                    <div className="text-center text-sm text-muted-foreground">
                      Carregando usuários disponíveis...
                    </div>
                  )}
                  {!loadingUsers && availableUsers.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground">
                      Nenhum usuário disponível para adicionar.
                    </div>
                  )}
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setShowAddTeamMemberModal(false)
                      setNewTeamMember({ userId: '', role: 'MEMBER' })
                      setAvailableUsers([])
                    }}
                    className="px-4 py-2 text-sm font-medium text-secondary-foreground bg-secondary border border-transparent rounded-md hover:bg-secondary/80 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddTeamMember}
                    disabled={!newTeamMember.userId || loadingUsers}
                    className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary border border-transparent rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Adicionar Membro
                  </button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Tasks Tab */}
            {activeTab === 'tasks' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-4">
                    <h3 className="text-lg font-medium text-foreground">
                      Tarefas ({project.tasks.filter(task => taskStatusFilter === 'all' || task.status === taskStatusFilter).length})
                    </h3>
                    <select
                      value={taskStatusFilter}
                      onChange={(e) => setTaskStatusFilter(e.target.value)}
                      className="px-3 py-1 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      <option value="all">Todos os Status</option>
                      <option value="TODO">A Fazer</option>
                      <option value="IN_PROGRESS">Em Andamento</option>
                      <option value="DONE">Concluído</option>
                    </select>

                    <div className="flex bg-muted rounded-md p-1 border border-border">
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded-sm transition-all ${
                          viewMode === 'list' 
                            ? 'bg-background shadow-sm text-primary' 
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        title="Visualização em Lista"
                      >
                        <LayoutList className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('kanban')}
                        className={`p-1.5 rounded-sm transition-all ${
                          viewMode === 'kanban' 
                            ? 'bg-background shadow-sm text-primary' 
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        title="Visualização em Kanban"
                      >
                        <KanbanIcon className="h-4 w-4" />
                      </button>
                      {viewMode === 'kanban' && (
                        <button
                          onClick={() => setKanbanFullScreen(true)}
                          className="p-1.5 rounded-sm transition-all text-muted-foreground hover:text-foreground"
                          title="Kanban em Tela Cheia"
                        >
                          <Maximize className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowAddTaskModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="-ml-1 mr-2 h-4 w-4" />
                    Nova Tarefa
                  </button>
                </div>
                
                {viewMode === 'list' ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Tarefa
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Prioridade
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Responsável
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Início
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Prazo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Tempo Estimado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Milestone
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {project.tasks
                        .filter(task => taskStatusFilter === 'all' || task.status === taskStatusFilter)
                        .map((task) => (
                        <tr key={task.id} className="hover:bg-muted/50 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <div 
                                className="text-sm font-medium text-foreground cursor-pointer hover:text-primary transition-colors"
                                onClick={() => handleViewTaskDetails(task.id)}
                              >
                                {task.title}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                              {task.status === 'TODO' ? 'A Fazer' :
                               task.status === 'IN_PROGRESS' ? 'Em Andamento' :
                               task.status === 'DONE' ? 'Concluído' : task.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Flag className={`h-4 w-4 ${getPriorityColor(task.priority)}`} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {task.assignee?.name || 'Não atribuído'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {task.startDate ? formatDate(task.startDate) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {task.dueDate ? formatDate(task.dueDate) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {formatTaskEstimatedTime(task)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {task.milestone?.name || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <button 
                                onClick={() => handleEditTask(task)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                title="Editar tarefa"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              {isAdmin && (
                                <button 
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                  title="Excluir tarefa"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                ) : (
                  <KanbanBoard 
                    tasks={project.tasks.filter(task => taskStatusFilter === 'all' || task.status === taskStatusFilter)} 
                    onTaskUpdate={handleTaskStatusChange}
                    onTaskClick={(taskId) => handleViewTaskDetails(taskId)}
                    onTaskEdit={handleEditTask}
                    onTaskDelete={isAdmin ? handleDeleteTask : undefined}
                  />
                )}
              </div>
            )}

            {/* Team Tab */}
            {activeTab === 'team' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-foreground">
                    Equipe ({project.team.length})
                  </h3>
                  {session?.user.role === 'ADMIN' && (
                    <button 
                      onClick={() => {
                        setShowAddTeamMemberModal(true)
                        fetchAvailableUsers()
                      }}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
                    >
                      <Plus className="-ml-1 mr-2 h-4 w-4" />
                      Adicionar Membro
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {project.team.map((member) => (
                    <div key={member.id} className="bg-card border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-6 w-6 text-primary" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {member.user.name}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {member.user.email}
                            </p>
                            <p className="text-xs text-muted-foreground/70">
                              {member.role}
                            </p>
                          </div>
                        </div>
                        {session?.user.role === 'ADMIN' && (
                          <button
                            onClick={() => handleRemoveTeamMember(member.user.id)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1 transition-colors"
                            title="Remover membro"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sprints Tab */}
            {activeTab === 'sprints' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-foreground">
                    Sprints ({sprints.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/projects/${params.id}/scrum`)}
                      className="inline-flex items-center px-3 py-1.5 border border-input text-sm font-medium rounded-md text-foreground bg-card hover:bg-accent hover:text-accent-foreground transition-colors"
                      title="Abrir Scrum do Projeto"
                    >
                      <KanbanIcon className="h-4 w-4 mr-1" />
                      Abrir Scrum
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {loadingSprints ? (
                    <div className="col-span-full flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : sprints.length === 0 ? (
                    <div className="col-span-full text-center py-12">
                      <KanbanIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <h3 className="mt-2 text-sm font-medium text-foreground">Nenhuma sprint vinculada</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Vincule sprints a este projeto pelo módulo Scrum.
                      </p>
                    </div>
                  ) : (
                    sprints.map((sprint) => (
                      <div key={sprint.id} className="bg-card border border-border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-foreground">{sprint.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(sprint.startDate)} — {formatDate(sprint.endDate)}
                            </p>
                          </div>
                          <button
                            onClick={() => router.push(`/projects/${params.id}/scrum?tab=board&sprint=${sprint.id}`)}
                            className="inline-flex items-center px-2 py-1 border border-input text-xs font-medium rounded-md text-foreground bg-card hover:bg-accent hover:text-accent-foreground transition-colors"
                            title="Abrir Quadro"
                          >
                            <KanbanIcon className="h-3 w-3 mr-1" />
                            Quadro
                          </button>
                        </div>
                        
                        {sprint.goal && (
                          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{sprint.goal}</p>
                        )}
                        
                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-xs text-muted-foreground">
                            Tarefas: {sprint.tasks?.length ?? 0}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Files Tab */}
            {activeTab === 'files' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-foreground">
                    Docs ({projectNotes.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    
                  </div>
                </div>
                
                {loadingProjectNotes ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : projectNotes.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-2 text-sm font-medium text-foreground">Nenhuma nota vinculada</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Crie notas em Notes e vincule ao projeto atual.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {projectNotes.map((note) => (
                      <div
                        key={note.id}
                        onClick={() => project?.id && router.push(`/projects/notes?projectId=${project.id}`)}
                        className="bg-card border border-border rounded-lg p-4 hover:bg-muted/40 transition-colors cursor-pointer"
                        title="Abrir Notes do Projeto"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                            <div className="ml-3">
                              <h4 className="text-sm font-medium text-foreground">{note.title}</h4>
                              <p className="text-xs text-muted-foreground">
                                Projeto: {note.project.name} • Autor: {note.createdBy.name}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal de Detalhes da Tarefa */}
        {project && (
          <ProjectCreateTaskModal
            isOpen={showAddTaskModal}
            onClose={() => {
              setShowAddTaskModal(false)
              setEditingTask(null)
            }}
            projectId={project.id}
            milestones={project.milestones}
            onSuccess={() => {
              setShowAddTaskModal(false)
              setEditingTask(null)
              if (project?.id) {
                fetchProjectDetails(project.id)
              }
            }}
            editingTask={editingTask}
          />
        )}

        {kanbanFullScreen && project && (
          <div className="fixed inset-0 z-50 bg-background">
            <div className="flex items-center justify-between p-4 border-b border-border bg-card">
              <div className="flex items-center gap-2">
                <KanbanIcon className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-medium text-foreground">Kanban — {project.name}</h2>
              </div>
              <button
                onClick={() => setKanbanFullScreen(false)}
                className="inline-flex items-center px-3 py-1.5 border border-input text-sm font-medium rounded-md text-foreground bg-card hover:bg-accent hover:text-accent-foreground transition-colors"
                title="Sair de Tela Cheia"
              >
                <Minimize className="-ml-1 mr-2 h-4 w-4" />
                Fechar
              </button>
            </div>
            <div className="p-4 h-[calc(100vh-64px)]">
              <KanbanBoard 
                tasks={project.tasks.filter(task => taskStatusFilter === 'all' || task.status === taskStatusFilter)} 
                onTaskUpdate={handleTaskStatusChange}
                onTaskClick={(taskId) => handleViewTaskDetails(taskId)}
                onTaskEdit={handleEditTask}
                onTaskDelete={isAdmin ? handleDeleteTask : undefined}
              />
            </div>
          </div>
        )}

        <Dialog open={showTaskDetailsModal} onOpenChange={setShowTaskDetailsModal}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Detalhes da Tarefa</DialogTitle>
            </DialogHeader>
            {selectedTask && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Título</label>
                  <p className="text-foreground">{selectedTask.title}</p>
                </div>
                {selectedTask.description && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Descrição</label>
                    <p className="text-foreground">{selectedTask.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <p className="text-foreground">
                      {selectedTask.status === 'TODO' ? 'A Fazer' :
                       selectedTask.status === 'IN_PROGRESS' ? 'Em Andamento' :
                       selectedTask.status === 'DONE' ? 'Concluído' : selectedTask.status}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Prioridade</label>
                    <p className="text-foreground">
                      {selectedTask.priority === 'LOW' ? 'Baixa' :
                       selectedTask.priority === 'MEDIUM' ? 'Média' :
                       selectedTask.priority === 'HIGH' ? 'Alta' : selectedTask.priority}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Responsável</label>
                    <p className="text-foreground">{selectedTask.assignee?.name || 'Não atribuído'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Prazo</label>
                    <p className="text-foreground">{selectedTask.dueDate ? formatDate(selectedTask.dueDate) : 'Não definido'}</p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>


      </div>
  )
}

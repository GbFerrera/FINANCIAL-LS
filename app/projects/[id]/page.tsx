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
  Clock,
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  User,
  Flag,
  MessageSquare,
  Paperclip,
  X,
  Bell
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
    status: string
    priority: string
    dueDate: string | null
    estimatedHours: number | null
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
  const params = useParams()
  const [project, setProject] = useState<ProjectDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'milestones' | 'tasks' | 'team' | 'comments'>('overview')
  const [showAddMilestoneModal, setShowAddMilestoneModal] = useState(false)
  const [newMilestone, setNewMilestone] = useState({
    name: '',
    dueDate: '',
    status: 'PENDING'
  })
  const [editingMilestone, setEditingMilestone] = useState<any>(null)
  const [showAddTaskModal, setShowAddTaskModal] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: '',
    assigneeId: '',
    milestoneId: '',
    startTime: '',
    endTime: ''
  })
  const [editingTask, setEditingTask] = useState<any>(null)
  const [showAddTeamMemberModal, setShowAddTeamMemberModal] = useState(false)
  const [newTeamMember, setNewTeamMember] = useState({
    userId: '',
    role: 'MEMBER'
  })
  const [availableUsers, setAvailableUsers] = useState<Array<{id: string, name: string, email: string}>>([])  
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false)
  const [showEditTaskModal, setShowEditTaskModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [editTaskData, setEditTaskData] = useState({
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    assigneeId: '',
    dueDate: '',
    startTime: '',
    endTime: ''
  })
  const [comments, setComments] = useState<Array<{
    id: string
    content: string
    type: string
    createdAt: string
    authorName: string
    authorId: string | null
    isFromClient: boolean
  }>>([])
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all')

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
    let eventSource: EventSource | null = null
    
    if (activeTab === 'comments' && params.id) {
      fetchComments()
      eventSource = connectToSSE() || null
      // Limpar notificação quando acessar a aba de comentários
      setHasNewMessages(false)
    }
    
    // Cleanup: fechar conexão SSE quando sair da aba de comentários
    return () => {
      if (eventSource) {
        eventSource.close()
        setIsConnected(false)
      }
    }
  }, [activeTab, params.id])

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

  // Carregar comentários iniciais
  const fetchComments = async () => {
    if (!params.id) return
    
    try {
      setLoadingComments(true)
      const response = await fetch(`/api/projects/${params.id}/comments`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Falha ao carregar comentários')
      }
      
      const data = await response.json()
      setComments(data.comments || [])
    } catch (error) {
      console.error('Erro ao buscar comentários:', error)
      toast.error('Erro ao carregar comentários')
      setComments([]) // Definir array vazio em caso de erro
    } finally {
      setLoadingComments(false)
    }
  }

  // Conectar ao SSE para atualizações em tempo real
  const connectToSSE = () => {
    if (!params.id) return

    const eventSource = new EventSource(`/api/projects/${params.id}/comments/stream`)
    
    eventSource.onopen = () => {
      setIsConnected(true)
      console.log('Conectado ao SSE para comentários em tempo real')
    }
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'connected') {
          console.log('SSE conectado para projeto:', data.projectId)
        } else if (data.type === 'new_comments') {
          // Adicionar novos comentários sem duplicar
          setComments(prev => {
            const existingIds = new Set(prev.map(c => c.id))
            const newComments = data.comments.filter((c: any) => !existingIds.has(c.id))
            return [...prev, ...newComments]
          })
          
          if (data.comments.length > 0) {
            // Se não estamos na aba de comentários, mostrar notificação
            if (activeTab !== 'comments') {
              setHasNewMessages(true)
            }
            toast.success('Nova mensagem recebida!')
          }
        }
      } catch (error) {
        console.error('Erro ao processar mensagem SSE:', error)
      }
    }
    
    eventSource.onerror = () => {
      setIsConnected(false)
      console.log('Erro na conexão SSE, tentando reconectar...')
      eventSource.close()
      
      // Tentar reconectar após 5 segundos
      setTimeout(() => {
        connectToSSE()
      }, 5000)
    }
    
    return eventSource
  }

  const sendComment = async () => {
    if (!newComment.trim() || !params.id) return
    
    try {
      setSendingComment(true)
      const response = await fetch(`/api/projects/${params.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: newComment.trim(),
          type: 'CLIENT_VISIBLE'
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Falha ao enviar comentário')
      }
      
      const result = await response.json()
      toast.success('Mensagem enviada com sucesso!')
      setNewComment('')
      
      // O SSE cuidará da atualização em tempo real
      // Não precisamos adicionar manualmente o comentário
    } catch (error) {
      console.error('Erro ao enviar comentário:', error)
      toast.error('Erro ao enviar mensagem')
    } finally {
      setSendingComment(false)
    }
  }

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

  const handleAddTask = async () => {
    if (!newTask.title.trim()) {
      toast.error('Título da tarefa é obrigatório')
      return
    }

    try {
      const response = await fetch(`/api/projects/${params.id}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newTask.title,
          description: newTask.description || null,
          status: newTask.status,
          priority: newTask.priority,
          dueDate: newTask.dueDate || null,
          assigneeId: newTask.assigneeId || null,
          milestoneId: newTask.milestoneId || null,
          startTime: newTask.startTime || null,
          endTime: newTask.endTime || null
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao criar tarefa')
      }

      toast.success('Tarefa criada com sucesso!')
      setShowAddTaskModal(false)
      setNewTask({
        title: '',
        description: '',
        status: 'TODO',
        priority: 'MEDIUM',
        dueDate: '',
        assigneeId: '',
        milestoneId: '',
        startTime: '',
        endTime: ''
      })
      
      // Recarregar dados do projeto
      if (params.id && typeof params.id === 'string') {
        fetchProjectDetails(params.id)
      }
    } catch (error) {
      console.error('Erro ao criar tarefa:', error)
      toast.error('Erro ao criar tarefa')
    }
  }



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

  const handleEditTask = (task: any) => {
    setEditTaskData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      assigneeId: task.assignee?.id || '',
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
      startTime: task.startTime ? new Date(task.startTime).toISOString().slice(0, 16) : '',
      endTime: task.endTime ? new Date(task.endTime).toISOString().slice(0, 16) : ''
    })
    setSelectedTask(task)
    setShowEditTaskModal(true)
  }

  const handleUpdateTask = async () => {
    if (!selectedTask) return

    try {
      const response = await fetch(`/api/projects/${params.id}/tasks/${selectedTask.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: editTaskData.title,
          description: editTaskData.description,
          status: editTaskData.status,
          priority: editTaskData.priority,
          assigneeId: editTaskData.assigneeId || null,
          dueDate: editTaskData.dueDate || null,
          startTime: editTaskData.startTime || null,
          endTime: editTaskData.endTime || null
        })
      })

      if (response.ok) {
        toast.success('Tarefa atualizada com sucesso!')
        setShowEditTaskModal(false)
        if (params.id && typeof params.id === 'string') {
          fetchProjectDetails(params.id)
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Erro ao atualizar tarefa')
      }
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error)
      toast.error('Erro ao atualizar tarefa')
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

  const completedMilestones = project.milestones.filter(m => m.status === 'COMPLETED').length
  const completedTasks = project.tasks.filter(t => t.status === 'DONE').length
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
                  <div className="flex items-center text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4 mr-1" />
                    {formatCurrency(project.budget)}
                  </div>
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
                { id: 'overview', name: 'Visão Geral', icon: Target },
                { id: 'milestones', name: 'Milestones', icon: Flag },
                { id: 'tasks', name: 'Tarefas', icon: CheckCircle },
                { id: 'team', name: 'Equipe', icon: Users },
                { id: 'comments', name: 'Comentários', icon: MessageSquare }
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
                    {tab.id === 'comments' && hasNewMessages && (
                      <Bell className="h-3 w-3 ml-1 text-red-500 animate-pulse" />
                    )}
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
                  <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center">
                      <Flag className="h-8 w-8 text-blue-800 dark:text-blue-300" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Milestones</p>
                        <p className="text-2xl font-semibold text-foreground">
                          {completedMilestones}/{project.milestones.length}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-center">
                      <CheckCircle className="h-8 w-8 text-green-800 dark:text-green-300" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-green-800 dark:text-green-300">Tarefas</p>
                        <p className="text-2xl font-semibold text-foreground">
                          {completedTasks}/{project.tasks.length}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                    <div className="flex items-center">
                      <Users className="h-8 w-8 text-purple-800 dark:text-purple-300" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-purple-800 dark:text-purple-300">Equipe</p>
                        <p className="text-2xl font-semibold text-foreground">
                          {project.team.length}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <div className="flex items-center">
                      <DollarSign className="h-8 w-8 text-yellow-800 dark:text-yellow-300" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Orçamento</p>
                        <p className="text-lg font-semibold text-foreground">
                          {formatCurrency(project.budget)}
                        </p>
                      </div>
                    </div>
                  </div>
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

            {/* Modal de Criação de Tarefa */}
            <Dialog open={showAddTaskModal} onOpenChange={setShowAddTaskModal}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Nova Tarefa</DialogTitle>
                  <DialogDescription>
                    Crie uma nova tarefa para o projeto.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="task-title" className="text-right text-sm font-medium text-foreground">
                      Título *
                    </label>
                    <input
                      id="task-title"
                      value={newTask.title}
                      onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                      className="col-span-3 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Título da tarefa"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="task-description" className="text-right text-sm font-medium text-foreground">
                      Descrição
                    </label>
                    <textarea
                      id="task-description"
                      value={newTask.description}
                      onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                      className="h-[450px] max-h-[70vh] overflow-y-auto resize-y col-span-3 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Descrição da tarefa"
                      rows={12}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="task-status" className="text-right text-sm font-medium text-foreground">
                      Status
                    </label>
                    <select
                      id="task-status"
                      value={newTask.status}
                      onChange={(e) => setNewTask({...newTask, status: e.target.value})}
                      className="col-span-3 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="TODO">A Fazer</option>
                      <option value="IN_PROGRESS">Em Andamento</option>
                      <option value="DONE">Concluído</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="task-priority" className="text-right text-sm font-medium text-foreground">
                      Prioridade
                    </label>
                    <select
                      id="task-priority"
                      value={newTask.priority}
                      onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                      className="col-span-3 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="LOW">Baixa</option>
                      <option value="MEDIUM">Média</option>
                      <option value="HIGH">Alta</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="task-dueDate" className="text-right text-sm font-medium text-foreground">
                      Prazo
                    </label>
                    <input
                      id="task-dueDate"
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                      className="col-span-3 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="task-assignee" className="text-right text-sm font-medium text-foreground">
                      Responsável
                    </label>
                    <select
                      id="task-assignee"
                      value={newTask.assigneeId}
                      onChange={(e) => setNewTask({...newTask, assigneeId: e.target.value})}
                      className="col-span-3 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Selecionar responsável</option>
                      {project?.team.map((member) => (
                        <option key={member.user.id} value={member.user.id}>
                          {member.user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="task-milestone" className="text-right text-sm font-medium text-foreground">
                      Milestone
                    </label>
                    <select
                      id="task-milestone"
                      value={newTask.milestoneId}
                      onChange={(e) => setNewTask({...newTask, milestoneId: e.target.value})}
                      className="col-span-3 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Selecionar milestone</option>
                      {project?.milestones.map((milestone) => (
                        <option key={milestone.id} value={milestone.id}>
                          {milestone.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="task-startTime" className="text-right text-sm font-medium text-foreground">
                      Horário de Início
                    </label>
                    <input
                      id="task-startTime"
                      type="datetime-local"
                      value={newTask.startTime}
                      onChange={(e) => setNewTask({...newTask, startTime: e.target.value})}
                      className="col-span-3 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="task-endTime" className="text-right text-sm font-medium text-foreground">
                      Horário de Término
                    </label>
                    <input
                      id="task-endTime"
                      type="datetime-local"
                      value={newTask.endTime}
                      onChange={(e) => setNewTask({...newTask, endTime: e.target.value})}
                      className="col-span-3 px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setShowAddTaskModal(false)
                      setNewTask({
                        title: '',
                        description: '',
                        status: 'TODO',
                        priority: 'MEDIUM',
                        dueDate: '',
                        assigneeId: '',
                        milestoneId: '',
                        startTime: '',
                        endTime: ''
                      })
                    }}
                    className="px-4 py-2 text-sm font-medium text-secondary-foreground bg-secondary border border-transparent rounded-md hover:bg-secondary/80 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddTask}
                    className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary border border-transparent rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Criar Tarefa
                  </button>
                </div>
              </DialogContent>
            </Dialog>

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
                  </div>
                  {session?.user.role === 'ADMIN' && (
                    <button 
                      onClick={() => setShowAddTaskModal(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
                    >
                      <Plus className="-ml-1 mr-2 h-4 w-4" />
                      Nova Tarefa
                    </button>
                  )}
                </div>
                
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
                            {task.dueDate ? formatDate(task.dueDate) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {formatTaskEstimatedTime(task)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {task.milestone?.name || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {session?.user.role === 'ADMIN' && (
                              <div className="flex items-center justify-end space-x-2">
                                <button 
                                  onClick={() => handleEditTask(task)}
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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

            {/* Comments Tab */}
            {activeTab === 'comments' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-foreground">
                    Mensagens ({project._count.comments})
                  </h3>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      isConnected ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <span className="text-sm text-muted-foreground">
                      {isConnected ? 'Tempo real ativo' : 'Desconectado'}
                    </span>
                  </div>
                </div>
                
                {/* Messages List */}
                <div className="bg-card border border-border rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h4 className="text-lg font-medium text-foreground mb-4">
                      Conversas - {project.name}
                    </h4>
                    
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {loadingComments ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                      ) : comments.length === 0 ? (
                        <div className="text-center py-8">
                          <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
                          <h3 className="mt-2 text-sm font-medium text-foreground">Nenhuma mensagem</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Inicie uma conversa enviando uma mensagem.
                          </p>
                        </div>
                      ) : (
                        comments.map((comment) => (
                          <div key={comment.id} className={`flex ${
                            comment.type === 'CLIENT_REQUEST' || comment.isFromClient 
                              ? 'justify-end' 
                              : 'justify-start'
                          }`}>
                            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              comment.type === 'CLIENT_REQUEST' || comment.isFromClient
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted text-foreground'
                            }`}>
                              <p className="text-sm">{comment.content}</p>
                              <p className={`text-xs mt-1 ${
                                comment.type === 'CLIENT_REQUEST' || comment.isFromClient
                                  ? 'text-primary-foreground/80' 
                                  : 'text-muted-foreground'
                              }`}>
                                {comment.authorName} • {parseISO(comment.createdAt).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Send Message */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex space-x-4">
                    <div className="flex-1">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Digite sua mensagem..."
                        rows={3}
                        className="block w-full bg-background border-input rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                      />
                    </div>
                    <button
                      onClick={sendComment}
                      disabled={!newComment.trim() || sendingComment}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {sendingComment ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal de Detalhes da Tarefa */}
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

        {/* Modal de Editar Tarefa */}
        <Dialog open={showEditTaskModal} onOpenChange={setShowEditTaskModal}>
          <DialogContent className="sm:max-w-[800px] max">
            <DialogHeader>
              <DialogTitle>Editar Tarefa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 ">
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                <label className="block text-sm font-medium text-foreground mb-1">Título *</label>
                <input
                  type="text"
                  value={editTaskData.title}
                  onChange={(e) => setEditTaskData({...editTaskData, title: e.target.value})}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
                <textarea
                  value={editTaskData.description}
                  onChange={(e) => setEditTaskData({...editTaskData, description: e.target.value})}
                  rows={12}
                  className="w-full max-h-[50vh] overflow-y-auto resize-y px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                  <select
                    value={editTaskData.status}
                    onChange={(e) => setEditTaskData({...editTaskData, status: e.target.value})}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="TODO">A Fazer</option>
                    <option value="IN_PROGRESS">Em Andamento</option>
                    <option value="DONE">Concluído</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Prioridade</label>
                  <select
                    value={editTaskData.priority}
                    onChange={(e) => setEditTaskData({...editTaskData, priority: e.target.value})}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Média</option>
                    <option value="HIGH">Alta</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Responsável</label>
                  <select
                    value={editTaskData.assigneeId}
                    onChange={(e) => setEditTaskData({...editTaskData, assigneeId: e.target.value})}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Não atribuído</option>
                    {project?.team.map((member) => (
                      <option key={member.user.id} value={member.user.id}>
                        {member.user.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Prazo</label>
                  <input
                    type="date"
                    value={editTaskData.dueDate}
                    onChange={(e) => setEditTaskData({...editTaskData, dueDate: e.target.value})}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Horário de Início</label>
                <input
                  type="datetime-local"
                  value={editTaskData.startTime}
                  onChange={(e) => setEditTaskData({...editTaskData, startTime: e.target.value})}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Horário de Término</label>
                <input
                  type="datetime-local"
                  value={editTaskData.endTime}
                  onChange={(e) => setEditTaskData({...editTaskData, endTime: e.target.value})}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  onClick={() => setShowEditTaskModal(false)}
                  className="px-4 py-2 text-sm font-medium text-secondary-foreground bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateTask}
                  className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors"
                >
                  Salvar
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  )
}

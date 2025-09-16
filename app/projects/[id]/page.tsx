"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
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
import { DashboardLayout } from "@/components/layout/dashboard-layout"
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
    milestone: {
      id: string
      name: string
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
    estimatedMinutes: ''
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
    estimatedMinutes: ''
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
        return 'bg-blue-100 text-blue-800'
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800'
      case 'ON_HOLD':
        return 'bg-gray-100 text-gray-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      case 'TODO':
        return 'bg-gray-100 text-gray-800'
      case 'DONE':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
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
        return 'text-red-600'
      case 'MEDIUM':
        return 'text-yellow-600'
      case 'LOW':
        return 'text-green-600'
      default:
        return 'text-gray-600'
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
          estimatedHours: newTask.estimatedMinutes ? parseFloat(newTask.estimatedMinutes) / 60 : null
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
        estimatedMinutes: ''
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
      estimatedMinutes: task.estimatedHours ? (task.estimatedHours * 60).toString() : ''
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
          estimatedHours: editTaskData.estimatedMinutes ? parseFloat(editTaskData.estimatedMinutes) / 60 : null
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
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const formatEstimatedTime = (hours: number) => {
    if (hours >= 1) {
      // Se for número inteiro, mostra só as horas
      if (hours % 1 === 0) {
        return `${hours}h`
      }
      // Se tiver decimais, mostra horas e minutos
      const wholeHours = Math.floor(hours)
      const minutes = Math.round((hours - wholeHours) * 60)
      return minutes > 0 ? `${wholeHours}h ${minutes}min` : `${wholeHours}h`
    } else {
      return `${Math.round(hours * 60)}min`
    }
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

  if (!project) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">Projeto não encontrado</h3>
          <button
            onClick={() => router.push('/projects')}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
          >
            <ArrowLeft className="-ml-1 mr-2 h-4 w-4" />
            Voltar aos Projetos
          </button>
        </div>
      </DashboardLayout>
    )
  }

  const completedMilestones = project.milestones.filter(m => m.status === 'COMPLETED').length
  const completedTasks = project.tasks.filter(t => t.status === 'DONE').length
  const progress = project.milestones.length > 0 
    ? Math.round((completedMilestones / project.milestones.length) * 100)
    : 0

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => router.push('/projects')}
                className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar aos Projetos
              </button>
              
              {session?.user.role === 'ADMIN' && (
                <div className="flex space-x-2">
                  <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50">
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                <p className="mt-2 text-gray-600">{project.description}</p>
                
                <div className="mt-4 flex items-center space-x-6">
                  <div className="flex items-center text-sm text-gray-500">
                    <User className="h-4 w-4 mr-1" />
                    Cliente: {project.client.name}
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="h-4 w-4 mr-1" />
                    Início: {formatDate(project.startDate)}
                  </div>
                  {project.endDate && (
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      Fim: {formatDate(project.endDate)}
                    </div>
                  )}
                  <div className="flex items-center text-sm text-gray-500">
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
                  <div className="text-2xl font-bold text-gray-900">{progress}%</div>
                  <div className="text-sm text-gray-500">Progresso</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
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
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center relative`}
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
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <Flag className="h-8 w-8 text-blue-600" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-500">Milestones</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {completedMilestones}/{project.milestones.length}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-500">Tarefas</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {completedTasks}/{project.tasks.length}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <Users className="h-8 w-8 text-purple-600" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-500">Equipe</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {project.team.length}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <DollarSign className="h-8 w-8 text-yellow-600" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-500">Orçamento</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {formatCurrency(project.budget)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Progresso Geral</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
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
                  <h3 className="text-lg font-medium text-gray-900">
                    Milestones ({project.milestones.length})
                  </h3>
                  {session?.user.role === 'ADMIN' && (
                    <Dialog open={showAddMilestoneModal} onOpenChange={setShowAddMilestoneModal}>
                      <DialogTrigger asChild>
                        <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
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
                            <label htmlFor="name" className="text-right">
                              Nome
                            </label>
                            <input
                              id="name"
                              value={newMilestone.name}
                              onChange={(e) => setNewMilestone({...newMilestone, name: e.target.value})}
                              className="col-span-3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="Nome do milestone"
                            />
                          </div>
                          <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="dueDate" className="text-right">
                              Data
                            </label>
                            <input
                              id="dueDate"
                              type="date"
                              value={newMilestone.dueDate}
                              onChange={(e) => setNewMilestone({...newMilestone, dueDate: e.target.value})}
                              className="col-span-3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="status" className="text-right">
                              Status
                            </label>
                            <select
                              id="status"
                              value={newMilestone.status}
                              onChange={(e) => setNewMilestone({...newMilestone, status: e.target.value})}
                              className="col-span-3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleAddMilestone}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
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
                    <div key={milestone.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h4 className="text-lg font-medium text-gray-900">
                              {milestone.name}
                            </h4>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(milestone.status)}`}>
                              {milestone.status === 'PENDING' ? 'Pendente' :
                               milestone.status === 'IN_PROGRESS' ? 'Em Andamento' :
                               milestone.status === 'COMPLETED' ? 'Concluído' : milestone.status}
                            </span>
                          </div>
                          
                          <div className="mt-3 flex items-center space-x-4 text-sm text-gray-500">
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
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteMilestone(milestone.id)}
                              className="text-red-400 hover:text-red-600"
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
                      <label htmlFor="edit-name" className="text-right">
                        Nome
                      </label>
                      <input
                        id="edit-name"
                        value={editingMilestone.name}
                        onChange={(e) => setEditingMilestone({...editingMilestone, name: e.target.value})}
                        className="col-span-3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Nome do milestone"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="edit-dueDate" className="text-right">
                        Data
                      </label>
                      <input
                        id="edit-dueDate"
                        type="date"
                        value={editingMilestone.dueDate}
                        onChange={(e) => setEditingMilestone({...editingMilestone, dueDate: e.target.value})}
                        className="col-span-3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="edit-status" className="text-right">
                        Status
                      </label>
                      <select
                        id="edit-status"
                        value={editingMilestone.status}
                        onChange={(e) => setEditingMilestone({...editingMilestone, status: e.target.value})}
                        className="col-span-3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleEditMilestone(editingMilestone.id)}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
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
                    <label htmlFor="task-title" className="text-right">
                      Título *
                    </label>
                    <input
                      id="task-title"
                      value={newTask.title}
                      onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                      className="col-span-3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Título da tarefa"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="task-description" className="text-right">
                      Descrição
                    </label>
                    <textarea
                      id="task-description"
                      value={newTask.description}
                      onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                      className="col-span-3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Descrição da tarefa"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="task-status" className="text-right">
                      Status
                    </label>
                    <select
                      id="task-status"
                      value={newTask.status}
                      onChange={(e) => setNewTask({...newTask, status: e.target.value})}
                      className="col-span-3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="TODO">A Fazer</option>
                      <option value="IN_PROGRESS">Em Andamento</option>
                      <option value="DONE">Concluído</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="task-priority" className="text-right">
                      Prioridade
                    </label>
                    <select
                      id="task-priority"
                      value={newTask.priority}
                      onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                      className="col-span-3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="LOW">Baixa</option>
                      <option value="MEDIUM">Média</option>
                      <option value="HIGH">Alta</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="task-dueDate" className="text-right">
                      Prazo
                    </label>
                    <input
                      id="task-dueDate"
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                      className="col-span-3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="task-assignee" className="text-right">
                      Responsável
                    </label>
                    <select
                      id="task-assignee"
                      value={newTask.assigneeId}
                      onChange={(e) => setNewTask({...newTask, assigneeId: e.target.value})}
                      className="col-span-3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    <label htmlFor="task-milestone" className="text-right">
                      Milestone
                    </label>
                    <select
                      id="task-milestone"
                      value={newTask.milestoneId}
                      onChange={(e) => setNewTask({...newTask, milestoneId: e.target.value})}
                      className="col-span-3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    <label htmlFor="task-estimatedMinutes" className="text-right">
                      Tempo Estimado (minutos)
                    </label>
                    <input
                      id="task-estimatedMinutes"
                      type="number"
                      min="0"
                      value={newTask.estimatedMinutes}
                      onChange={(e) => setNewTask({...newTask, estimatedMinutes: e.target.value})}
                      className="col-span-3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Ex: 120 (2 horas)"
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
                        estimatedMinutes: ''
                      })
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddTask}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
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
                    <label htmlFor="team-user" className="text-right">
                      Usuário *
                    </label>
                    <select
                      id="team-user"
                      value={newTeamMember.userId}
                      onChange={(e) => setNewTeamMember({...newTeamMember, userId: e.target.value})}
                      className="col-span-3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    <label htmlFor="team-role" className="text-right">
                      Função
                    </label>
                    <select
                      id="team-role"
                      value={newTeamMember.role}
                      onChange={(e) => setNewTeamMember({...newTeamMember, role: e.target.value})}
                      className="col-span-3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="MEMBER">Membro</option>
                      <option value="LEAD">Líder</option>
                      <option value="DEVELOPER">Desenvolvedor</option>
                      <option value="DESIGNER">Designer</option>
                      <option value="ANALYST">Analista</option>
                    </select>
                  </div>
                  {loadingUsers && (
                    <div className="text-center text-sm text-gray-500">
                      Carregando usuários disponíveis...
                    </div>
                  )}
                  {!loadingUsers && availableUsers.length === 0 && (
                    <div className="text-center text-sm text-gray-500">
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
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddTeamMember}
                    disabled={!newTeamMember.userId || loadingUsers}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <h3 className="text-lg font-medium text-gray-900">
                    Tarefas ({project.tasks.length})
                  </h3>
                  {session?.user.role === 'ADMIN' && (
                    <button 
                      onClick={() => setShowAddTaskModal(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Plus className="-ml-1 mr-2 h-4 w-4" />
                      Nova Tarefa
                    </button>
                  )}
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tarefa
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Prioridade
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Responsável
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Prazo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tempo Estimado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Milestone
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {project.tasks.map((task) => (
                        <tr key={task.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <div 
                                className="text-sm font-medium text-gray-900 cursor-pointer hover:text-indigo-600"
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.assignee?.name || 'Não atribuído'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.dueDate ? formatDate(task.dueDate) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.estimatedHours ? formatEstimatedTime(task.estimatedHours) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.milestone?.name || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {session?.user.role === 'ADMIN' && (
                              <div className="flex items-center justify-end space-x-2">
                                <button 
                                  onClick={() => handleEditTask(task)}
                                  className="text-gray-600 hover:text-gray-900"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="text-red-600 hover:text-red-900"
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
                  <h3 className="text-lg font-medium text-gray-900">
                    Equipe ({project.team.length})
                  </h3>
                  {session?.user.role === 'ADMIN' && (
                    <button 
                      onClick={() => {
                        setShowAddTeamMemberModal(true)
                        fetchAvailableUsers()
                      }}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Plus className="-ml-1 mr-2 h-4 w-4" />
                      Adicionar Membro
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {project.team.map((member) => (
                    <div key={member.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                              <User className="h-6 w-6 text-indigo-600" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {member.user.name}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {member.user.email}
                            </p>
                            <p className="text-xs text-gray-400">
                              {member.role}
                            </p>
                          </div>
                        </div>
                        {session?.user.role === 'ADMIN' && (
                          <button
                            onClick={() => handleRemoveTeamMember(member.user.id)}
                            className="text-red-600 hover:text-red-800 p-1"
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
                  <h3 className="text-lg font-medium text-gray-900">
                    Mensagens ({project._count.comments})
                  </h3>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      isConnected ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <span className="text-sm text-gray-500">
                      {isConnected ? 'Tempo real ativo' : 'Desconectado'}
                    </span>
                  </div>
                </div>
                
                {/* Messages List */}
                <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                      Conversas - {project.name}
                    </h4>
                    
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {loadingComments ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                      ) : comments.length === 0 ? (
                        <div className="text-center py-8">
                          <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
                          <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma mensagem</h3>
                          <p className="mt-1 text-sm text-gray-500">
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
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-gray-100 text-gray-900'
                            }`}>
                              <p className="text-sm">{comment.content}</p>
                              <p className={`text-xs mt-1 ${
                                comment.type === 'CLIENT_REQUEST' || comment.isFromClient
                                  ? 'text-indigo-200' 
                                  : 'text-gray-500'
                              }`}>
                                {comment.authorName} • {new Date(comment.createdAt).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Send Message */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex space-x-4">
                    <div className="flex-1">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Digite sua mensagem..."
                        rows={3}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <button
                      onClick={sendComment}
                      disabled={!newComment.trim() || sendingComment}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendingComment ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
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
                  <label className="text-sm font-medium text-gray-700">Título</label>
                  <p className="text-gray-900">{selectedTask.title}</p>
                </div>
                {selectedTask.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Descrição</label>
                    <p className="text-gray-900">{selectedTask.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <p className="text-gray-900">
                      {selectedTask.status === 'TODO' ? 'A Fazer' :
                       selectedTask.status === 'IN_PROGRESS' ? 'Em Andamento' :
                       selectedTask.status === 'DONE' ? 'Concluído' : selectedTask.status}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Prioridade</label>
                    <p className="text-gray-900">
                      {selectedTask.priority === 'LOW' ? 'Baixa' :
                       selectedTask.priority === 'MEDIUM' ? 'Média' :
                       selectedTask.priority === 'HIGH' ? 'Alta' : selectedTask.priority}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Responsável</label>
                    <p className="text-gray-900">{selectedTask.assignee?.name || 'Não atribuído'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Prazo</label>
                    <p className="text-gray-900">{selectedTask.dueDate ? formatDate(selectedTask.dueDate) : 'Não definido'}</p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Editar Tarefa */}
        <Dialog open={showEditTaskModal} onOpenChange={setShowEditTaskModal}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Editar Tarefa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input
                  type="text"
                  value={editTaskData.title}
                  onChange={(e) => setEditTaskData({...editTaskData, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea
                  value={editTaskData.description}
                  onChange={(e) => setEditTaskData({...editTaskData, description: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={editTaskData.status}
                    onChange={(e) => setEditTaskData({...editTaskData, status: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="TODO">A Fazer</option>
                    <option value="IN_PROGRESS">Em Andamento</option>
                    <option value="DONE">Concluído</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                  <select
                    value={editTaskData.priority}
                    onChange={(e) => setEditTaskData({...editTaskData, priority: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Média</option>
                    <option value="HIGH">Alta</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                  <select
                    value={editTaskData.assigneeId}
                    onChange={(e) => setEditTaskData({...editTaskData, assigneeId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prazo</label>
                  <input
                    type="date"
                    value={editTaskData.dueDate}
                    onChange={(e) => setEditTaskData({...editTaskData, dueDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tempo Estimado (minutos)</label>
                <input
                  type="number"
                  min="0"
                  value={editTaskData.estimatedMinutes}
                  onChange={(e) => setEditTaskData({...editTaskData, estimatedMinutes: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: 120 (2 horas)"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  onClick={() => setShowEditTaskModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateTask}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
                >
                  Salvar
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
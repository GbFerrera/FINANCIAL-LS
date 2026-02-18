"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Calendar,
  Clock,
  DollarSign,
  FileText,
  MessageSquare,
  BarChart3,
  User,
  CheckCircle,
  AlertCircle,
  Download,
  Eye,
  Send,
  Building2,
  Mail,
  Phone,
  TrendingUp,
  TrendingDown,
  Calculator,
  BanknoteArrowDown,
  Bell,
  ChevronDown,
  ChevronRight,
  Paperclip
} from "lucide-react"
import toast from "react-hot-toast"

interface ClientData {
  id: string
  name: string
  email: string
  phone?: string
  company?: string
}

interface ProjectData {
  id: string
  name: string
  description: string
  status: string
  startDate: string
  endDate?: string
  budget: number
  progress: number
  partners?: string[]
  milestones: Array<{
    id: string
    title: string
    status: string
    dueDate?: string
    completedAt?: string
  }>
  tasks: Array<{
    id: string
    title: string
    status: string
    dueDate?: string
    completedAt?: string
    estimatedHours?: number
  }>
  files: Array<{
    id: string
    filename: string
    originalName: string
    size: number
    url: string
    createdAt: string
  }>
  comments: Array<{
    id: string
    content: string
    type: string
    createdAt: string
    authorName?: string
  }>
  financialEntries?: Array<{
    id: string
    type: 'INCOME' | 'EXPENSE'
    amount: number
    description: string
    category: string
    date: string
    createdAt: string
    projectId?: string
    projectName?: string
    paymentId?: string
    projectDistributions?: Array<{
      projectId: string
      projectName: string
      amount: number
    }>
  }>
}

interface FinancialSummary {
  totalIncome: number
  totalExpenses: number
  balance: number
  entriesCount: number
}

interface PaymentData {
  id: string
  amount: number
  description: string
  paymentDate: string
  method: string
  status: string
  totalDistributed: number
  remainingAmount: number
  projectPayments: Array<{
    projectId: string
    projectName: string
    projectBudget: number
    amountPaid: number
  }>
  createdAt: string
  attachments?: Array<{
    id: string
    filename: string
    originalName: string
    size: number
    url: string
  }>
}

interface ProjectPaymentSummary {
  projectId: string
  projectName: string
  budget: number
  totalPaid: number
  remainingBudget: number
  paymentPercentage: number
}

interface ProjectDistribution {
  projectId: string
  projectName: string
  amount: number
}

interface ClientFinancialEntry {
  id: string
  type: 'INCOME' | 'EXPENSE'
  category: string | null
  description: string
  amount: number
  date: string
  projectName?: string | null
  paymentId?: string | null
  projectDistributions?: ProjectDistribution[]
  createdAt?: string
}

interface ClientAttachment {
  filename: string
  url: string
  size: number
  uploadedAt: string
}

export default function ClientPortalPage() {
  const routerParams = useParams() as { token?: string }
  const tokenParam = routerParams?.token ?? ""
  const router = useRouter()
  const [client, setClient] = useState<ClientData | null>(null)
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [payments, setPayments] = useState<PaymentData[]>([])
  const [projectPaymentSummaries, setProjectPaymentSummaries] = useState<ProjectPaymentSummary[]>([])
  const [financialEntries, setFinancialEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'files' | 'messages' | 'financial' | 'payments' | 'contracts'>('overview')
  const [newComment, setNewComment] = useState('')
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [sendingComment, setSendingComment] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'IN_PROGRESS' | 'COMPLETED'>('all')
  const [isConnected, setIsConnected] = useState(false)
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())
  // Estado para financeiro (rota dedicada)
  const [finEntries, setFinEntries] = useState<ClientFinancialEntry[]>([])
  const [finStats, setFinStats] = useState<any | null>(null)
  const [finPage, setFinPage] = useState<number>(1)
  const [finLimit, setFinLimit] = useState<number>(10)
  const [clientAttachments, setClientAttachments] = useState<ClientAttachment[]>([])

  // Calculate payment summaries from projects and financial entries
  const calculatePaymentSummaries = (projects: ProjectData[], payments: PaymentData[]) => {
    return projects.map(project => {
      // Sum up payments from the payments array
      const paymentAmount = payments
        .flatMap(payment => payment.projectPayments || [])
        .filter(p => p.projectId === project.id)
        .reduce((sum, p) => sum + p.amountPaid, 0);
      
      // Sum up income from financial entries
      const incomeFromEntries = (project.financialEntries || [])
        .filter(entry => entry.type === 'INCOME')
        .reduce((sum, entry) => sum + entry.amount, 0);
      
      const totalPaid = paymentAmount + incomeFromEntries;
      const remainingBudget = Math.max(0, project.budget - totalPaid);
      const paymentPercentage = project.budget > 0 ? Math.round((totalPaid / project.budget) * 100) : 0;
      
      return {
        projectId: project.id,
        projectName: project.name,
        budget: project.budget,
        totalPaid,
        remainingBudget,
        paymentPercentage
      };
    });
  };

  useEffect(() => {
    if (tokenParam) {
      fetchClientData(tokenParam)
    }
  }, [tokenParam])

  useEffect(() => {
    let eventSource: EventSource | null = null
    
    if (activeTab === 'messages' && selectedProject) {
       eventSource = connectToSSE() || null
       // Limpar notificação quando acessar a aba de mensagens
       setHasNewMessages(false)
     }
    
    return () => {
      if (eventSource) {
        eventSource.close()
        setIsConnected(false)
      }
    }
  }, [activeTab, selectedProject])

  const fetchClientData = async (token: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/client-portal/${token}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Link inválido ou expirado')
          return
        }
        throw new Error('Falha ao carregar dados')
      }
      
      const data = await response.json()
      setClient(data.client)
      setProjects(data.projects)
      setPayments(data.payments || [])
      setFinancialEntries(data.financialEntries || [])
      
      // Usar resumo de pagamentos calculado na API para garantir consistência
      setProjectPaymentSummaries(data.projectPaymentSummaries || [])
      if (data.projects.length > 0) {
        setSelectedProject(data.projects[0].id)
      }
    } catch (error) {
      console.error('Erro ao buscar dados do cliente:', error)
      toast.error('Erro ao carregar dados do portal')
    } finally {
      setLoading(false)
    }
  }

  const connectToSSE = () => {
    if (!selectedProject) return null
    
    const eventSource = new EventSource(`/api/projects/${selectedProject}/comments/stream`)
    
    eventSource.onopen = () => {
      console.log('SSE connection opened')
      setIsConnected(true)
    }
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'heartbeat') {
          console.log('SSE heartbeat received')
          return
        }
        
        if (data.type === 'new_comments' && data.comments?.length > 0) {
          // Se não estamos na aba de mensagens, mostrar notificação
          if (activeTab !== 'messages') {
            setHasNewMessages(true)
          }
          // Atualiza dados para mostrar novo comentário
          if (tokenParam) fetchClientData(tokenParam)
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error)
      }
    }
    
    eventSource.onerror = (error) => {
      console.error('SSE error:', error)
      setIsConnected(false)
      eventSource.close()
      
      // Reconnect after 5 seconds
      setTimeout(() => {
        if (selectedProject) {
          connectToSSE()
        }
      }, 5000)
    }
    
    return eventSource
  }

  // Buscar financeiro do cliente com filtros básicos
  useEffect(() => {
    const loadFinancial = async () => {
      if (!tokenParam || activeTab !== 'financial') return
      try {
        const params = new URLSearchParams()
        params.set('page', String(finPage))
        params.set('limit', String(finLimit))
        if (selectedProjectId) params.set('projectId', selectedProjectId)
        const res = await fetch(`/api/client-portal/${tokenParam}/financial?${params.toString()}`)
        if (!res.ok) throw new Error('Falha ao carregar financeiro do cliente')
        const json = await res.json()
        setFinEntries(json.entries || [])
        setFinStats(json.stats || null)
      } catch (err) {
        console.error('[client-portal] erro ao buscar financeiro', err)
        setFinEntries([])
        setFinStats(null)
      }
    }
    loadFinancial()
  }, [tokenParam, activeTab, finPage, finLimit, selectedProjectId])
  
  useEffect(() => {
    const loadContracts = async () => {
      if (!tokenParam || activeTab !== 'contracts') return
      try {
        const res = await fetch(`/api/client-portal/${tokenParam}/contracts`)
        if (!res.ok) throw new Error('Falha ao carregar contratos do cliente')
        const json = await res.json()
        setClientAttachments(json.attachments || [])
      } catch (err) {
        console.error('[client-portal] erro ao buscar contratos', err)
        setClientAttachments([])
      }
    }
    loadContracts()
  }, [tokenParam, activeTab])

  const sendComment = async () => {
    if (!newComment.trim() || !selectedProject) return
    
    try {
      setSendingComment(true)
      const response = await fetch(`/api/client-portal/${tokenParam}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId: selectedProject,
          content: newComment.trim()
        })
      })
      
      if (!response.ok) {
        throw new Error('Falha ao enviar comentário')
      }
      
      toast.success('Comentário enviado com sucesso!')
      setNewComment('')
      // SSE will handle real-time updates
    } catch (error) {
      console.error('Erro ao enviar comentário:', error)
      toast.error('Erro ao enviar comentário')
    } finally {
      setSendingComment(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return 'bg-accent/20 text-accent-foreground dark:bg-accent/30'
      case 'IN_PROGRESS':
        return 'bg-primary/20 text-primary dark:bg-primary/30'
      case 'ON_HOLD':
        return 'bg-muted text-muted-foreground dark:bg-muted/30'
      case 'COMPLETED':
        return 'bg-chart-5/20 text-chart-5 dark:bg-chart-5/30'
      case 'CANCELLED':
        return 'bg-destructive/20 text-destructive dark:bg-destructive/30'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const formatEstimatedTime = (hours: number) => {
    if (hours >= 1) {
      // Se for número inteiro, mostra só as horas
      if (hours % 1 === 0) {
        return `${hours}h estimadas`
      }
      // Se tiver decimais, mostra horas e minutos
      const wholeHours = Math.floor(hours)
      const minutes = Math.round((hours - wholeHours) * 60)
      return minutes > 0 ? `${wholeHours}h ${minutes}min estimados` : `${wholeHours}h estimadas`
    } else {
      return `${Math.round(hours * 60)}min estimados`
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

  // Helpers para ícone/cores das movimentações financeiras na tabela
  const getTypeColor = (type: string) => {
    return type === 'INCOME' ? 'text-chart-5 bg-secondary' : 'text-destructive bg-destructive/10'
  }

  const getTypeIcon = (type: string) => {
    return type === 'INCOME' ? TrendingUp : TrendingDown
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

  const toggleEntryExpansion = (entryId: string) => {
    const newExpanded = new Set(expandedEntries)
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId)
    } else {
      newExpanded.add(entryId)
    }
    setExpandedEntries(newExpanded)
  }

  const formatDate = (dateString: string) => {
    // Extrair apenas a parte da data (YYYY-MM-DD) sem conversão de fuso horário
    const datePart = dateString.split('T')[0]
    const [year, month, day] = datePart.split('-')
    return `${day}/${month}/${year}`
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h3 className="mt-2 text-lg font-medium text-foreground">Link inválido</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Este link não é válido ou pode ter expirado.
          </p>
        </div>
      </div>
    )
  }

  const selectedProjectData = projects.find(p => p.id === selectedProject)
  const totalProjects = projects.length
  const completedProjects = projects.filter(p => p.status === 'COMPLETED').length
  const inProgressProjects = projects.filter(p => p.status === 'IN_PROGRESS').length
  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0)

  return (
    <div className="min-h-screen bg-card">
      {/* Header */}
      <div className="bg-card shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <User className="h-10 w-10 text-primary mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Portal do Cliente</h1>
                <p className="text-sm text-muted-foreground">Bem-vindo, {client.name}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              {client.company && (
                <div className="flex items-center">
                  <Building2 className="h-4 w-4 mr-1" />
                  {client.company}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="bg-card shadow rounded-lg mb-6">
          <div className="border-b border-muted">
            <nav className="-mb-px flex gap-6 px-4 overflow-x-auto sm:flex-wrap">
              {[
                { id: 'overview', name: 'Visão Geral', icon: BarChart3 },
                { id: 'projects', name: 'Projetos', icon: FileText },
                { id: 'financial', name: 'Financeiro', icon: DollarSign },
                { id: 'payments', name: 'Pagamentos', icon: BanknoteArrowDown },
                { id: 'contracts', name: 'Contratos', icon: FileText },
              ].map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`${activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    } sm:whitespace-nowrap whitespace-normal py-4 px-2 border-b-2 font-medium text-sm flex items-center relative`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {tab.name}
                    {tab.id === 'messages' && hasNewMessages && (
                      <Bell className="h-3 w-3 ml-1 text-destructive animate-pulse" />
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
                {/* Stats */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="bg-card rounded-lg p-4">
                    <div className="flex items-center">
                      <FileText className="h-8 w-8 text-chart-1" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-muted-foreground">Total de Projetos</p>
                        <p className="text-2xl font-semibold text-foreground">{totalProjects}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-card rounded-lg p-4">
                    <div className="flex items-center">
                      <CheckCircle className="h-8 w-8 text-chart-5" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-muted-foreground">Concluídos</p>
                        <p className="text-2xl font-semibold text-foreground">{completedProjects}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-card rounded-lg p-4">
                    <div className="flex items-center">
                      <Clock className="h-8 w-8 text-chart-2" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-muted-foreground">Em Andamento</p>
                        <p className="text-2xl font-semibold text-foreground">{inProgressProjects}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-card rounded-lg p-4">
                    <div className="flex items-center">
                      <DollarSign className="h-8 w-8 text-chart-4" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-muted-foreground">Investimento Total</p>
                        <p className="text-lg font-semibold text-foreground">{formatCurrency(totalBudget)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Projects */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-4">Projetos Recentes</h3>
                  <div className="space-y-3">
                    {projects.slice(0, 3).map((project) => (
                      <div key={project.id} className="border border-muted rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <h4 className="text-lg font-medium text-foreground">{project.name}</h4>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                                {project.status === 'IN_PROGRESS' ? 'Em Andamento' : 
                                 project.status === 'COMPLETED' ? 'Concluído' :
                                 project.status === 'PLANNING' ? 'Planejamento' : project.status}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
                            
                            <div className="mt-3 flex items-center space-x-4 text-sm text-muted-foreground">
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                Início: {formatDate(project.startDate)}
                              </div>
                              <div className="flex items-center">
                                <DollarSign className="h-4 w-4 mr-1" />
                                {formatCurrency(project.budget)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-2xl font-bold text-foreground">{project.progress}%</div>
                            <div className="text-sm text-muted-foreground">Progresso</div>
                            <div className="mt-2 w-20 bg-muted rounded-full h-2">
                              <div 
                                className="bg-primary h-2 rounded-full transition-all duration-300"
                                style={{ width: `${project.progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Projects Tab */}
            {activeTab === 'projects' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-foreground">Todos os Projetos</h3>
                
                <div className="space-y-4">
                  {projects.map((project) => (
                    <div key={project.id} className="border border-muted rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h4 className="text-xl font-medium text-foreground">{project.name}</h4>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                              {project.status === 'IN_PROGRESS' ? 'Em Andamento' : 
                               project.status === 'COMPLETED' ? 'Concluído' :
                               project.status === 'PLANNING' ? 'Planejamento' : project.status}
                            </span>
                          </div>
                          <p className="mt-2 text-muted-foreground">{project.description}</p>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-3xl font-bold text-foreground">{project.progress}%</div>
                          <div className="text-sm text-muted-foreground">Concluído</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Milestones */}
                        <div>
                          <h5 className="font-medium text-foreground mb-3">Milestones</h5>
                          <div className="space-y-2">
                            {project.milestones.map((milestone) => (
                              <div key={milestone.id} className="flex items-center justify-between p-2 bg-card rounded">
                                <span className="text-sm text-foreground">{milestone.title}</span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(milestone.status)}`}>
                                  {milestone.status === 'COMPLETED' ? 'Concluído' :
                                   milestone.status === 'IN_PROGRESS' ? 'Em Andamento' : 'Pendente'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Recent Tasks */}
                        <div>
                          <h5 className="font-medium text-foreground mb-3">Tarefas Recentes</h5>
                          <div className="space-y-2">
                            {project.tasks.slice(0, 5).map((task) => (
                              <div key={task.id} className="flex items-center justify-between p-2 bg-card rounded">
                                <div className="flex flex-col">
                                  <span className="text-sm text-foregound">{task.title}</span>
                                  {task.estimatedHours && (
                                     <span className="text-xs text-muted-foreground">
                                       {formatEstimatedTime(task.estimatedHours)}
                                     </span>
                                   )}
                                </div>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                                  {task.status === 'COMPLETED' ? 'Concluído' :
                                   task.status === 'IN_PROGRESS' ? 'Em Andamento' : 'Pendente'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Tab */}
            {activeTab === 'financial' && (
              <div className="space-y-8">
                {/* Header com seletor de projeto */}
                <div className="bg-card rounded-xl shadow-sm border border-muted p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">Informações Financeiras</h2>
                      <p className="text-muted-foreground mt-1">Acompanhe o desempenho financeiro dos seus projetos</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-sm font-medium text-foreground">Projeto:</span>
                        <select 
                          value={selectedProjectId || ''} 
                          onChange={(e) => setSelectedProjectId(e.target.value || null)}
                          className="w-full sm:w-[220px] md:w-[260px] px-4 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        >
                          <option value="">Todos os projetos</option>
                          {projects.map(project => (
                            <option key={project.id} value={project.id}>{project.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-sm font-medium text-foreground">Status:</span>
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value as any)}
                          className="w-full sm:w-[200px] px-4 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        >
                          <option value="all">Todos</option>
                          <option value="IN_PROGRESS">Em andamento</option>
                          <option value="COMPLETED">Concluídos</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {(() => {
                  const projectData = selectedProjectId 
                    ? projects.find(p => p.id === selectedProjectId)
                    : null
                  
                  const projectsForTotals = selectedProjectId
                    ? (projectData ? [projectData] : [])
                    : (statusFilter === 'all' ? projects : projects.filter(p => p.status === statusFilter))

                  // Usa a nova rota dedicada ao financeiro do cliente
                  const allFinancials: ClientFinancialEntry[] = finEntries || []
                  
                  const totalIncome = allFinancials
                    .filter(entry => entry.type === 'INCOME')
                    .reduce((sum, entry) => sum + entry.amount, 0)
                  
                  const totalExpenses = allFinancials
                    .filter(entry => entry.type === 'EXPENSE')
                    .reduce((sum, entry) => sum + entry.amount, 0)
                  
                  const totalBudget = selectedProjectId
                    ? (projectData?.budget || 0)
                    : projectsForTotals.reduce((sum, p) => sum + (p.budget || 0), 0)
                  
                  const balance = totalIncome - totalExpenses

                  // Resolver projectId mesmo quando o tipo não o declara explicitamente
                  const resolveProjectId = (entry: ClientFinancialEntry): string | undefined => {
                    const explicit = (entry as any).projectId as string | undefined
                    if (explicit) return explicit
                    const match = projects.find(p => p.name === entry.projectName)
                    return match?.id
                  }

                  // Não precisamos calcular totais por projeto aqui, pois removemos a coluna agregada

                  return (
                    <>
                      {/* Cards de resumo financeiro */}
                      

                      {/* Resumo de Projetos em Andamento */}
                      {(() => {
                        const summariesByStatus = projectPaymentSummaries.map(s => ({
                          ...s,
                          status: projects.find(p => p.id === s.projectId)?.status || 'PLANNING'
                        }))
                        const inProgress = summariesByStatus.filter(s => s.status === 'IN_PROGRESS')
                        if (inProgress.length === 0) return null
                        const inProgressPaid = inProgress.reduce((sum, s) => sum + s.totalPaid, 0)
                        const inProgressRemaining = inProgress.reduce((sum, s) => sum + s.remainingBudget, 0)
                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="bg-accent rounded-xl p-6 border border-accent">
                              <p className="text-sm font-semibold text-accent-foreground uppercase tracking-wide">Em Andamento - Retorno Financeiro</p>
                              <p className="text-3xl font-bold text-foreground mt-2">{formatCurrency(inProgressPaid)}</p>
                              <p className="text-sm text-muted-foreground mt-1">Somatório dos valores pagos em projetos em andamento</p>
                            </div>
                            <div className="bg-secondary rounded-xl p-6 border border-secondary">
                              <p className="text-sm font-semibold text-secondary-foreground uppercase tracking-wide">Em Andamento - Restante a repassar</p>
                              <p className="text-3xl font-bold text-foreground mt-2">{formatCurrency(inProgressRemaining)}</p>
                              <p className="text-sm text-muted-foreground mt-1">Saldo ainda não repassado frente ao orçamento</p>
                            </div>
                          </div>
                        )
                      })()}

                      {/* Resumo de Concluídos (retorno e restante) */}
                      {(() => {
                        const summariesByStatus = projectPaymentSummaries.map(s => ({
                          ...s,
                          status: projects.find(p => p.id === s.projectId)?.status || 'PLANNING'
                        }))
                        const concluded = summariesByStatus.filter(s => s.status === 'COMPLETED')
                        if (concluded.length === 0) return null
                        const concludedPaid = concluded.reduce((sum, s) => sum + s.totalPaid, 0)
                        const concludedRemaining = concluded.reduce((sum, s) => sum + s.remainingBudget, 0)
                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="bg-secondary rounded-xl p-6 border border-secondary">
                              <p className="text-sm font-semibold text-secondary-foreground uppercase tracking-wide">Concluídos - Retorno Financeiro</p>
                              <p className="text-3xl font-bold text-foreground mt-2">{formatCurrency(concludedPaid)}</p>
                              <p className="text-sm text-muted-foreground mt-1">Somatório dos valores pagos em projetos concluídos</p>
                            </div>
                            <div className="bg-accent rounded-xl p-6 border border-accent">
                              <p className="text-sm font-semibold text-accent-foreground uppercase tracking-wide">Concluídos - Restante a repassar</p>
                              <p className="text-3xl font-bold text-foreground mt-2">{formatCurrency(concludedRemaining)}</p>
                              <p className="text-sm text-muted-foreground mt-1">Saldo ainda não repassado frente ao orçamento</p>
                            </div>
                          </div>
                        )
                      })()}

                        {/* Lista de movimentações financeiras (mantida para compatibilidade) */}
                      <div className="bg-card rounded-xl shadow-sm border border-muted overflow-hidden">
                        <div className="bg-card px-6 py-4 border-b border-muted">
                          <h3 className="text-lg font-semibold text-foreground">
                            Movimentações Financeiras {selectedProjectId && projectData ? `- ${projectData.name}` : ''}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {allFinancials.length} {allFinancials.length === 1 ? 'movimentação encontrada' : 'movimentações encontradas'}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">Total investido:</span>
                            <span className="text-sm font-bold text-chart-5">{formatCurrency(totalIncome)}</span>
                          </div>
                        </div>
                        
                        <div className="block md:hidden divide-y divide-border">
                          {allFinancials.length === 0 ? (
                            <div className="px-6 py-12 text-center">
                              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                <DollarSign className="h-8 w-8 text-muted-foreground" />
                              </div>
                              <h4 className="text-lg font-medium text-foreground mb-2">Nenhuma movimentação encontrada</h4>
                              <p className="text-muted-foreground">Não há registros financeiros para o período selecionado.</p>
                            </div>
                          ) : (
                            allFinancials.map((entry: ClientFinancialEntry) => {
                              const isExpanded = expandedEntries.has(entry.id)
                              const hasDistributions = entry.projectDistributions && entry.projectDistributions.length > 0
                              
                              return (
                                <div key={entry.id} className="border-b border-muted last:border-b-0">
                                  <div
                                    className="px-4 py-4 hover:bg-card transition-colors duration-150 cursor-pointer"
                                    onClick={() => (hasDistributions || !!entry.projectName) && toggleEntryExpansion(entry.id)}
                                    role="button"
                                    aria-expanded={isExpanded}
                                  >
                                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-start">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                          entry.type === 'INCOME' 
                                            ? 'bg-secondary border-2 border-secondary' 
                                            : 'bg-destructive/10 border-2 border-destructive/30'
                                        }`}>
                                          {entry.type === 'INCOME' ? (
                                            <TrendingUp className="h-5 w-5 text-chart-5" />
                                          ) : (
                                            <TrendingDown className="h-5 w-5 text-destructive" />
                                          )}
                                        </div>
                                        <div className="flex-1">
                                          {/* Título principal: valor + tipo */}
                                          <div className="flex items-center gap-2">
                                            <p className={`text-xl font-bold ${
                                              entry.type === 'INCOME' ? 'text-chart-5' : 'text-destructive'
                                            }`}>
                                              {entry.type === 'INCOME' ? '+' : '-'}{formatCurrency(entry.amount)}
                                            </p>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                              entry.type === 'INCOME' 
                                                ? 'bg-secondary text-secondary-foreground' 
                                                : 'bg-destructive/10 text-destructive'
                                            }`}>
                                              {entry.type === 'INCOME' ? 'Receita' : 'Despesa'}
                                            </span>
                                          </div>
                                          {/* Descrição abaixo */}
                                          <div className="mt-1">
                                            <h4 className="text-sm font-semibold text-foreground break-words leading-snug">{entry.description}</h4>
                                          </div>
                                          {/* Data pequena abaixo */}
                                          <div className="mt-0.5 text-xs text-muted-foreground">{formatDate(entry.date)}</div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 justify-end">
                                        {(hasDistributions || !!entry.projectName) && (
                                          isExpanded ? (
                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                          )
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Distribuições expandidas */}
                                  {hasDistributions && isExpanded && (
                                    <div className="px-4 pb-3 bg-card">
                                      <div className="border-l-2 border-accent pl-4">
                                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium mb-2">
                                          Distribuído entre {entry.projectDistributions?.length ?? 0} projeto{(entry.projectDistributions?.length ?? 0) > 1 ? 's' : ''}
                                        </div>
                                        <div className="space-y-2">
                                          {(entry.projectDistributions ?? []).map((dist: ProjectDistribution, index: number) => (
                                            <div key={index} className="flex items-center justify-between py-2 px-3 bg-card rounded-md border border-muted">
                                              <div className="flex items-center space-x-2">
                                                <div className="w-2 h-2 bg-accent rounded-full"></div>
                                                <span className="text-sm font-medium text-foreground">{dist.projectName}</span>
                                              </div>
                                              <span className={`text-sm font-semibold ${
                                                entry.type === 'INCOME' ? 'text-chart-5' : 'text-destructive'
                                              }`}>
                                                {entry.type === 'INCOME' ? '+' : '-'}{formatCurrency(dist.amount)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {!hasDistributions && !!entry.projectName && isExpanded && (
                                    <div className="px-4 pb-3 bg-card">
                                      <div className="border-l-2 border-primary/20 pl-4">
                                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-2">Projeto</div>
                                        <div className="flex items-center justify-between py-2 px-3 bg-card rounded-md border border-muted">
                                          <span className="text-sm font-medium text-foreground">{entry.projectName}</span>
                                          <span className={`text-sm font-semibold ${entry.type === 'INCOME' ? 'text-chart-5' : 'text-destructive'}`}>{entry.type === 'INCOME' ? '+' : '-'}{formatCurrency(Math.abs(entry.amount))}</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })
                          )}
                        </div>
                        {allFinancials.length === 0 ? (
                          <div className="px-6 py-12 text-center">
                            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                              <DollarSign className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h4 className="text-lg font-medium text-foreground mb-2">Nenhuma movimentação encontrada</h4>
                            <p className="text-muted-foreground">Não há registros financeiros para o período selecionado.</p>
                          </div>
                        ) : (
                          <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-border">
                              <thead className="bg-card">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Categoria</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Projeto</th>
                                </tr>
                              </thead>
                              <tbody className="bg-card divide-y divide-border">
                                {allFinancials.map((entry: ClientFinancialEntry) => {
                                  const TypeIconEl = getTypeIcon(entry.type)
                                  const hasDistributions = entry.projectDistributions && entry.projectDistributions.length > 0
                                  return (
                                    <tr key={entry.id} className="hover:bg-card">
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(entry.type)}`}>
                                          <TypeIconEl className="w-3 h-3 mr-1" />
                                          {entry.type === 'INCOME' ? 'Receita' : 'Despesa'}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-foreground">{entry.description}</div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{entry.category}</td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className={`text-sm font-medium ${entry.type === 'INCOME' ? 'text-chart-5' : 'text-destructive'}`}>
                                          {entry.type === 'INCOME' ? '+' : '-'}{formatCurrency(Math.abs(entry.amount))}
                                        </div>
                                        {hasDistributions && (
                                          <div className="mt-2 space-y-1">
                                            {(entry.projectDistributions ?? []).map((dist: ProjectDistribution, index: number) => (
                                              <div key={index} className="text-xs bg-accent px-2 py-1 rounded border border-accent">
                                                <span className="font-medium text-accent-foreground">{dist.projectName}:</span>
                                                <span className="text-accent-foreground ml-1">{formatCurrency(dist.amount)}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{formatDate(entry.date)}</td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                        {hasDistributions ? (
                                          <div className="space-y-1">
                                            {(entry.projectDistributions ?? []).map((dist: ProjectDistribution, index: number) => (
                                              <div key={index} className="text-xs bg-primary/10 px-2 py-1 rounded border border-primary/20">
                                                <span className="text-primary font-medium">{dist.projectName}</span>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          entry.projectName || '-'
                                        )}
                                      </td>
                                      
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Resumo de Pagamentos por Projeto */}
                      {projectPaymentSummaries.length > 0 && (
                        <div className="bg-card rounded-xl shadow-sm border border-muted overflow-hidden mb-6">
                          <div className="bg-card px-6 py-4 border-b border-muted">
                            <h3 className="text-lg font-semibold text-foreground">
                              Resumo de Pagamentos por Projeto
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              Acompanhe o progresso financeiro de cada projeto{statusFilter !== 'all' ? ` • Filtrando: ${statusFilter === 'IN_PROGRESS' ? 'Em andamento' : 'Concluídos'}` : ''}
                            </p>
                          </div>
                          
                          <div className="divide-y divide-border">
                            {projectPaymentSummaries
                              .filter((summary) => {
                                if (statusFilter === 'all') return true
                                const p = projects.find(p => p.id === summary.projectId)
                                return p?.status === statusFilter
                              })
                              .map((summary) => (
                              <div key={summary.projectId} className="px-6 py-5">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                                  <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-base font-semibold text-foreground">{summary.projectName}</h4>
                                    {(() => {
                                      const proj = projects.find(p => p.id === summary.projectId)
                                      if (!proj) return null
                                      return (
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(proj.status)}`}>
                                          {getStatusLabel(proj.status)}
                                        </span>
                                      )
                                    })()}
                                  </div>
                                  {(() => {
                                    const proj = projects.find(p => p.id === summary.projectId)
                                    if (!proj || !proj.partners || proj.partners.length === 0) return null
                                    return (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Parceiros: {proj.partners.join(', ')}
                                      </p>
                                    )
                                  })()}
                                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                      <div className="bg-primary/10 p-3 rounded-lg">
                                        <p className="text-xs font-medium text-primary uppercase tracking-wide">Orçamento Total</p>
                                        <p className="text-lg font-bold text-foreground mt-1">
                                          {formatCurrency(summary.budget)}
                                        </p>
                                      </div>
                                      <div className="bg-secondary p-3 rounded-lg">
                                        <p className="text-xs font-medium text-secondary-foreground uppercase tracking-wide">Valor Pago</p>
                                        <p className="text-lg font-bold text-foreground mt-1">
                                          {formatCurrency(summary.totalPaid)}
                                        </p>
                                      </div>
                                      <div className="bg-accent p-3 rounded-lg">
                                        <p className="text-xs font-medium text-accent-foreground uppercase tracking-wide">Restante</p>
                                        <p className="text-lg font-bold text-foreground mt-1">
                                          {formatCurrency(summary.remainingBudget)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-4">
                                    <div className="text-right">
                                      <p className="text-sm text-muted-foreground">Progresso</p>
                                      <p className="text-2xl font-bold text-foreground">{summary.paymentPercentage}%</p>
                                    </div>
                                    <div className="w-16 h-16">
                                      <div className="relative w-16 h-16">
                                        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                                          <path
                                            className="text-muted-foreground"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                            fill="none"
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                          />
                                          <path
                                            className={`${summary.paymentPercentage >= 100 ? 'text-chart-5' : summary.paymentPercentage >= 50 ? 'text-chart-1' : 'text-destructive'}`}
                                            stroke="currentColor"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                            fill="none"
                                            strokeDasharray={`${summary.paymentPercentage}, 100`}
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                          />
                                        </svg>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            
                            {/* Total Summary */}
                            <div className="mt-6 pt-6 border-t border-muted">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-primary/10 p-4 rounded-lg">
                                  <p className="text-sm font-medium text-primary uppercase tracking-wide">Orçamento Total</p>
                                  <p className="text-xl font-bold text-foreground mt-1">
                                    {formatCurrency(projectPaymentSummaries
                                      .filter((s) => statusFilter === 'all' ? true : (projects.find(p => p.id === s.projectId)?.status === statusFilter))
                                      .reduce((sum, p) => sum + p.budget, 0))}
                                  </p>
                                </div>
                                <div className="bg-secondary p-4 rounded-lg">
                                  <p className="text-sm font-medium text-secondary-foreground uppercase tracking-wide">Valor Pago</p>
                                  <p className="text-xl font-bold text-foreground mt-1">
                                    {formatCurrency(projectPaymentSummaries
                                      .filter((s) => statusFilter === 'all' ? true : (projects.find(p => p.id === s.projectId)?.status === statusFilter))
                                      .reduce((sum, p) => sum + p.totalPaid, 0))}
                                  </p>
                                </div>
                                <div className="bg-accent p-4 rounded-lg">
                                  <p className="text-sm font-medium text-accent-foreground uppercase tracking-wide">Restante</p>
                                  <p className="text-xl font-bold text-foreground mt-1">
                                    {formatCurrency(projectPaymentSummaries
                                      .filter((s) => statusFilter === 'all' ? true : (projects.find(p => p.id === s.projectId)?.status === statusFilter))
                                      .reduce((sum, p) => sum + p.remainingBudget, 0))}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                    
                    </>
                  )
                })()}
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-foreground">Pagamentos</h3>
                {payments.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h4 className="mt-2 text-sm font-medium text-foreground">Nenhum pagamento</h4>
                    <p className="mt-1 text-sm text-muted-foreground">Não há pagamentos registrados.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {payments.map((payment) => (
                      <div key={payment.id} className="border border-muted rounded-lg p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-5 w-5 text-chart-5" />
                              <span className="text-lg font-semibold text-foreground">{formatCurrency(payment.amount)}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{payment.description}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(payment.paymentDate)}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Distribuído</div>
                            <div className="text-xl font-bold text-foreground">{formatCurrency(payment.totalDistributed)}</div>
                            <div className="text-xs text-muted-foreground mt-1">Restante {formatCurrency(payment.remainingAmount)}</div>
                          </div>
                        </div>
                        {payment.projectPayments && payment.projectPayments.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                            {payment.projectPayments.map((pp) => (
                              <div key={`${payment.id}-${pp.projectId}`} className="bg-secondary p-3 rounded border border-secondary">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-secondary-foreground">{pp.projectName}</span>
                                  <span className="text-sm font-bold text-foreground">{formatCurrency(pp.amountPaid)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {payment.attachments && payment.attachments.length > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2 mb-2">
                              <Paperclip className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium text-foreground">Anexos</span>
                            </div>
                            <div className="space-y-2">
                              {payment.attachments.map((att) => (
                                <div key={att.id} className="flex items-center justify-between p-2 bg-card border border-muted rounded">
                                  <div className="flex items-center gap-3">
                                    <FileText className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                      <p className="text-sm font-medium text-foreground">{att.originalName || att.filename}</p>
                                      <p className="text-xs text-muted-foreground">{formatFileSize(att.size)}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-1.5 border border-border text-xs rounded">
                                      <Eye className="h-3 w-3 mr-1" />
                                      Visualizar
                                    </a>
                                    <a href={att.url} download className="inline-flex items-center px-3 py-1.5 border border-border text-xs rounded">
                                      <Download className="h-3 w-3 mr-1" />
                                      Download
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Files Tab */}
            {activeTab === 'files' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-foreground">Arquivos do Projeto</h3>
                  <select
                    value={selectedProject || ''}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="block w-48 pl-3 pr-10 py-2 text-base border-border focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {selectedProjectData && (
                  <div className="bg-card border border-muted rounded-lg overflow-hidden">
                    <div className="px-4 py-5 sm:p-6">
                      <h4 className="text-lg font-medium text-foreground mb-4">
                        Arquivos - {selectedProjectData.name}
                      </h4>
                      
                      {selectedProjectData.files.length > 0 ? (
                        <div className="space-y-3">
                          {selectedProjectData.files.map((file) => (
                            <div key={file.id} className="flex items-center justify-between p-3 border border-muted rounded-lg">
                              <div className="flex items-center space-x-3">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium text-foreground">{file.originalName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatFileSize(file.size)} • {formatDate(file.createdAt)}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex space-x-2">
                                <button className="inline-flex items-center px-3 py-1.5 border border-border shadow-sm text-xs font-medium rounded text-foreground bg-card hover:bg-card">
                                  <Eye className="h-3 w-3 mr-1" />
                                  Visualizar
                                </button>
                                <button className="inline-flex items-center px-3 py-1.5 border border-border shadow-sm text-xs font-medium rounded text-foreground bg-card hover:bg-card">
                                  <Download className="h-3 w-3 mr-1" />
                                  Download
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                          <h3 className="mt-2 text-sm font-medium text-foreground">Nenhum arquivo</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Ainda não há arquivos disponíveis para este projeto.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'contracts' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-foreground">Contratos</h3>
                {clientAttachments.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h4 className="mt-2 text-sm font-medium text-foreground">Nenhum contrato</h4>
                    <p className="mt-1 text-sm text-muted-foreground">Não há anexos cadastrados para este cliente.</p>
                  </div>
                ) : (
                  <div className="bg-card border border-muted rounded-lg overflow-hidden">
                    <div className="px-4 py-5 sm:p-6">
                      <div className="space-y-3">
                        {clientAttachments.map((file) => (
                          <div key={file.url} className="flex items-center justify-between p-3 border border-muted rounded-lg">
                            <div className="flex items-center space-x-3">
                              <FileText className="h-8 w-8 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium text-foreground">{file.filename}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(file.size)} • {formatDate(file.uploadedAt)}
                                </p>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <a href={file.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-1.5 border border-border shadow-sm text-xs font-medium rounded text-foreground bg-card hover:bg-card">
                                <Eye className="h-3 w-3 mr-1" />
                                Visualizar
                              </a>
                              <a href={file.url} download className="inline-flex items-center px-3 py-1.5 border border-border shadow-sm text-xs font-medium rounded text-foreground bg-card hover:bg-card">
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Messages Tab */}
            {activeTab === 'messages' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-4">
                    <h3 className="text-lg font-medium text-foreground">Mensagens</h3>
                    {selectedProject && (
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          isConnected ? 'bg-primary' : 'bg-destructive'
                        }`}></div>
                        <span className="text-sm text-muted-foreground">
                          {isConnected ? 'Tempo real ativo' : 'Desconectado'}
                        </span>
                      </div>
                    )}
                  </div>
                  <select
                    value={selectedProject || ''}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="block w-48 pl-3 pr-10 py-2 text-base border-border focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {selectedProjectData && (
                  <div className="space-y-4">
                    {/* Messages List */}
                    <div className="bg-card border border-muted rounded-lg">
                      <div className="px-4 py-5 sm:p-6">
                        <h4 className="text-lg font-medium text-foreground mb-4">
                          Conversas - {selectedProjectData.name}
                        </h4>
                        
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                          {selectedProjectData.comments.length > 0 ? (
                            selectedProjectData.comments.map((comment) => (
                              <div key={comment.id} className={`flex ${comment.type === 'CLIENT_REQUEST' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                  comment.type === 'CLIENT_REQUEST' 
                                    ? 'bg-primary text-primary-foreground' 
                                    : 'bg-muted text-foreground'
                                }`}>
                                  <p className="text-sm">{comment.content}</p>
                                  <p className={`text-xs mt-1 ${
                                    comment.type === 'CLIENT_REQUEST' 
                                      ? 'text-primary-foreground/70' 
                                      : 'text-muted-foreground'
                                  }`}>
                                    {comment.authorName || 'Você'} • {formatDate(comment.createdAt)}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8">
                              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
                              <h3 className="mt-2 text-sm font-medium text-foreground">Nenhuma mensagem</h3>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Inicie uma conversa enviando uma mensagem.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Send Message */}
                    <div className="bg-card border border-muted rounded-lg p-4">
                      <div className="flex space-x-4">
                        <div className="flex-1">
                          <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Digite sua mensagem..."
                            rows={3}
                            className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                          />
                        </div>
                        <button
                          onClick={sendComment}
                          disabled={!newComment.trim() || sendingComment}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {sendingComment ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

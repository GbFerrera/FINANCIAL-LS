'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { format, addDays, startOfDay, endOfDay, isToday, isTomorrow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { StatsCard } from '@/components/ui/stats-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertCircle,
  Target,
  Calendar,
  BarChart3,
  Filter,
  RefreshCw,
  Award,
  Zap,
  Timer,
  User
} from 'lucide-react'
import toast from 'react-hot-toast'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
  tasksToday: {
    completed: number
    pending: number
    overdue: number
  }
  tasksTomorrow: {
    scheduled: number
    pending: number
  }
  performance: {
    completionRate: number
    averageTimePerTask: number
    onTimeDelivery: number
    efficiency: number
  }
  currentTasks: Array<{
    id: string
    title: string
    status: string
    priority: string
    dueDate: string | null
    projectName: string
    milestone?: string
    estimatedHours?: number
    actualHours?: number
    isOverdue: boolean
  }>
  milestones: Array<{
    id: string
    name: string
    projectName: string
    status: string
    dueDate: string | null
    progress: number
    tasksCompleted: number
    totalTasks: number
  }>
  timeTracking: {
    hoursToday: number
    hoursThisWeek: number
    hoursThisMonth: number
    averageHoursPerDay: number
  }
}

interface PerformanceData {
  overview: {
    totalMembers: number
    activeMembers: number
    tasksCompletedToday: number
    tasksPendingToday: number
    tasksScheduledTomorrow: number
    averageCompletionRate: number
    totalHoursToday: number
  }
  teamMembers: TeamMember[]
  milestonesSummary: {
    total: number
    completed: number
    inProgress: number
    overdue: number
  }
}

export default function TeamPerformancePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState('today')
  const [selectedMember, setSelectedMember] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    if (session.user.role !== 'ADMIN') {
      toast.error('Acesso negado. Apenas administradores podem ver esta página.')
      router.push('/dashboard')
      return
    }
    
    fetchPerformanceData()
  }, [session, status, router, selectedPeriod])

  const fetchPerformanceData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/team/performance?period=${selectedPeriod}`)
      if (!response.ok) throw new Error('Erro ao carregar dados')
      
      const data = await response.json()
      setPerformanceData(data)
    } catch (error) {
      console.error('Erro ao carregar performance:', error)
      toast.error('Erro ao carregar dados de performance')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchPerformanceData()
    setRefreshing(false)
    toast.success('Dados atualizados!')
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'todo': return 'bg-gray-100 text-gray-800'
      case 'in_review': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPerformanceColor = (value: number, threshold: number = 80) => {
    if (value >= threshold) return 'text-green-600'
    if (value >= threshold * 0.7) return 'text-yellow-600'
    return 'text-red-600'
  }

  const filteredMembers = selectedMember === 'all' 
    ? performanceData?.teamMembers || []
    : performanceData?.teamMembers.filter(member => member.id === selectedMember) || []

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!performanceData) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Erro ao carregar dados</h3>
          <p className="text-gray-600 mb-4">Não foi possível carregar os dados de performance.</p>
          <Button onClick={fetchPerformanceData}>Tentar novamente</Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Performance da Equipe</h1>
            <p className="text-gray-600">
              Acompanhe o desempenho e produtividade dos colaboradores
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Esta Semana</SelectItem>
                <SelectItem value="month">Este Mês</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Membros Ativos"
            value={performanceData.overview.activeMembers.toString()}
            icon={Users}
            color="blue"
            change={{
              value: `${performanceData.overview.totalMembers} total`,
              type: 'neutral'
            }}
          />
          <StatsCard
            title="Tarefas Concluídas Hoje"
            value={performanceData.overview.tasksCompletedToday.toString()}
            icon={CheckCircle}
            color="green"
            change={{
              value: `${performanceData.overview.tasksPendingToday} pendentes`,
              type: 'neutral'
            }}
          />
          <StatsCard
            title="Taxa de Conclusão Média"
            value={`${performanceData.overview.averageCompletionRate.toFixed(1)}%`}
            icon={TrendingUp}
            color={performanceData.overview.averageCompletionRate >= 80 ? 'green' : 'yellow'}
            change={{
              value: `${performanceData.overview.tasksScheduledTomorrow} para amanhã`,
              type: 'neutral'
            }}
          />
          <StatsCard
            title="Horas Trabalhadas Hoje"
            value={`${performanceData.overview.totalHoursToday.toFixed(1)}h`}
            icon={Clock}
            color="purple"
            change={{
              value: `${(performanceData.overview.totalHoursToday / performanceData.overview.activeMembers).toFixed(1)}h média`,
              type: 'neutral'
            }}
          />
        </div>

        {/* Milestones Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Resumo de Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {performanceData.milestonesSummary.total}
                </div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {performanceData.milestonesSummary.completed}
                </div>
                <div className="text-sm text-gray-600">Concluídos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {performanceData.milestonesSummary.inProgress}
                </div>
                <div className="text-sm text-gray-600">Em Progresso</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {performanceData.milestonesSummary.overdue}
                </div>
                <div className="text-sm text-gray-600">Atrasados</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Team Member Filter */}
        <div className="flex items-center gap-4">
          <Filter className="h-5 w-5 text-gray-400" />
          <Select value={selectedMember} onValueChange={setSelectedMember}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Filtrar por membro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os membros</SelectItem>
              {performanceData.teamMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Team Members Performance */}
        <div className="space-y-6">
          {filteredMembers.map((member) => (
            <Card key={member.id} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={member.avatar} alt={member.name} />
                      <AvatarFallback>
                        {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{member.name}</h3>
                      <p className="text-sm text-gray-600">{member.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        Taxa de Conclusão
                      </div>
                      <div className={`text-lg font-bold ${getPerformanceColor(member.performance.completionRate)}`}>
                        {member.performance.completionRate.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        Eficiência
                      </div>
                      <div className={`text-lg font-bold ${getPerformanceColor(member.performance.efficiency)}`}>
                        {member.performance.efficiency.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="tasks" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="tasks">Tarefas</TabsTrigger>
                    <TabsTrigger value="milestones">Milestones</TabsTrigger>
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                    <TabsTrigger value="time">Tempo</TabsTrigger>
                  </TabsList>

                  <TabsContent value="tasks" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Tarefas de Hoje */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Hoje ({format(new Date(), 'dd/MM', { locale: ptBR })})
                        </h4>
                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between text-sm">
                            <span>Concluídas: {member.tasksToday.completed}</span>
                            <span>Pendentes: {member.tasksToday.pending}</span>
                            <span className="text-red-600">Atrasadas: {member.tasksToday.overdue}</span>
                          </div>
                          <Progress 
                            value={(member.tasksToday.completed / (member.tasksToday.completed + member.tasksToday.pending + member.tasksToday.overdue)) * 100} 
                            className="h-2"
                          />
                        </div>
                      </div>

                      {/* Tarefas de Amanhã */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Amanhã ({format(addDays(new Date(), 1), 'dd/MM', { locale: ptBR })})
                        </h4>
                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between text-sm">
                            <span>Agendadas: {member.tasksTomorrow.scheduled}</span>
                            <span>Pendentes: {member.tasksTomorrow.pending}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {member.tasksTomorrow.scheduled + member.tasksTomorrow.pending} tarefas programadas
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Lista de Tarefas Atuais */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Tarefas Atuais</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {member.currentTasks.map((task) => (
                          <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h5 className="text-sm font-medium text-gray-900 truncate">
                                  {task.title}
                                </h5>
                                {task.isOverdue && (
                                  <Badge variant="destructive" className="text-xs">
                                    Atrasada
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <span>{task.projectName}</span>
                                {task.milestone && (
                                  <>
                                    <span>•</span>
                                    <span>{task.milestone}</span>
                                  </>
                                )}
                                {task.dueDate && (
                                  <>
                                    <span>•</span>
                                    <span>Vence: {format(parseISO(task.dueDate), 'dd/MM', { locale: ptBR })}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <Badge className={getPriorityColor(task.priority)}>
                                {task.priority}
                              </Badge>
                              <Badge className={getStatusColor(task.status)}>
                                {task.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                        {member.currentTasks.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            Nenhuma tarefa atual
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="milestones" className="space-y-4">
                    <div className="space-y-3">
                      {member.milestones.map((milestone) => (
                        <div key={milestone.id} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-gray-900">{milestone.name}</h5>
                            <Badge className={getStatusColor(milestone.status)}>
                              {milestone.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 mb-2">
                            {milestone.projectName}
                          </div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">
                              {milestone.tasksCompleted}/{milestone.totalTasks} tarefas
                            </span>
                            <span className="text-sm font-medium">
                              {milestone.progress}%
                            </span>
                          </div>
                          <Progress value={milestone.progress} className="h-2" />
                          {milestone.dueDate && (
                            <div className="text-xs text-gray-500 mt-2">
                              Prazo: {format(parseISO(milestone.dueDate), 'dd/MM/yyyy', { locale: ptBR })}
                            </div>
                          )}
                        </div>
                      ))}
                      {member.milestones.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          Nenhum milestone atribuído
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="performance" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Award className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium">Taxa de Conclusão</span>
                          </div>
                          <div className={`text-2xl font-bold ${getPerformanceColor(member.performance.completionRate)}`}>
                            {member.performance.completionRate.toFixed(1)}%
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="h-4 w-4 text-yellow-600" />
                            <span className="text-sm font-medium">Eficiência</span>
                          </div>
                          <div className={`text-2xl font-bold ${getPerformanceColor(member.performance.efficiency)}`}>
                            {member.performance.efficiency.toFixed(1)}%
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Timer className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium">Tempo Médio/Tarefa</span>
                          </div>
                          <div className="text-2xl font-bold text-gray-900">
                            {member.performance.averageTimePerTask.toFixed(1)}h
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="h-4 w-4 text-purple-600" />
                            <span className="text-sm font-medium">Entrega no Prazo</span>
                          </div>
                          <div className={`text-2xl font-bold ${getPerformanceColor(member.performance.onTimeDelivery)}`}>
                            {member.performance.onTimeDelivery.toFixed(1)}%
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="time" className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {member.timeTracking.hoursToday.toFixed(1)}h
                        </div>
                        <div className="text-sm text-gray-600">Hoje</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {member.timeTracking.hoursThisWeek.toFixed(1)}h
                        </div>
                        <div className="text-sm text-gray-600">Esta Semana</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">
                          {member.timeTracking.hoursThisMonth.toFixed(1)}h
                        </div>
                        <div className="text-sm text-gray-600">Este Mês</div>
                      </div>
                      <div className="text-center p-4 bg-orange-50 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">
                          {member.timeTracking.averageHoursPerDay.toFixed(1)}h
                        </div>
                        <div className="text-sm text-gray-600">Média/Dia</div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredMembers.length === 0 && (
          <div className="text-center py-12">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum membro encontrado</h3>
            <p className="text-gray-600">Não há membros da equipe para exibir.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { parseISO, format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { 
  BarChart3, 
  DollarSign, 
  FolderOpen, 
  Users, 
  TrendingUp, 
  AlertCircle,
  Plus,
  FileText
} from "lucide-react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { StatsCard } from "@/components/ui/stats-card"
import { ProjectsOverview } from "@/components/dashboard/projects-overview"
import { FinancialChart } from "@/components/dashboard/financial-chart"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import toast from "react-hot-toast"

interface DashboardData {
  stats: {
    totalProjects: number
    activeProjects: number
    completedProjects: number
    totalRevenue: number
    totalExpenses: number
    totalProfit: number
    totalTasks: number
    completedTasks: number
    pendingTasks: number
  }
  projects: Array<{
    id: string
    name: string
    status: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD'
    budget: number
    spent: number
    startDate: string
    endDate: string
    teamMembers: number
    progress: number
  }>
  financialData: Array<{
    month: string
    income: number
    expenses: number
    profit: number
  }>
  activities: Array<{
    id: string
    type: 'task_completed' | 'payment_received' | 'comment_added' | 'project_updated' | 'milestone_reached'
    title: string
    description: string
    user: string
    timestamp: string
    metadata?: {
      projectName?: string
      amount?: number
      taskName?: string
    }
  }>
  teamTaskMetrics?: Array<{
    id: string
    name: string
    email: string
    role: string
    tasksCompletedToday: number
    tasksPending: number
    tasksDueTodayNotCompleted: number
    completedTasks: Array<{
      id: string
      title: string
      projectName: string
      completedAt: string
    }>
    pendingTasks: Array<{
      id: string
      title: string
      status: string
      dueDate: string | null
      projectName: string
      isOverdue: boolean
    }>
  }>
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Check if user has admin access
    if (session.user.role !== "ADMIN") {
      toast.error("Acesso negado. Apenas administradores podem acessar o dashboard.")
      router.push("/auth/signin")
      return
    }

    fetchDashboardData()
  }, [session, status, router])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dashboard')
      
      if (!response.ok) {
        throw new Error('Falha ao carregar dados do dashboard')
      }
      
      const data = await response.json()
      setDashboardData(data)
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error)
      toast.error('Erro ao carregar dados do dashboard')
    } finally {
      setLoading(false)
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

  if (!dashboardData) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Erro ao carregar dados</h3>
          <p className="mt-1 text-sm text-gray-500">Tente recarregar a página</p>
          <button 
            onClick={fetchDashboardData}
            className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            Tentar novamente
          </button>
        </div>
      </DashboardLayout>
    )
  }

  const { stats, projects, financialData, activities } = dashboardData

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Dashboard
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Bem-vindo de volta, {session?.user.name}! Aqui está um resumo dos seus projetos.
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              <FileText className="-ml-1 mr-2 h-5 w-5" />
              Relatórios
            </button>
            <button className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
              <Plus className="-ml-1 mr-2 h-5 w-5" />
              Novo Projeto
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Projetos Ativos"
            value={stats.activeProjects}
            icon={FolderOpen}
            color="blue"
            change={{
              value: `${stats.totalProjects} total`,
              type: 'neutral'
            }}
          />
          <StatsCard
            title="Receita Total"
            value={`R$ ${stats.totalRevenue.toLocaleString('pt-BR')}`}
            icon={DollarSign}
            color="green"
            change={{
              value: stats.totalRevenue > 0 && stats.totalProfit >= 0 ? `+${((stats.totalProfit / stats.totalRevenue) * 100).toFixed(1)}%` : stats.totalRevenue > 0 ? `${((stats.totalProfit / stats.totalRevenue) * 100).toFixed(1)}%` : '0%',
              type: stats.totalProfit >= 0 ? 'increase' : 'decrease'
            }}
          />
          <StatsCard
            title="Tarefas Pendentes"
            value={stats.pendingTasks}
            icon={BarChart3}
            color="yellow"
            change={{
              value: `${stats.completedTasks} concluídas`,
              type: 'neutral'
            }}
          />
          <StatsCard
            title="Lucro Líquido"
            value={`R$ ${stats.totalProfit.toLocaleString('pt-BR')}`}
            icon={TrendingUp}
            color={stats.totalProfit >= 0 ? 'green' : 'red'}
            change={{
              value: stats.totalRevenue > 0 ? `${((stats.totalProfit / stats.totalRevenue) * 100).toFixed(1)}% margem` : '0% margem',
              type: stats.totalProfit >= 0 ? 'increase' : 'decrease'
            }}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Financial Chart */}
          <div className="lg:col-span-1">
            <FinancialChart data={financialData} />
          </div>
          
          {/* Recent Activity */}
          <div className="lg:col-span-1">
            <RecentActivity activities={activities} />
          </div>
        </div>

        {/* Projects Overview */}
        <div className="">
          <ProjectsOverview projects={projects} />
        </div>

        {/* Team Task Metrics */}
        {dashboardData?.teamTaskMetrics && dashboardData.teamTaskMetrics.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Métricas da Equipe - Hoje</h2>
                <p className="text-gray-600 text-sm">Tarefas concluídas e pendentes por membro da equipe</p>
              </div>
              <div className="text-sm text-gray-500">
                {new Date().toLocaleDateString('pt-BR', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dashboardData.teamTaskMetrics.map((member) => (
                <div key={member.id} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="ml-3">
                      <h3 className="font-medium text-gray-900">{member.name}</h3>
                      <p className="text-sm text-gray-500">{member.role}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Concluídas hoje:</span>
                      <span className="font-semibold text-green-600">{member.tasksCompletedToday}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Pendentes:</span>
                      <span className="font-semibold text-yellow-600">{member.tasksPending}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Vencendo hoje:</span>
                      <span className="font-semibold text-red-600">{member.tasksDueTodayNotCompleted}</span>
                    </div>
                  </div>
                  
                  {/* Tarefas concluídas hoje */}
                  {member.completedTasks.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Concluídas hoje:</h4>
                      <div className="space-y-1">
                        {member.completedTasks.slice(0, 3).map((task) => (
                          <div key={task.id} className="text-xs text-gray-600 bg-green-50 p-2 rounded">
                            <div className="font-medium">{task.title}</div>
                            <div className="text-gray-500">{task.projectName}</div>
                          </div>
                        ))}
                        {member.completedTasks.length > 3 && (
                          <div className="text-xs text-gray-500">
                            +{member.completedTasks.length - 3} mais...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Tarefas pendentes */}
                  {member.pendingTasks.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Pendentes:</h4>
                      <div className="space-y-1">
                        {member.pendingTasks.slice(0, 3).map((task) => (
                          <div key={task.id} className={`text-xs p-2 rounded ${
                            task.isOverdue ? 'text-red-700 bg-red-50' : 'text-yellow-700 bg-yellow-50'
                          }`}>
                            <div className="font-medium">{task.title}</div>
                            <div className="text-gray-500">{task.projectName}</div>
                            {task.dueDate && (
                              <div className="text-xs">
                                Vence: {format(parseISO(task.dueDate), 'dd/MM/yyyy', { locale: ptBR })}
                              </div>
                            )}
                          </div>
                        ))}
                        {member.pendingTasks.length > 3 && (
                          <div className="text-xs text-gray-500">
                            +{member.pendingTasks.length - 3} mais...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Target, 
  Users, 
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Download
} from 'lucide-react'
import { BurndownChart } from './BurndownChart'
import { TaskFilters } from './TaskFilters'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'

interface ScrumDashboardProps {
  projectId: string
}

interface DashboardData {
  sprints: any[]
  tasks: any[]
  teamMembers: any[]
  metrics: {
    totalSprints: number
    activeSprints: number
    completedSprints: number
    totalTasks: number
    completedTasks: number
    totalStoryPoints: number
    completedStoryPoints: number
    averageVelocity: number
  }
}

export function ScrumDashboard({ projectId }: ScrumDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSprint, setSelectedSprint] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [projectId])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Buscar dados em paralelo
      const [sprintsRes, backlogRes, teamRes] = await Promise.all([
        fetch(`/api/sprints?projectId=${projectId}`),
        fetch(`/api/backlog?projectId=${projectId}`),
        fetch(`/api/projects/${projectId}/team`)
      ])

      const sprints = await sprintsRes.json()
      const backlog = await backlogRes.json()
      const teamMembers = await teamRes.json()

      // Calcular métricas
      const allTasks = [...sprints.flatMap((s: any) => s.tasks), ...backlog]
      
      const metrics = {
        totalSprints: sprints.length,
        activeSprints: sprints.filter((s: any) => s.status === 'ACTIVE').length,
        completedSprints: sprints.filter((s: any) => s.status === 'COMPLETED').length,
        totalTasks: allTasks.length,
        completedTasks: allTasks.filter((t: any) => t.status === 'COMPLETED').length,
        totalStoryPoints: allTasks.reduce((sum: number, t: any) => sum + (t.storyPoints || 0), 0),
        completedStoryPoints: allTasks
          .filter((t: any) => t.status === 'COMPLETED')
          .reduce((sum: number, t: any) => sum + (t.storyPoints || 0), 0),
        averageVelocity: calculateAverageVelocity(sprints.filter((s: any) => s.status === 'COMPLETED'))
      }

      setData({
        sprints,
        tasks: allTasks,
        teamMembers,
        metrics
      })

      // Selecionar sprint ativa por padrão
      const activeSprint = sprints.find((s: any) => s.status === 'ACTIVE')
      if (activeSprint) {
        setSelectedSprint(activeSprint.id)
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateAverageVelocity = (completedSprints: any[]) => {
    if (completedSprints.length === 0) return 0
    
    const totalVelocity = completedSprints.reduce((sum, sprint) => {
      const sprintPoints = sprint.tasks
        .filter((t: any) => t.status === 'COMPLETED')
        .reduce((taskSum: number, t: any) => taskSum + (t.storyPoints || 0), 0)
      return sum + sprintPoints
    }, 0)
    
    return Math.round(totalVelocity / completedSprints.length)
  }

  const getVelocityChartData = () => {
    if (!data) return []
    
    return data.sprints
      .filter(sprint => sprint.status === 'COMPLETED')
      .slice(-6) // Últimas 6 sprints
      .map(sprint => ({
        name: sprint.name,
        velocity: sprint.tasks
          .filter((t: any) => t.status === 'COMPLETED')
          .reduce((sum: number, t: any) => sum + (t.storyPoints || 0), 0),
        planned: sprint.capacity || 0
      }))
  }

  const getTaskStatusData = () => {
    if (!data) return []
    
    const statusCounts = data.tasks.reduce((acc: any, task: any) => {
      acc[task.status] = (acc[task.status] || 0) + 1
      return acc
    }, {})

    const statusLabels = {
      TODO: 'A Fazer',
      IN_PROGRESS: 'Em Andamento', 
      IN_REVIEW: 'Em Teste',
      COMPLETED: 'Concluído'
    }

    const colors = {
      TODO: '#6b7280',
      IN_PROGRESS: '#3b82f6',
      IN_REVIEW: '#f59e0b',
      COMPLETED: '#10b981'
    }

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: statusLabels[status as keyof typeof statusLabels] || status,
      value: count,
      color: colors[status as keyof typeof colors] || '#6b7280'
    }))
  }

  const getTeamProductivityData = () => {
    if (!data) return []
    
    return data.teamMembers.map(member => {
      const memberTasks = data.tasks.filter(t => t.assigneeId === member.id)
      const completedTasks = memberTasks.filter(t => t.status === 'COMPLETED')
      const completedPoints = completedTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0)
      
      return {
        name: member.name,
        tasks: memberTasks.length,
        completed: completedTasks.length,
        storyPoints: completedPoints
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Erro ao carregar dados do dashboard</p>
      </div>
    )
  }

  const velocityData = getVelocityChartData()
  const taskStatusData = getTaskStatusData()
  const teamProductivityData = getTeamProductivityData()
  const selectedSprintData = data.sprints.find(s => s.id === selectedSprint)

  return (
    <div className="space-y-6">
      {/* Métricas Gerais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sprints Ativas</p>
                <p className="text-2xl font-bold text-blue-600">{data.metrics.activeSprints}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tarefas Concluídas</p>
                <p className="text-2xl font-bold text-green-600">
                  {data.metrics.completedTasks}/{data.metrics.totalTasks}
                </p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Story Points</p>
                <p className="text-2xl font-bold text-purple-600">
                  {data.metrics.completedStoryPoints}/{data.metrics.totalStoryPoints}
                </p>
              </div>
              <Target className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Velocidade Média</p>
                <p className="text-2xl font-bold text-orange-600">{data.metrics.averageVelocity}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="burndown">Burndown</TabsTrigger>
          <TabsTrigger value="team">Equipe</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Velocidade */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Velocidade das Sprints
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={velocityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="velocity" fill="#3b82f6" name="Realizado" />
                      <Bar dataKey="planned" fill="#e5e7eb" name="Planejado" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Distribuição de Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Status das Tarefas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={taskStatusData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {taskStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="burndown" className="space-y-6">
          {selectedSprintData ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Burndown Chart</h3>
                <select
                  value={selectedSprint || ''}
                  onChange={(e) => setSelectedSprint(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  {data.sprints
                    .filter(s => s.status === 'ACTIVE' || s.status === 'COMPLETED')
                    .map(sprint => (
                      <option key={sprint.id} value={sprint.id}>
                        {sprint.name}
                      </option>
                    ))}
                </select>
              </div>
              <BurndownChart sprint={selectedSprintData} />
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma sprint disponível para análise</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Produtividade da Equipe
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teamProductivityData.map(member => (
                  <div key={member.name} className="flex items-center justify-between p-4 border border-muted rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">{member.name}</h4>
                      <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                        <span>{member.tasks} tarefas</span>
                        <span>{member.completed} concluídas</span>
                        <span>{member.storyPoints} SP</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-blue-600">
                        {member.tasks > 0 ? Math.round((member.completed / member.tasks) * 100) : 0}%
                      </div>
                      <div className="text-xs text-muted-foreground">Conclusão</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Relatórios
                </span>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Resumo do Projeto</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total de Sprints:</span>
                      <span className="font-medium">{data.metrics.totalSprints}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sprints Concluídas:</span>
                      <span className="font-medium">{data.metrics.completedSprints}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Taxa de Conclusão:</span>
                      <span className="font-medium">
                        {data.metrics.totalSprints > 0 
                          ? Math.round((data.metrics.completedSprints / data.metrics.totalSprints) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Velocidade Média:</span>
                      <span className="font-medium">{data.metrics.averageVelocity} SP/sprint</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Métricas de Qualidade</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Tarefas Concluídas:</span>
                      <span className="font-medium">
                        {data.metrics.completedTasks}/{data.metrics.totalTasks}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Story Points Entregues:</span>
                      <span className="font-medium">
                        {data.metrics.completedStoryPoints}/{data.metrics.totalStoryPoints}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Eficiência:</span>
                      <span className="font-medium">
                        {data.metrics.totalStoryPoints > 0 
                          ? Math.round((data.metrics.completedStoryPoints / data.metrics.totalStoryPoints) * 100)
                          : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { 
  Kanban, 
  Target, 
  Calendar, 
  TrendingUp, 
  Users, 
  Clock,
  ArrowRight,
  Plus
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Project {
  id: string
  name: string
  description?: string
  status: string
  client: {
    name: string
  }
  sprints: Array<{
    id: string
    name: string
    status: string
    tasks: Array<{
      id: string
      storyPoints?: number
      status: string
    }>
  }>
  tasks: Array<{
    id: string
    storyPoints?: number
    status: string
  }>
}

export default function ScrumOverviewPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/projects?includeScrum=true&limit=1000')
      if (response.ok) {
        const data = await response.json()
        // A API retorna { projects: [], pagination: {} }
        setProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Erro ao carregar projetos:', error)
    } finally {
      setLoading(false)
    }
  }

  const getProjectMetrics = (project: Project) => {
    const projectTasks = project.tasks || []
    const sprintTasks = project.sprints?.flatMap(s => s.tasks || []) || []
    const allTasks = [...projectTasks, ...sprintTasks]
    const activeSprints = project.sprints?.filter(s => s.status === 'ACTIVE')?.length || 0
    const totalStoryPoints = allTasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0)
    const completedStoryPoints = allTasks
      .filter(task => task.status === 'COMPLETED')
      .reduce((sum, task) => sum + (task.storyPoints || 0), 0)
    
    const progress = totalStoryPoints > 0 ? Math.round((completedStoryPoints / totalStoryPoints) * 100) : 0

    return {
      activeSprints,
      totalSprints: project.sprints?.length || 0,
      totalStoryPoints,
      completedStoryPoints,
      progress,
      totalTasks: allTasks.length,
      completedTasks: allTasks.filter(t => t.status === 'COMPLETED').length
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão Scrum</h1>
          <p className="text-gray-600">Gerencie seus projetos com metodologia ágil</p>
        </div>
        <Button onClick={() => router.push('/projects/new')} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Projeto
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Projetos Ativos</p>
                <p className="text-2xl font-bold text-blue-600">
                  {projects?.filter(p => p.status === 'IN_PROGRESS')?.length || 0}
                </p>
              </div>
              <Kanban className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Sprints Ativas</p>
                <p className="text-2xl font-bold text-green-600">
                  {projects?.reduce((sum, p) => sum + (p.sprints?.filter(s => s.status === 'ACTIVE')?.length || 0), 0) || 0}
                </p>
              </div>
              <Target className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Sprints</p>
                <p className="text-2xl font-bold text-purple-600">
                  {projects?.reduce((sum, p) => sum + (p.sprints?.length || 0), 0) || 0}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Story Points</p>
                <p className="text-2xl font-bold text-orange-600">
                  {projects?.reduce((sum, p) => {
                    const metrics = getProjectMetrics(p)
                    return sum + metrics.completedStoryPoints
                  }, 0) || 0}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Projetos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {projects?.map(project => {
          const metrics = getProjectMetrics(project)
          
          return (
            <Card key={project.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">Cliente: {project.client.name}</p>
                    {project.description && (
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2">{project.description}</p>
                    )}
                  </div>
                  <Badge 
                    variant={project.status === 'IN_PROGRESS' ? 'default' : 'secondary'}
                    className="ml-2"
                  >
                    {project.status === 'IN_PROGRESS' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  {/* Métricas */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-green-500" />
                      <span>{metrics.activeSprints} sprints ativas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span>{metrics.completedTasks}/{metrics.totalTasks} tarefas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-purple-500" />
                      <span>{metrics.completedStoryPoints}/{metrics.totalStoryPoints} SP</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-orange-500" />
                      <span>{metrics.progress}% concluído</span>
                    </div>
                  </div>

                  {/* Barra de Progresso */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${metrics.progress}%` }}
                    />
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2 pt-2">
                    <Link href={`/projects/${project.id}/scrum`} className="flex-1">
                      <Button variant="outline" className="w-full">
                        <Kanban className="w-4 h-4 mr-2" />
                        Quadro Scrum
                      </Button>
                    </Link>
                    <Link href={`/projects/${project.id}`}>
                      <Button variant="ghost" size="sm">
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {(!projects || projects.length === 0) && (
        <Card>
          <CardContent className="p-8 text-center">
            <Kanban className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum projeto encontrado</h3>
            <p className="text-gray-600 mb-4">Crie seu primeiro projeto para começar a usar o Scrum</p>
            <Button onClick={() => router.push('/projects/new')} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Criar Projeto
            </Button>
          </CardContent>
        </Card>
      )}
      </div>
    </DashboardLayout>
  )
}

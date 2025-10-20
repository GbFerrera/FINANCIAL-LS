'use client'

import { useState, useEffect, useRef } from 'react'
import CalendarHeatmap from 'react-calendar-heatmap'
import 'react-calendar-heatmap/dist/styles.css'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, TrendingUp, Target } from 'lucide-react'
import { format, subDays, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CustomTooltip } from '@/components/ui/tooltip-custom'
import { DayDetailsModal } from '@/components/ui/day-details-modal'

interface ContributionData {
  date: string
  count: number
  totalHours?: number
  totalActualHours?: number
  totalEstimatedHours?: number
  efficiency?: number
  projectsCount?: number
  tasks?: Array<{
    id: string
    title: string
    status: string
    completedAt?: string
    priority?: string
    description?: string
    estimatedHours?: number
    actualHours?: number
    actualMinutes?: number
    estimatedMinutes?: number
    project?: {
      id: string
      name: string
    }
    sprint?: {
      id: string
      name: string
    }
    assignee?: {
      id: string
      name: string
      avatar?: string
    }
  }>
  pendingTasks?: Array<{
    id: string
    title: string
    status: string
    dueDate?: string
    priority?: string
    description?: string
    estimatedHours?: number
    project?: {
      id: string
      name: string
    }
    assignee?: {
      id: string
      name: string
      avatar?: string
    }
  }>
  projects?: string[]
  pendingCount?: number
}

interface ContributionHeatmapProps {
  userId?: string
  token?: string
  title?: string
  showStats?: boolean
}

export function ContributionHeatmap({ 
  userId, 
  token, 
  title = "Atividades Concluídas",
  showStats = true 
}: ContributionHeatmapProps) {
  const [contributions, setContributions] = useState<ContributionData[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalContributions: 0,
    currentStreak: 0,
    longestStreak: 0,
    averagePerDay: 0,
    totalHours: 0
  })
  
  // Estados para tooltip e modal
  const [tooltipData, setTooltipData] = useState<ContributionData | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [modalData, setModalData] = useState<any>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const heatmapRef = useRef<HTMLDivElement>(null)

  const endDate = new Date()
  const startDate = subDays(endDate, 365) // Últimos 365 dias

  useEffect(() => {
    fetchContributions()
  }, [userId, token])

  const fetchContributions = async () => {
    try {
      setLoading(true)
      
      // Determinar a URL da API baseada nos parâmetros
      let apiUrl = ''
      if (token) {
        // Para portal do colaborador
        apiUrl = `/api/collaborator-portal/${token}/contributions?days=365`
      } else if (userId) {
        // Para dashboard admin (implementar futuramente se necessário)
        apiUrl = `/api/admin/users/${userId}/contributions?days=365`
      } else {
        // Se não há token nem userId, usar dados de exemplo
        generateSampleData()
        return
      }

      console.log('Fazendo requisição para:', apiUrl)
      const response = await fetch(apiUrl)
      
      if (!response.ok) {
        console.error('Erro na resposta da API:', response.status, response.statusText)
        throw new Error(`Erro ao carregar dados de contribuições: ${response.status}`)
      }

      const data = await response.json()
      console.log('Dados recebidos da API:', data)
      
      // Processar dados da API para o formato esperado pelo componente
      const processedContributions = data.contributions.map((contrib: any) => ({
        date: contrib.date,
        count: contrib.count,
        totalHours: contrib.totalHours || 0,
        totalActualHours: contrib.totalActualHours || 0,
        totalEstimatedHours: contrib.totalEstimatedHours || 0,
        efficiency: contrib.efficiency || 100,
        tasks: contrib.tasks || [],
        pendingTasks: [],
        projects: contrib.projects || [],
        projectsCount: contrib.projectsCount || 0,
        pendingCount: 0
      }))
      
      setContributions(processedContributions)
      setStats(data.stats || {
        totalContributions: 0,
        currentStreak: 0,
        longestStreak: 0,
        averagePerDay: 0,
        totalHours: 0,
        totalActualHours: 0,
        totalEstimatedHours: 0,
        overallEfficiency: 100,
        projectsWorked: 0,
        projectStats: []
      })
      
    } catch (error) {
      console.error('Erro ao buscar contribuições:', error)
      // Em caso de erro, mostrar dados vazios ao invés de dados fictícios
      generateEmptyData()
    } finally {
      setLoading(false)
    }
  }

  const generateEmptyData = () => {
    const emptyData: ContributionData[] = []
    const today = new Date()
    
    for (let i = 0; i < 365; i++) {
      const date = subDays(today, i)
      emptyData.push({
        date: format(date, 'yyyy-MM-dd'),
        count: 0,
        tasks: [],
        pendingTasks: [],
        totalHours: 0,
        projects: [],
        pendingCount: 0
      })
    }
    
    setContributions(emptyData)
    setStats({
      totalContributions: 0,
      currentStreak: 0,
      longestStreak: 0,
      averagePerDay: 0,
      totalHours: 0
    })
  }

  const generateSampleData = () => {
    const sampleData: ContributionData[] = []
    const today = new Date()
    
    for (let i = 0; i < 365; i++) {
      const date = subDays(today, i)
      const count = Math.random() > 0.7 ? Math.floor(Math.random() * 5) + 1 : 0
      const pendingCount = Math.random() > 0.6 ? Math.floor(Math.random() * 3) + 1 : 0
      
      // Gerar dados de exemplo mais detalhados
      const tasks = count > 0 ? Array.from({ length: count }, (_, index) => ({
        id: `task-${i}-${index}`,
        title: `Tarefa ${index + 1} do dia ${format(date, 'dd/MM')}`,
        status: 'completed',
        completedAt: format(date, 'yyyy-MM-dd') + 'T' + (9 + Math.floor(Math.random() * 8)).toString().padStart(2, '0') + ':' + Math.floor(Math.random() * 60).toString().padStart(2, '0') + ':00',
        priority: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
        description: `Descrição da tarefa ${index + 1}`,
        estimatedHours: Math.floor(Math.random() * 4) + 1,
        actualHours: Math.floor(Math.random() * 4) + 1,
        project: {
          id: `project-${Math.floor(Math.random() * 3) + 1}`,
          name: ['Projeto Alpha', 'Projeto Beta', 'Projeto Gamma'][Math.floor(Math.random() * 3)]
        },
        assignee: {
          id: 'user-1',
          name: 'Usuário Exemplo',
          avatar: undefined
        }
      })) : []

      // Gerar tarefas pendentes
      const pendingTasks = pendingCount > 0 ? Array.from({ length: pendingCount }, (_, index) => ({
        id: `pending-task-${i}-${index}`,
        title: `Tarefa Pendente ${index + 1} do dia ${format(date, 'dd/MM')}`,
        status: ['TODO', 'IN_PROGRESS'][Math.floor(Math.random() * 2)],
        dueDate: format(date, 'yyyy-MM-dd'),
        priority: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
        description: `Descrição da tarefa pendente ${index + 1}`,
        estimatedHours: Math.floor(Math.random() * 4) + 1,
        project: {
          id: `project-${Math.floor(Math.random() * 3) + 1}`,
          name: ['Projeto Alpha', 'Projeto Beta', 'Projeto Gamma'][Math.floor(Math.random() * 3)]
        },
        assignee: {
          id: 'user-1',
          name: 'Usuário Exemplo',
          avatar: undefined
        }
      })) : []

      const totalHours = tasks.reduce((sum, task) => sum + (task.actualHours || 0), 0)
      const projects = [...new Set(tasks.map(task => task.project?.name).filter(Boolean))] as string[]
      
      sampleData.push({
        date: format(date, 'yyyy-MM-dd'),
        count,
        tasks,
        pendingTasks,
        totalHours,
        projects,
        pendingCount
      })
    }
    
    setContributions(sampleData)
    calculateStats(sampleData)
  }

  const calculateStats = (data: ContributionData[]) => {
    const totalContributions = data.reduce((sum, item) => sum + item.count, 0)
    const daysWithContributions = data.filter(item => item.count > 0).length
    const averagePerDay = daysWithContributions > 0 ? totalContributions / daysWithContributions : 0

    // Calcular streak atual
    let currentStreak = 0
    const sortedData = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    
    for (const item of sortedData) {
      if (item.count > 0) {
        currentStreak++
      } else {
        break
      }
    }

    // Calcular maior streak
    let longestStreak = 0
    let tempStreak = 0
    
    for (const item of sortedData.reverse()) {
      if (item.count > 0) {
        tempStreak++
        longestStreak = Math.max(longestStreak, tempStreak)
      } else {
        tempStreak = 0
      }
    }

    setStats({
      totalContributions,
      currentStreak,
      longestStreak,
      averagePerDay: Math.round(averagePerDay * 10) / 10,
      totalHours: 0
    })
  }

  const formatTime = (hours: number) => {
    if (hours === 0) return '0h'
    if (hours < 1) {
      const minutes = Math.round(hours * 60)
      return `${minutes}min`
    }
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours - wholeHours) * 60)
    if (minutes === 0) return `${wholeHours}h`
    return `${wholeHours}h ${minutes}min`
  }

  const getClassForValue = (value: any) => {
    if (!value || value.count === 0) {
      return 'color-empty'
    }
    
    if (value.count >= 4) return 'color-scale-4'
    if (value.count >= 3) return 'color-scale-3'
    if (value.count >= 2) return 'color-scale-2'
    return 'color-scale-1'
  }

  const getTitleForValue = (value: any) => {
    if (!value) return 'Nenhuma atividade'
    
    const date = format(parseISO(value.date), 'dd/MM/yyyy', { locale: ptBR })
    const count = value.count || 0
    const contributionData = contributions.find(c => c.date === value.date)
    
    if (!contributionData || count === 0) {
      return `${date}: Nenhuma atividade`
    }
    
    const hours = contributionData.totalActualHours || 0
    const projects = contributionData.projectsCount || 0
    const efficiency = contributionData.efficiency || 100
    
    let tooltip = `${date}: ${count} tarefa${count > 1 ? 's' : ''} concluída${count > 1 ? 's' : ''}`
    
    if (hours > 0) {
      tooltip += `\n${formatTime(hours)} trabalhadas`
    }
    
    if (projects > 0) {
      tooltip += `\n${projects} projeto${projects > 1 ? 's' : ''}`
    }
    
    if (contributionData.totalEstimatedHours && contributionData.totalEstimatedHours > 0) {
      tooltip += `\nEficiência: ${efficiency}%`
    }
    
    return tooltip
  }

  // Funções para lidar com interações do mouse
  const handleMouseEnter = (event: React.MouseEvent, value: any) => {
    if (!value) return
    
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    })
    
    const contributionData = contributions.find(c => c.date === value.date)
    if (contributionData) {
      setTooltipData(contributionData)
      setTooltipVisible(true)
    }
  }

  const handleMouseLeave = () => {
    setTooltipVisible(false)
    setTooltipData(null)
  }

  const handleClick = async (value: any) => {
    if (!value || (value.count === 0 && (!contributions.find(c => c.date === value.date)?.pendingCount || contributions.find(c => c.date === value.date)?.pendingCount === 0))) return
    
    const contributionData = contributions.find(c => c.date === value.date)
    if (!contributionData) return

    try {
      // Buscar dados detalhados da API
      let detailedData
      
      if (token) {
        const response = await fetch(`/api/collaborator-portal/${token}/contributions/${value.date}`)
        if (response.ok) {
          detailedData = await response.json()
        } else {
          throw new Error('Erro ao carregar dados detalhados')
        }
      } else {
        // Fallback para dados simulados se não há token
        detailedData = {
          date: contributionData.date,
          count: contributionData.count,
          pendingCount: contributionData.pendingCount || 0,
          tasks: contributionData.tasks || [],
          pendingTasks: contributionData.pendingTasks || [],
          totalHours: contributionData.totalHours || 0,
          projects: contributionData.projects || []
        }
      }

      // Processar dados para o modal
      const modalData = {
        date: detailedData.date,
        count: detailedData.count,
        pendingCount: detailedData.pendingCount || 0,
        tasks: detailedData.tasks || [],
        pendingTasks: detailedData.pendingTasks || [],
        totalHours: detailedData.totalHours || 0,
        estimatedHours: detailedData.tasks?.reduce((sum: number, task: any) => sum + (task.estimatedHours || 0), 0) || 0,
        pendingEstimatedHours: detailedData.pendingTasks?.reduce((sum: number, task: any) => sum + (task.estimatedHours || 0), 0) || 0,
        projects: (detailedData.projects || []).map((projectName: string) => ({
          id: `project-${projectName}`,
          name: projectName,
          tasksCount: detailedData.tasks?.filter((task: any) => task.project?.name === projectName).length || 0,
          hoursSpent: detailedData.tasks?.filter((task: any) => task.project?.name === projectName).reduce((sum: number, task: any) => sum + (task.actualHours || 0), 0) || 0,
          pendingTasksCount: detailedData.pendingTasks?.filter((task: any) => task.project?.name === projectName).length || 0
        })),
        productivity: {
          completionRate: detailedData.count > 0 ? 100 : 0,
          efficiency: Math.floor(Math.random() * 30) + 70,
          timeAccuracy: Math.floor(Math.random() * 40) + 60
        },
        comments: Math.random() > 0.7 ? [
          {
            id: 'comment-1',
            content: detailedData.pendingCount && detailedData.pendingCount > 0 
              ? `Dia produtivo! Finalizei ${detailedData.count} tarefa${detailedData.count > 1 ? 's' : ''}, mas ainda tenho ${detailedData.pendingCount} pendente${detailedData.pendingCount > 1 ? 's' : ''}.`
              : `Dia muito produtivo! Consegui finalizar todas as ${detailedData.count} tarefas planejadas.`,
            createdAt: detailedData.date + 'T18:30:00',
            author: 'Usuário Exemplo'
          }
        ] : []
      }

      setModalData(modalData)
      setModalOpen(true)
    } catch (error) {
      console.error('Erro ao carregar dados detalhados:', error)
      
      // Fallback para dados simulados em caso de erro
      const detailedData = {
        date: contributionData.date,
        count: contributionData.count,
        pendingCount: contributionData.pendingCount || 0,
        tasks: contributionData.tasks || [],
        pendingTasks: contributionData.pendingTasks || [],
        totalHours: contributionData.totalHours || 0,
        estimatedHours: contributionData.tasks?.reduce((sum, task) => sum + (task.estimatedHours || 0), 0) || 0,
        pendingEstimatedHours: contributionData.pendingTasks?.reduce((sum, task) => sum + (task.estimatedHours || 0), 0) || 0,
        projects: (contributionData.projects || []).map(projectName => ({
          id: `project-${projectName}`,
          name: projectName,
          tasksCount: contributionData.tasks?.filter(task => task.project?.name === projectName).length || 0,
          hoursSpent: contributionData.tasks?.filter(task => task.project?.name === projectName).reduce((sum, task) => sum + (task.actualHours || 0), 0) || 0,
          pendingTasksCount: contributionData.pendingTasks?.filter(task => task.project?.name === projectName).length || 0
        })),
        productivity: {
          completionRate: contributionData.count > 0 ? 100 : 0,
          efficiency: Math.floor(Math.random() * 30) + 70,
          timeAccuracy: Math.floor(Math.random() * 40) + 60
        },
        comments: []
      }

      setModalData(detailedData)
      setModalOpen(true)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>
          Visualização das suas atividades concluídas nos últimos 12 meses
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Heatmap */}
          <div className="contribution-heatmap" ref={heatmapRef}>
            <CalendarHeatmap
              startDate={startDate}
              endDate={endDate}
              values={contributions}
              classForValue={getClassForValue}
              titleForValue={getTitleForValue}
              showWeekdayLabels={true}
              showMonthLabels={true}
              gutterSize={2}
              onClick={handleClick}
              onMouseOver={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            />
          </div>

          {/* Legenda */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Menos</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-100 rounded-sm border"></div>
              <div className="w-3 h-3 bg-green-200 rounded-sm"></div>
              <div className="w-3 h-3 bg-green-300 rounded-sm"></div>
              <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
              <div className="w-3 h-3 bg-green-700 rounded-sm"></div>
            </div>
            <span>Mais</span>
          </div>

          {/* Estatísticas */}
          {showStats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {stats.totalContributions}
                </div>
                <div className="text-sm text-gray-600">
                  Total no ano
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {formatTime(stats.totalHours)}
                </div>
                <div className="text-sm text-gray-600">
                  Tempo gasto
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">
                  {stats.currentStreak}
                </div>
                <div className="text-sm text-gray-600">
                  Sequência atual
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.longestStreak}
                </div>
                <div className="text-sm text-gray-600">
                  Maior sequência
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {stats.averagePerDay}
                </div>
                <div className="text-sm text-gray-600">
                  Média por dia
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* Tooltip personalizado */}
      <CustomTooltip
        data={tooltipData}
        position={tooltipPosition}
        visible={tooltipVisible}
      />

      {/* Modal de detalhes */}
      <DayDetailsModal
        data={modalData}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />

      <style jsx global>{`
        .contribution-heatmap .react-calendar-heatmap {
          width: 100%;
        }
        
        .contribution-heatmap .react-calendar-heatmap .color-empty {
          fill: #ebedf0;
        }
        
        .contribution-heatmap .react-calendar-heatmap .color-scale-1 {
          fill: #9be9a8;
        }
        
        .contribution-heatmap .react-calendar-heatmap .color-scale-2 {
          fill: #40c463;
        }
        
        .contribution-heatmap .react-calendar-heatmap .color-scale-3 {
          fill: #30a14e;
        }
        
        .contribution-heatmap .react-calendar-heatmap .color-scale-4 {
          fill: #216e39;
        }
        
        .contribution-heatmap .react-calendar-heatmap text {
          fill: #666;
          font-size: 10px;
        }
        
        .contribution-heatmap .react-calendar-heatmap rect:hover {
          stroke: #555;
          stroke-width: 1px;
          cursor: pointer;
        }
        
        .contribution-heatmap .react-calendar-heatmap rect {
          cursor: pointer;
        }
      `}</style>
    </Card>
  )
}
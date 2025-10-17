'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { TrendingDown, Calendar, Target } from 'lucide-react'
import { format, differenceInDays, eachDayOfInterval, isAfter, isBefore } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Task {
  id: string
  storyPoints?: number
  completedAt?: string
  createdAt: string
}

interface Sprint {
  id: string
  name: string
  startDate: string
  endDate: string
  capacity?: number
  tasks: Task[]
}

interface BurndownChartProps {
  sprint: Sprint
}

interface BurndownData {
  date: string
  ideal: number
  actual: number
  day: number
}

export function BurndownChart({ sprint }: BurndownChartProps) {
  const burndownData = useMemo(() => {
    const startDate = new Date(sprint.startDate)
    const endDate = new Date(sprint.endDate)
    const today = new Date()
    
    // Calcular total de story points
    const totalStoryPoints = sprint.tasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0)
    
    // Gerar array de datas do sprint
    const sprintDays = eachDayOfInterval({ start: startDate, end: endDate })
    const totalDays = sprintDays.length - 1 // Excluir o primeiro dia
    
    const data: BurndownData[] = sprintDays.map((date, index) => {
      // Linha ideal (linear)
      const ideal = totalStoryPoints - (totalStoryPoints * (index / totalDays))
      
      // Linha atual (baseada nas tarefas completadas até esta data)
      let actual = totalStoryPoints
      
      // Se a data é no passado ou hoje, calcular story points restantes
      if (!isAfter(date, today)) {
        const completedPoints = sprint.tasks
          .filter(task => {
            if (!task.completedAt) return false
            const completedDate = new Date(task.completedAt)
            return !isAfter(completedDate, date)
          })
          .reduce((sum, task) => sum + (task.storyPoints || 0), 0)
        
        actual = totalStoryPoints - completedPoints
      } else {
        // Para datas futuras, usar o valor atual
        const completedPoints = sprint.tasks
          .filter(task => task.completedAt)
          .reduce((sum, task) => sum + (task.storyPoints || 0), 0)
        
        actual = totalStoryPoints - completedPoints
      }
      
      return {
        date: format(date, 'dd/MM'),
        ideal: Math.max(0, ideal),
        actual: Math.max(0, actual),
        day: index + 1
      }
    })
    
    return data
  }, [sprint])

  const getChartStats = () => {
    const totalStoryPoints = sprint.tasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0)
    const completedStoryPoints = sprint.tasks
      .filter(task => task.completedAt)
      .reduce((sum, task) => sum + (task.storyPoints || 0), 0)
    
    const remainingStoryPoints = totalStoryPoints - completedStoryPoints
    const progressPercentage = totalStoryPoints > 0 ? Math.round((completedStoryPoints / totalStoryPoints) * 100) : 0
    
    const startDate = new Date(sprint.startDate)
    const endDate = new Date(sprint.endDate)
    const today = new Date()
    
    const totalDays = differenceInDays(endDate, startDate)
    const elapsedDays = Math.min(differenceInDays(today, startDate), totalDays)
    const remainingDays = Math.max(totalDays - elapsedDays, 0)
    
    // Velocidade atual (story points por dia)
    const currentVelocity = elapsedDays > 0 ? completedStoryPoints / elapsedDays : 0
    
    // Previsão de conclusão
    const daysToComplete = currentVelocity > 0 ? remainingStoryPoints / currentVelocity : Infinity
    const isOnTrack = daysToComplete <= remainingDays
    
    return {
      totalStoryPoints,
      completedStoryPoints,
      remainingStoryPoints,
      progressPercentage,
      totalDays,
      elapsedDays,
      remainingDays,
      currentVelocity,
      isOnTrack,
      daysToComplete: isFinite(daysToComplete) ? Math.ceil(daysToComplete) : null
    }
  }

  const stats = getChartStats()

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{`Dia ${label}`}</p>
          <p className="text-blue-600">
            {`Ideal: ${payload[0]?.value?.toFixed(1)} SP`}
          </p>
          <p className="text-green-600">
            {`Atual: ${payload[1]?.value?.toFixed(1)} SP`}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5" />
          Burndown Chart - {sprint.name}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-6">
          {/* Estatísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {stats.completedStoryPoints}
              </div>
              <div className="text-sm text-gray-600">SP Concluídos</div>
            </div>
            
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {stats.remainingStoryPoints}
              </div>
              <div className="text-sm text-gray-600">SP Restantes</div>
            </div>
            
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {stats.currentVelocity.toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">SP/Dia</div>
            </div>
            
            <div className={`text-center p-3 rounded-lg ${
              stats.isOnTrack ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <div className={`text-2xl font-bold ${
                stats.isOnTrack ? 'text-green-600' : 'text-red-600'
              }`}>
                {stats.progressPercentage}%
              </div>
              <div className="text-sm text-gray-600">Progresso</div>
            </div>
          </div>

          {/* Gráfico */}
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={burndownData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Story Points', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {/* Linha ideal */}
                <Line
                  type="monotone"
                  dataKey="ideal"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Ideal"
                />
                
                {/* Linha atual */}
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  name="Atual"
                />
                
                {/* Linha de hoje */}
                <ReferenceLine 
                  x={format(new Date(), 'dd/MM')} 
                  stroke="#ef4444" 
                  strokeDasharray="2 2"
                  label={{ value: "Hoje", position: "top" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Análise */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Cronograma
              </h4>
              <div className="space-y-1 text-gray-600">
                <p>Dias decorridos: {stats.elapsedDays} de {stats.totalDays}</p>
                <p>Dias restantes: {stats.remainingDays}</p>
                {stats.daysToComplete && (
                  <p className={stats.isOnTrack ? 'text-green-600' : 'text-red-600'}>
                    Previsão: {stats.daysToComplete} dias para conclusão
                  </p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Target className="w-4 h-4" />
                Status
              </h4>
              <div className="space-y-1 text-gray-600">
                <p>Velocidade média: {stats.currentVelocity.toFixed(1)} SP/dia</p>
                <p className={stats.isOnTrack ? 'text-green-600' : 'text-red-600'}>
                  {stats.isOnTrack ? '✓ No prazo' : '⚠ Atrasado'}
                </p>
                {sprint.capacity && (
                  <p>Capacidade planejada: {sprint.capacity} SP</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

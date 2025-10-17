'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  User, 
  Clock, 
  Play, 
  Pause, 
  CheckCircle2, 
  Calendar,
  TrendingUp,
  Activity
} from 'lucide-react'
import { format, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface CollaboratorStatsProps {
  userId: string
  userName: string
}

interface ProductivityStats {
  totalWorkTime: number
  totalWorkTimeFormatted: string
  totalSessions: number
  tasksWorked: number
  tasksCompleted: number
  completionRate: number
  averageSessionTime: number
  averageSessionTimeFormatted: string
  period: {
    startDate: string
    endDate: string
    days: number
  }
  taskBreakdown: Array<{
    taskId: string
    taskTitle: string
    projectName: string
    totalTime: number
    sessions: number
    completedAt: string | null
  }>
}

export function CollaboratorStats({ userId, userName }: CollaboratorStatsProps) {
  const [stats, setStats] = useState<ProductivityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today')

  useEffect(() => {
    fetchStats()
  }, [userId, period])

  const fetchStats = async () => {
    try {
      setLoading(true)
      
      const now = new Date()
      let startDate: Date
      let endDate = now

      switch (period) {
        case 'today':
          startDate = startOfDay(now)
          endDate = endOfDay(now)
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        default:
          startDate = startOfDay(now)
      }

      const response = await fetch(
        `/api/timer-events/stats?userId=${userId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      )
      
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPeriodLabel = () => {
    switch (period) {
      case 'today': return 'Hoje'
      case 'week': return 'Últimos 7 dias'
      case 'month': return 'Últimos 30 dias'
      default: return 'Hoje'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Carregando estatísticas...</p>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Nenhuma atividade encontrada</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {userName}
          </CardTitle>
          <div className="flex gap-1">
            {(['today', 'week', 'month'] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={period === p ? 'default' : 'outline'}
                onClick={() => setPeriod(p)}
                className="text-xs"
              >
                {p === 'today' ? 'Hoje' : p === 'week' ? '7d' : '30d'}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-sm text-gray-600">{getPeriodLabel()}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Métricas Principais */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <Clock className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-blue-600">
              {stats.totalWorkTimeFormatted}
            </div>
            <div className="text-xs text-gray-600">Tempo Total</div>
          </div>
          
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-green-600">
              {stats.tasksCompleted}/{stats.tasksWorked}
            </div>
            <div className="text-xs text-gray-600">Tarefas Concluídas</div>
          </div>
        </div>

        {/* Estatísticas Secundárias */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Sessões:</span>
            <span className="font-medium">{stats.totalSessions}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Taxa:</span>
            <span className="font-medium">{stats.completionRate}%</span>
          </div>
          
          <div className="flex items-center gap-2 col-span-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Média por sessão:</span>
            <span className="font-medium">{stats.averageSessionTimeFormatted}</span>
          </div>
        </div>

        {/* Breakdown por Tarefa */}
        {stats.taskBreakdown.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Tarefas Trabalhadas</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {stats.taskBreakdown.map((task) => (
                <div
                  key={task.taskId}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{task.taskTitle}</div>
                    <div className="text-gray-500 truncate">{task.projectName}</div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Badge variant={task.completedAt ? 'default' : 'secondary'} className="text-xs">
                      {Math.floor(task.totalTime / 60)}min
                    </Badge>
                    {task.completedAt && (
                      <CheckCircle2 className="w-3 h-3 text-green-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

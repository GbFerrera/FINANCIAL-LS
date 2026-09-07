'use client'

import { useMemo, useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatsCard } from '@/components/ui/stats-card'
import { LoadingAnimation } from '@/components/ui/loading-animation'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { User, CheckCircle2, Activity } from 'lucide-react'
import { startOfDay, endOfDay } from 'date-fns'

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
  dailyBreakdown?: Array<{
    date: string
    label: string
    minutes: number
  }>
  projectBreakdown?: Array<{
    name: string
    minutes: number
  }>
}

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

function truncateName(name: string, max = 22) {
  return name.length > max ? `${name.slice(0, max)}…` : name
}

function ProgressRing({ value, size = 72 }: { value: number; size?: number }) {
  const clamped = Math.min(100, Math.max(0, value))
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold tabular-nums text-foreground">{clamped}%</span>
      </div>
    </div>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
  unit = 'min',
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number }>
  label?: string
  unit?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-sm">
      {label && <p className="mb-1 font-medium text-foreground">{label}</p>}
      {payload.map((entry, index) => (
        <p key={index} className="text-muted-foreground">
          {entry.name}:{' '}
          <span className="font-medium tabular-nums text-foreground">
            {entry.value} {unit}
          </span>
        </p>
      ))}
    </div>
  )
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
      case 'today':
        return 'Hoje'
      case 'week':
        return 'Últimos 7 dias'
      case 'month':
        return 'Últimos 30 dias'
      default:
        return 'Hoje'
    }
  }

  const topTasksChart = useMemo(() => {
    if (!stats) return []
    return [...stats.taskBreakdown]
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 6)
      .map((task) => ({
        id: task.taskId,
        name: truncateName(task.taskTitle),
        fullName: task.taskTitle,
        minutes: Math.round(task.totalTime / 60),
      }))
  }, [stats])

  const completionChart = useMemo(() => {
    if (!stats) return []
    const pending = Math.max(0, stats.tasksWorked - stats.tasksCompleted)
    return [
      { name: 'Concluídas', value: stats.tasksCompleted },
      { name: 'Em andamento', value: pending },
    ].filter((item) => item.value > 0)
  }, [stats])

  const projectChart = useMemo(() => {
    if (!stats?.projectBreakdown?.length) {
      const map = new Map<string, number>()
      stats?.taskBreakdown.forEach((task) => {
        const key = task.projectName || 'Sem projeto'
        map.set(key, (map.get(key) || 0) + Math.round(task.totalTime / 60))
      })
      return Array.from(map.entries()).map(([name, minutes]) => ({ name, minutes }))
    }
    return stats.projectBreakdown
  }, [stats])

  const dailyChart = useMemo(() => stats?.dailyBreakdown ?? [], [stats])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <LoadingAnimation size="sm" />
          <p className="mt-2 text-sm text-muted-foreground">Carregando estatísticas...</p>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Activity className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhuma atividade encontrada</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <User className="h-5 w-5" />
              Estatísticas — {userName}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{getPeriodLabel()}</p>
          </div>
          <div className="flex rounded-md border border-border p-0.5">
            {(['today', 'week', 'month'] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={period === p ? 'default' : 'ghost'}
                onClick={() => setPeriod(p)}
                className="h-8 px-3 text-xs"
              >
                {p === 'today' ? 'Hoje' : p === 'week' ? '7 dias' : '30 dias'}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard title="Tempo total" value={stats.totalWorkTimeFormatted} />
          <StatsCard
            title="Tarefas"
            value={`${stats.tasksCompleted}/${stats.tasksWorked}`}
            description="concluídas / trabalhadas"
          />
          <StatsCard title="Sessões" value={stats.totalSessions} description="de foco registradas" />
          <StatsCard
            title="Média/sessão"
            value={stats.averageSessionTimeFormatted}
            description={`Taxa ${stats.completionRate}%`}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col items-center justify-center rounded-lg border border-border p-4">
            <p className="mb-4 text-sm font-medium text-foreground">Taxa de conclusão</p>
            <ProgressRing value={stats.completionRate} size={96} />
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {stats.tasksCompleted} concluída{stats.tasksCompleted === 1 ? '' : 's'} de{' '}
              {stats.tasksWorked} trabalhada{stats.tasksWorked === 1 ? '' : 's'}
            </p>
          </div>

          <div className="rounded-lg border border-border p-4 lg:col-span-2">
            <p className="mb-4 text-sm font-medium text-foreground">Tempo por dia</p>
            {dailyChart.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                Sem registros no período
              </div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyChart} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => (
                        <ChartTooltip
                          active={active}
                          payload={payload?.map((p) => ({
                            name: 'Tempo',
                            value: p.value as number,
                          }))}
                          label={payload?.[0]?.payload?.label}
                        />
                      )}
                    />
                    <Bar dataKey="minutes" name="Tempo" fill="var(--foreground)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <p className="mb-4 text-sm font-medium text-foreground">Tempo por projeto</p>
            {projectChart.length === 0 ? (
              <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
                Sem dados de projeto
              </div>
            ) : (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={projectChart}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={3}
                        dataKey="minutes"
                        nameKey="name"
                      >
                        {projectChart.map((_, index) => (
                          <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => (
                          <ChartTooltip
                            active={active}
                            payload={payload?.map((p) => ({
                              name: p.name,
                              value: p.value as number,
                            }))}
                            label={payload?.[0]?.payload?.name}
                          />
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-3">
                  {projectChart.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                      />
                      {truncateName(item.name, 16)} ({item.minutes}min)
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="rounded-lg border border-border p-4">
            <p className="mb-4 text-sm font-medium text-foreground">Status das tarefas</p>
            {completionChart.length === 0 ? (
              <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
                Sem tarefas no período
              </div>
            ) : (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={completionChart}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        <Cell fill="var(--foreground)" />
                        <Cell fill="var(--muted-foreground)" />
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => (
                          <ChartTooltip
                            active={active}
                            payload={payload?.map((p) => ({
                              name: p.name,
                              value: p.value as number,
                            }))}
                            unit="tarefa(s)"
                          />
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
                  {completionChart.map((item) => (
                    <span key={item.name}>
                      {item.name}: {item.value}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {topTasksChart.length > 0 && (
          <div className="rounded-lg border border-border p-4">
            <p className="mb-4 text-sm font-medium text-foreground">Top tarefas por tempo</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topTasksChart}
                  layout="vertical"
                  margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/60" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => (
                      <ChartTooltip
                        active={active}
                        payload={payload?.map((p) => ({
                          name: 'Tempo',
                          value: p.value as number,
                        }))}
                        label={payload?.[0]?.payload?.fullName}
                      />
                    )}
                  />
                  <Bar dataKey="minutes" name="Tempo" fill="var(--foreground)" radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {stats.taskBreakdown.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-medium text-foreground">Detalhamento por tarefa</h4>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {stats.taskBreakdown.map((task) => (
                <div
                  key={task.taskId}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{task.taskTitle}</div>
                    <div className="truncate text-muted-foreground">{task.projectName}</div>
                  </div>
                  <div className="ml-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-normal">
                      {Math.floor(task.totalTime / 60)}min
                    </Badge>
                    {task.completedAt && <CheckCircle2 className="h-3 w-3 text-muted-foreground" />}
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

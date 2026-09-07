'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { StatsCard } from '@/components/ui/stats-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageLoadingGate } from '@/components/ui/loading-animation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TeamPerformanceMemberCard,
  type PerformanceMember,
} from '@/components/team/TeamPerformanceMemberCard'
import { MODULES_LABEL } from '@/lib/module-labels'
import { AlertCircle, Filter, RefreshCw, User } from 'lucide-react'
import toast from 'react-hot-toast'

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
  teamMembers: PerformanceMember[]
  milestonesSummary: {
    total: number
    completed: number
    inProgress: number
    overdue: number
  }
}

function truncateName(name: string, max = 14) {
  return name.length > max ? `${name.slice(0, max)}…` : name
}

function ChartTooltip({
  active,
  payload,
  label,
  suffix = '',
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number }>
  label?: string
  suffix?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-sm">
      {label ? <p className="mb-1 font-medium text-foreground">{label}</p> : null}
      {payload.map((entry, i) => (
        <p key={i} className="text-muted-foreground">
          {entry.name}:{' '}
          <span className="font-medium tabular-nums text-foreground">
            {entry.value}
            {suffix}
          </span>
        </p>
      ))}
    </div>
  )
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

  const filteredMembers = useMemo(() => {
    if (!performanceData) return []
    if (selectedMember === 'all') return performanceData.teamMembers
    return performanceData.teamMembers.filter((m) => m.id === selectedMember)
  }, [performanceData, selectedMember])

  const completionChartData = useMemo(() => {
    if (!performanceData) return []
    return performanceData.teamMembers.map((m) => ({
      id: m.id,
      name: truncateName(m.name),
      fullName: m.name,
      conclusao: m.performance.completionRate,
      eficiencia: m.performance.efficiency,
    }))
  }, [performanceData])

  const hoursChartData = useMemo(() => {
    if (!performanceData) return []
    return performanceData.teamMembers.map((m) => ({
      id: m.id,
      name: truncateName(m.name),
      fullName: m.name,
      horas: m.timeTracking.hoursToday,
    }))
  }, [performanceData])

  const periodLabel =
    selectedPeriod === 'week' ? 'Esta semana' : selectedPeriod === 'month' ? 'Este mês' : 'Hoje'

  return (
    <PageLoadingGate loading={status === 'loading' || loading}>
      {!performanceData ? (
        <div className="py-12 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium text-foreground">Erro ao carregar dados</h3>
          <p className="mb-4 text-muted-foreground">
            Não foi possível carregar os dados de performance.
          </p>
          <Button onClick={fetchPerformanceData}>Tentar novamente</Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Performance da Equipe</h1>
              <p className="text-muted-foreground">
                Acompanhe o desempenho e produtividade dos colaboradores
              </p>
            </div>
            <div className="mt-4 flex items-center gap-3 sm:mt-0">
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
              <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="sm">
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Membros Ativos"
              value={performanceData.overview.activeMembers}
              change={{
                value: `${performanceData.overview.totalMembers} total`,
                type: 'neutral',
              }}
            />
            <StatsCard
              title="Tarefas Concluídas"
              value={performanceData.overview.tasksCompletedToday}
              change={{
                value: `${performanceData.overview.tasksPendingToday} pendentes`,
                type: 'neutral',
              }}
            />
            <StatsCard
              title="Taxa de Conclusão Média"
              value={`${performanceData.overview.averageCompletionRate.toFixed(1)}%`}
              change={{
                value: `${performanceData.overview.tasksScheduledTomorrow} para amanhã`,
                type: 'neutral',
              }}
            />
            <StatsCard
              title="Horas Trabalhadas"
              value={`${performanceData.overview.totalHoursToday.toFixed(1)}h`}
              change={{
                value: `${performanceData.overview.activeMembers > 0 ? (performanceData.overview.totalHoursToday / performanceData.overview.activeMembers).toFixed(1) : '0'}h média`,
                type: 'neutral',
              }}
            />
          </div>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Visão geral — {periodLabel}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatsCard title={`${MODULES_LABEL} total`} value={performanceData.milestonesSummary.total} />
                <StatsCard title="Concluídos" value={performanceData.milestonesSummary.completed} />
                <StatsCard title="Em progresso" value={performanceData.milestonesSummary.inProgress} />
                <StatsCard title="Atrasados" value={performanceData.milestonesSummary.overdue} />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <p className="mb-4 text-sm font-medium">Performance por membro</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={completionChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          content={({ active, payload }) => (
                            <ChartTooltip
                              active={active}
                              payload={payload}
                              label={payload?.[0]?.payload?.fullName}
                              suffix="%"
                            />
                          )}
                        />
                        <Bar
                          dataKey="conclusao"
                          name="Conclusão"
                          fill="var(--foreground)"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={24}
                        />
                        <Bar
                          dataKey="eficiencia"
                          name="Eficiência"
                          fill="var(--muted-foreground)"
                          fillOpacity={0.45}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={24}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <p className="mb-4 text-sm font-medium">Horas registradas por membro</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hoursChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          content={({ active, payload }) => (
                            <ChartTooltip
                              active={active}
                              payload={payload}
                              label={payload?.[0]?.payload?.fullName}
                              suffix="h"
                            />
                          )}
                        />
                        <Bar
                          dataKey="horas"
                          name="Horas"
                          fill="var(--chart-2)"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={32}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 shrink-0 text-muted-foreground" />
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

          <div className="space-y-6">
            {filteredMembers.map((member) => (
              <TeamPerformanceMemberCard key={member.id} member={member} />
            ))}
          </div>

          {filteredMembers.length === 0 && (
            <div className="py-12 text-center">
              <User className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium text-foreground">Nenhum membro encontrado</h3>
              <p className="text-muted-foreground">Não há membros da equipe para exibir.</p>
            </div>
          )}
        </div>
      )}
    </PageLoadingGate>
  )
}

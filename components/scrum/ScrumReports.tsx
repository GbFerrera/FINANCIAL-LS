'use client'

import { useMemo, useState } from 'react'
import { StatsCard } from '@/components/ui/stats-card'
import { PageLoadingGate } from '@/components/ui/loading-animation'
import { useScrumProjectData } from '@/hooks/useScrumProjectData'
import { cn } from '@/lib/utils'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const STATUS_THEME: Record<
  string,
  { fill: string; gradient: [string, string]; glow: string; label: string }
> = {
  DRAFT: {
    fill: '#94a3b8',
    gradient: ['#cbd5e1', '#64748b'],
    glow: 'rgba(148,163,184,0.35)',
    label: 'Rascunho',
  },
  TODO: {
    fill: '#6366f1',
    gradient: ['#818cf8', '#4f46e5'],
    glow: 'rgba(99,102,241,0.35)',
    label: 'A fazer',
  },
  IN_PROGRESS: {
    fill: '#f59e0b',
    gradient: ['#fbbf24', '#d97706'],
    glow: 'rgba(245,158,11,0.35)',
    label: 'Em andamento',
  },
  IN_REVIEW: {
    fill: '#06b6d4',
    gradient: ['#22d3ee', '#0891b2'],
    glow: 'rgba(6,182,212,0.35)',
    label: 'Em teste',
  },
  COMPLETED: {
    fill: '#10b981',
    gradient: ['#34d399', '#059669'],
    glow: 'rgba(16,185,129,0.35)',
    label: 'Concluído',
  },
}

const PRIORITY_THEME: Record<string, { gradient: [string, string]; label: string }> = {
  LOW: { gradient: ['#94a3b8', '#64748b'], label: 'Baixa' },
  MEDIUM: { gradient: ['#818cf8', '#4f46e5'], label: 'Média' },
  HIGH: { gradient: ['#fbbf24', '#d97706'], label: 'Alta' },
  URGENT: { gradient: ['#f87171', '#dc2626'], label: 'Urgente' },
}

const VELOCITY_THEME = {
  delivered: { gradient: ['#818cf8', '#4f46e5'] as [string, string], label: 'Entregue' },
  planned: { gradient: ['#e2e8f0', '#cbd5e1'] as [string, string], label: 'Planejado' },
}

interface ScrumReportsProps {
  projectId: string
}

type StatusDatum = { name: string; value: number; status: string; pct: number }

function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
        className
      )}
    >
      <div className="border-b border-border/80 bg-gradient-to-r from-muted/40 to-transparent px-5 py-3.5">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: Record<string, unknown> }>
  label?: string
  formatter?: (value: number, name: string) => [string, string]
}) {
  if (!active || !payload?.length) return null

  const fullLabel =
    (payload[0]?.payload?.fullName as string | undefined) ??
    (payload[0]?.payload?.name as string | undefined) ??
    label

  return (
    <div className="min-w-[140px] rounded-lg border border-border bg-popover/95 px-3 py-2.5 shadow-xl backdrop-blur-sm">
      {fullLabel && (
        <p className="mb-2 truncate text-xs font-semibold text-foreground">{fullLabel}</p>
      )}
      <div className="space-y-1.5">
        {payload.map((entry, index) => {
          const value = entry.value ?? 0
          const [formattedValue, formattedName] = formatter
            ? formatter(value, entry.name ?? '')
            : [String(value), entry.name ?? '']
          return (
            <div key={`${entry.name}-${index}`} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                {entry.color && (
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: entry.color }} />
                )}
                {formattedName}
              </span>
              <span className="font-medium tabular-nums text-foreground">{formattedValue}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatusTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: StatusDatum }>
}) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  const theme = STATUS_THEME[item.status] ?? STATUS_THEME.TODO
  return (
    <div className="rounded-lg border border-border bg-popover/95 px-3 py-2.5 shadow-xl backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.fill }} />
        <span className="text-xs font-medium text-foreground">{item.name}</span>
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
        {item.value}
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">({item.pct}%)</span>
      </p>
    </div>
  )
}

function ActiveDonutSlice(props: {
  cx?: number
  cy?: number
  innerRadius?: number
  outerRadius?: number
  startAngle?: number
  endAngle?: number
  fill?: string
}) {
  const { cx = 0, cy = 0, innerRadius = 0, outerRadius = 0, startAngle = 0, endAngle = 0, fill } = props
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 6}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      cornerRadius={4}
      style={{ filter: `drop-shadow(0 4px 8px ${fill}55)` }}
    />
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center p-6">
      <div className="rounded-lg border border-dashed border-border bg-muted/10 px-6 py-8 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

export function ScrumReports({ projectId }: ScrumReportsProps) {
  const { data, loading, error } = useScrumProjectData(projectId)
  const [activeStatusIndex, setActiveStatusIndex] = useState<number | undefined>(undefined)

  const completionRate =
    data && data.metrics.totalStoryPoints > 0
      ? Math.round((data.metrics.completedStoryPoints / data.metrics.totalStoryPoints) * 100)
      : 0

  const taskCompletionRate =
    data && data.metrics.totalTasks > 0
      ? Math.round((data.metrics.completedTasks / data.metrics.totalTasks) * 100)
      : 0

  const statusChartData = useMemo<StatusDatum[]>(() => {
    if (!data) return []
    const counts = data.tasks.reduce(
      (acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )
    return Object.entries(counts)
      .filter(([, value]) => value > 0)
      .map(([status, value]) => ({
        status,
        name: STATUS_THEME[status]?.label ?? status,
        value,
        pct: data.metrics.totalTasks > 0 ? Math.round((value / data.metrics.totalTasks) * 100) : 0,
      }))
  }, [data])

  const velocityData = useMemo(
    () =>
      data?.sprints
        .filter((s) => s.status === 'COMPLETED')
        .slice(-8)
        .map((sprint) => ({
          name: sprint.name.length > 12 ? `${sprint.name.slice(0, 12)}…` : sprint.name,
          fullName: sprint.name,
          velocity: sprint.tasks
            .filter((t) => t.status === 'COMPLETED')
            .reduce((sum, t) => sum + (t.storyPoints || 0), 0),
          planned: sprint.capacity || 0,
        })) ?? [],
    [data]
  )

  const sprintCompletionData = useMemo(
    () =>
      data?.sprints.slice(-6).map((sprint) => {
        const total = sprint.tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0)
        const done = sprint.tasks
          .filter((t) => t.status === 'COMPLETED')
          .reduce((sum, t) => sum + (t.storyPoints || 0), 0)
        return {
          name: sprint.name.length > 12 ? `${sprint.name.slice(0, 12)}…` : sprint.name,
          fullName: sprint.name,
          progress: total > 0 ? Math.round((done / total) * 100) : 0,
        }
      }) ?? [],
    [data]
  )

  const priorityChartData = useMemo(() => {
    if (!data) return []
    const counts = data.tasks.reduce(
      (acc, task) => {
        const key = task.priority || 'MEDIUM'
        acc[key] = (acc[key] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )
    return Object.entries(counts).map(([priority, value]) => ({
      priority,
      name: PRIORITY_THEME[priority]?.label ?? priority,
      value,
    }))
  }, [data])

  const teamData = useMemo(
    () =>
      data?.teamMembers.map((member) => {
        const memberTasks = data.tasks.filter((t) => t.assigneeId === member.id)
        const completed = memberTasks.filter((t) => t.status === 'COMPLETED').length
        return {
          id: member.id,
          name: member.name.split(' ')[0],
          fullName: member.name,
          concluidas: completed,
          pendentes: memberTasks.length - completed,
        }
      }) ?? [],
    [data]
  )

  if (error) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">Não foi possível carregar os relatórios.</p>
      </div>
    )
  }

  return (
    <PageLoadingGate loading={loading}>
      {!data ? null : (
        <div className="space-y-6">
          <div>
            <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Relatórios do projeto
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Velocidade, entrega e distribuição de tarefas
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatsCard title="Sprints concluídas" value={data.metrics.completedSprints} />
            <StatsCard
              title="Tarefas concluídas"
              value={`${data.metrics.completedTasks}/${data.metrics.totalTasks}`}
              description={`${taskCompletionRate}% do total`}
            />
            <StatsCard
              title="Story points"
              value={`${data.metrics.completedStoryPoints}/${data.metrics.totalStoryPoints}`}
              description={`${completionRate}% entregue`}
            />
            <StatsCard title="Velocidade média" value={`${data.metrics.averageVelocity} SP`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            <ChartCard
              title="Distribuição por status"
              subtitle={`${data.metrics.totalTasks} tarefas · ${taskCompletionRate}% concluídas`}
              className="lg:col-span-5"
            >
              {statusChartData.length === 0 ? (
                <EmptyChart message="Sem tarefas para analisar" />
              ) : (
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="relative mx-auto h-[220px] w-full max-w-[220px] shrink-0 sm:mx-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <defs>
                          {Object.entries(STATUS_THEME).map(([key, theme]) => (
                            <linearGradient key={key} id={`scrum-status-${key}`} x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor={theme.gradient[0]} />
                              <stop offset="100%" stopColor={theme.gradient[1]} />
                            </linearGradient>
                          ))}
                        </defs>
                        <Pie
                          data={statusChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={62}
                          outerRadius={88}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                          activeIndex={activeStatusIndex}
                          activeShape={ActiveDonutSlice}
                          onMouseEnter={(_, index) => setActiveStatusIndex(index)}
                          onMouseLeave={() => setActiveStatusIndex(undefined)}
                        >
                          {statusChartData.map((entry) => (
                            <Cell
                              key={entry.status}
                              fill={`url(#scrum-status-${entry.status})`}
                              opacity={
                                activeStatusIndex === undefined ||
                                statusChartData[activeStatusIndex]?.status === entry.status
                                  ? 1
                                  : 0.45
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<StatusTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
                        {data.metrics.totalTasks}
                      </span>
                      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        tarefas
                      </span>
                      <span className="mt-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {taskCompletionRate}% feito
                      </span>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                    {statusChartData.map((item) => {
                      const theme = STATUS_THEME[item.status] ?? STATUS_THEME.TODO
                      return (
                        <button
                          key={item.status}
                          type="button"
                          className="group w-full rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-border hover:bg-muted/50"
                          onMouseEnter={() =>
                            setActiveStatusIndex(
                              statusChartData.findIndex((d) => d.status === item.status)
                            )
                          }
                          onMouseLeave={() => setActiveStatusIndex(undefined)}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                              <span
                                className="h-2.5 w-2.5 rounded-full ring-2 ring-offset-1 ring-offset-card"
                                style={{
                                  backgroundColor: theme.fill,
                                  boxShadow: `0 0 8px ${theme.glow}`,
                                }}
                              />
                              {item.name}
                            </span>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {item.value} · {item.pct}%
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${item.pct}%`,
                                background: `linear-gradient(90deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
                              }}
                            />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </ChartCard>

            <ChartCard
              title="Velocidade por sprint"
              subtitle="Story points entregues vs. planejados"
              className="lg:col-span-7"
            >
              {velocityData.length === 0 ? (
                <EmptyChart message="Conclua sprints para ver a velocidade" />
              ) : (
                <>
                  <div className="h-[280px] px-2 pb-2 pt-2 sm:px-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={velocityData} barGap={4} barCategoryGap="24%" margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                        <defs>
                          <linearGradient id="scrum-velocity-delivered" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={VELOCITY_THEME.delivered.gradient[0]} />
                            <stop offset="100%" stopColor={VELOCITY_THEME.delivered.gradient[1]} />
                          </linearGradient>
                          <linearGradient id="scrum-velocity-planned" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={VELOCITY_THEME.planned.gradient[0]} />
                            <stop offset="100%" stopColor={VELOCITY_THEME.planned.gradient[1]} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          tickLine={false}
                          axisLine={false}
                          dy={8}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          tickLine={false}
                          axisLine={false}
                          width={32}
                          allowDecimals={false}
                        />
                        <Tooltip
                          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.35, radius: 6 }}
                          content={(props) => (
                            <ChartTooltip
                              {...props}
                              formatter={(value, name) => [
                                `${value} SP`,
                                name === 'velocity' ? 'Entregue' : 'Planejado',
                              ]}
                            />
                          )}
                        />
                        <Bar
                          dataKey="velocity"
                          name="velocity"
                          fill="url(#scrum-velocity-delivered)"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={40}
                        />
                        <Bar
                          dataKey="planned"
                          name="planned"
                          fill="url(#scrum-velocity-planned)"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border/80 px-4 py-3">
                    {[VELOCITY_THEME.delivered, VELOCITY_THEME.planned].map((item) => (
                      <span key={item.label} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span
                          className="h-2 w-3 rounded-sm"
                          style={{
                            background: `linear-gradient(180deg, ${item.gradient[0]}, ${item.gradient[1]})`,
                          }}
                        />
                        {item.label}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Entrega por sprint" subtitle="Percentual de story points concluídos">
              {sprintCompletionData.length === 0 ? (
                <EmptyChart message="Nenhuma sprint com dados" />
              ) : (
                <div className="space-y-3 p-5">
                  {sprintCompletionData.map((sprint) => (
                    <div key={sprint.fullName} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium text-foreground">{sprint.fullName}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{sprint.progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                          style={{ width: `${sprint.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>

            <ChartCard title="Tarefas por prioridade" subtitle="Volume por nível de urgência">
              {priorityChartData.length === 0 ? (
                <EmptyChart message="Sem tarefas cadastradas" />
              ) : (
                <div className="h-[280px] px-2 pb-4 pt-2 sm:px-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priorityChartData} barCategoryGap="32%" margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <defs>
                        {Object.entries(PRIORITY_THEME).map(([key, theme]) => (
                          <linearGradient key={key} id={`scrum-priority-${key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={theme.gradient[0]} />
                            <stop offset="100%" stopColor={theme.gradient[1]} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={false}
                        dy={8}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={false}
                        width={32}
                      />
                      <Tooltip
                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.35, radius: 6 }}
                        content={(props) => (
                          <ChartTooltip {...props} formatter={(value) => [`${value} tarefas`, 'Total']} />
                        )}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                        {priorityChartData.map((entry) => (
                          <Cell key={entry.priority} fill={`url(#scrum-priority-${entry.priority})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>
          </div>

          {teamData.length > 0 && (
            <ChartCard title="Produtividade da equipe" subtitle="Tarefas concluídas vs. pendentes por membro">
              <div className="h-[300px] px-2 pb-4 pt-2 sm:px-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teamData} barCategoryGap="28%" margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="scrum-team-done" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                      <linearGradient id="scrum-team-pending" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e2e8f0" />
                        <stop offset="100%" stopColor="#cbd5e1" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      dy={8}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      width={32}
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.35, radius: 6 }}
                      content={(props) => <ChartTooltip {...props} />}
                    />
                    <Bar
                      dataKey="concluidas"
                      name="Concluídas"
                      stackId="team"
                      fill="url(#scrum-team-done)"
                      maxBarSize={48}
                    />
                    <Bar
                      dataKey="pendentes"
                      name="Pendentes"
                      stackId="team"
                      fill="url(#scrum-team-pending)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={48}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border/80 px-4 py-3">
                {[
                  { label: 'Concluídas', gradient: ['#34d399', '#059669'] as [string, string] },
                  { label: 'Pendentes', gradient: ['#e2e8f0', '#cbd5e1'] as [string, string] },
                ].map((item) => (
                  <span key={item.label} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span
                      className="h-2 w-3 rounded-sm"
                      style={{
                        background: `linear-gradient(180deg, ${item.gradient[0]}, ${item.gradient[1]})`,
                      }}
                    />
                    {item.label}
                  </span>
                ))}
              </div>
            </ChartCard>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatsCard title="Taxa de entrega (SP)" value={`${completionRate}%`} />
            <StatsCard
              title="Eficiência de sprints"
              value={
                data.metrics.totalSprints > 0
                  ? `${Math.round((data.metrics.completedSprints / data.metrics.totalSprints) * 100)}%`
                  : '—'
              }
            />
            <StatsCard title="Sprints ativas" value={data.metrics.activeSprints} />
            <StatsCard title="Total de sprints" value={data.metrics.totalSprints} />
          </div>
        </div>
      )}
    </PageLoadingGate>
  )
}

'use client'

import { useMemo, useState } from 'react'
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
import { CheckCircle, DollarSign, Flag, Layers, Users } from 'lucide-react'
import { TASK_STATUS_LABELS, statusLabel } from '@/lib/pipeline/task-utils'
import { cn } from '@/lib/utils'

const STATUS_THEME: Record<string, string> = {
  DRAFT: '#94a3b8',
  TODO: '#6366f1',
  IN_PROGRESS: '#f59e0b',
  IN_REVIEW: '#06b6d4',
  COMPLETED: '#10b981',
  DONE: '#10b981',
}

const PRIORITY_THEME: Record<string, string> = {
  LOW: '#94a3b8',
  MEDIUM: '#6366f1',
  HIGH: '#f59e0b',
  URGENT: '#ef4444',
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

const MODULE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluído',
}

type Task = { status: string; priority: string }
type Milestone = {
  id: string
  name: string
  status: string
  completedAt?: string | null
}

type ProjectOverviewPanelProps = {
  milestones: Milestone[]
  tasks: Task[]
  teamCount: number
  progress: number
  modulesLabel: string
  isAdmin?: boolean
  budget?: number
}

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
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
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
      outerRadius={outerRadius + 5}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      cornerRadius={4}
    />
  )
}

export function ProjectOverviewPanel({
  milestones,
  tasks,
  teamCount,
  progress,
  modulesLabel,
  isAdmin,
  budget,
}: ProjectOverviewPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const completedModules = milestones.filter(
    (m) => m.status === 'COMPLETED' || !!m.completedAt
  ).length
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'DONE').length

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {}
    tasks.forEach((t) => {
      counts[t.status] = (counts[t.status] || 0) + 1
    })
    const total = tasks.length || 1
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([status, value]) => ({
        status,
        name: TASK_STATUS_LABELS[status] || statusLabel(status),
        value,
        pct: Math.round((value / total) * 100),
        fill: STATUS_THEME[status] ?? '#64748b',
      }))
  }, [tasks])

  const priorityData = useMemo(() => {
    const order = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']
    const counts: Record<string, number> = {}
    tasks.forEach((t) => {
      counts[t.priority] = (counts[t.priority] || 0) + 1
    })
    return order
      .filter((p) => counts[p])
      .map((p) => ({
        name: PRIORITY_LABELS[p] || p,
        value: counts[p],
        fill: PRIORITY_THEME[p],
      }))
  }, [tasks])

  const moduleRows = useMemo(() => {
    return milestones.map((m) => {
      const done = m.status === 'COMPLETED' || !!m.completedAt
      const pct = done ? 100 : m.status === 'IN_PROGRESS' ? 55 : 0
      return {
        id: m.id,
        name: m.name,
        status: MODULE_STATUS_LABELS[m.status] || m.status,
        pct,
        done,
      }
    })
  }, [milestones])

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  return (
    <div className="space-y-5">
      <div className={cn('grid grid-cols-2 gap-3', isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
        <KpiCard
          label={modulesLabel}
          value={`${completedModules}/${milestones.length}`}
          sub="concluídos"
          icon={Layers}
        />
        <KpiCard
          label="Tarefas"
          value={`${completedTasks}/${tasks.length}`}
          sub="finalizadas"
          icon={CheckCircle}
        />
        <KpiCard label="Equipe" value={String(teamCount)} sub="membros" icon={Users} />
        <KpiCard label="Progresso" value={`${progress}%`} sub="geral" icon={Flag} />
        {isAdmin && budget != null && (
          <KpiCard label="Orçamento" value={formatCurrency(budget)} icon={DollarSign} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Tarefas por status" subtitle="Distribuição do pipeline">
          {statusData.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
              Nenhuma tarefa ainda
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 p-4 sm:flex-row sm:items-start sm:justify-center">
              <div className="h-52 w-full max-w-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                      activeIndex={activeIndex}
                      activeShape={ActiveDonutSlice}
                      onMouseEnter={(_, i) => setActiveIndex(i)}
                    >
                      {statusData.map((entry) => (
                        <Cell key={entry.status} fill={entry.fill} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const item = payload[0].payload as (typeof statusData)[0]
                        return (
                          <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                            <p className="font-medium">{item.name}</p>
                            <p className="tabular-nums text-muted-foreground">
                              {item.value} ({item.pct}%)
                            </p>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 sm:flex-col sm:justify-start">
                {statusData.map((item) => (
                  <div key={item.status} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-semibold tabular-nums text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Tarefas por prioridade" subtitle="O que exige mais atenção">
          {priorityData.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
              Sem dados de prioridade
            </div>
          ) : (
            <div className="h-56 p-4 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                  <XAxis
                    dataKey="name"
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
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                          <p className="font-medium">{payload[0].payload.name}</p>
                          <p className="tabular-nums">{payload[0].value} tarefa(s)</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {priorityData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {milestones.length > 0 && (
        <ChartCard title={`Progresso dos ${modulesLabel.toLowerCase()}`} subtitle="Avanço por fase">
          <div className="space-y-4 p-5">
            {moduleRows.map((row) => (
              <div key={row.id}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-foreground">{row.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{row.status}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      row.done ? 'bg-emerald-500' : row.pct > 0 ? 'bg-amber-500' : 'bg-muted-foreground/30'
                    )}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      <div className="rounded-xl border border-border bg-muted/20 px-5 py-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Progresso geral do projeto</span>
          <span className="tabular-nums text-muted-foreground">{progress}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

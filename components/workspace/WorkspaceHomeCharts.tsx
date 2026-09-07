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
import { TASK_STATUS_LABELS } from '@/lib/pipeline/task-utils'
import { cn } from '@/lib/utils'

const STATUS_THEME: Record<
  string,
  { fill: string; gradient: [string, string]; glow: string }
> = {
  DRAFT: { fill: '#94a3b8', gradient: ['#cbd5e1', '#64748b'], glow: 'rgba(148,163,184,0.35)' },
  TODO: { fill: '#6366f1', gradient: ['#818cf8', '#4f46e5'], glow: 'rgba(99,102,241,0.35)' },
  IN_PROGRESS: { fill: '#f59e0b', gradient: ['#fbbf24', '#d97706'], glow: 'rgba(245,158,11,0.35)' },
  IN_REVIEW: { fill: '#06b6d4', gradient: ['#22d3ee', '#0891b2'], glow: 'rgba(6,182,212,0.35)' },
  COMPLETED: { fill: '#10b981', gradient: ['#34d399', '#059669'], glow: 'rgba(16,185,129,0.35)' },
}

type StatusDatum = { name: string; value: number; status: string; pct: number }
type ProjectDatum = {
  name: string
  fullName: string
  concluidas: number
  emCurso: number
  aFazer: number
  rascunhos: number
  total: number
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

function ProjectTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; payload?: ProjectDatum }>
}) {
  if (!active || !payload?.length) return null
  const fullName = payload[0]?.payload?.fullName ?? ''
  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0)
  return (
    <div className="min-w-[160px] rounded-lg border border-border bg-popover/95 px-3 py-2.5 shadow-xl backdrop-blur-sm">
      <p className="mb-2 truncate text-xs font-semibold text-foreground">{fullName}</p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-medium tabular-nums text-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
        Total: <span className="font-semibold text-foreground">{total}</span>
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
      outerRadius={outerRadius + 6}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      cornerRadius={4}
      style={{ filter: `drop-shadow(0 4px 8px ${fill}55)` }}
    />
  )
}

export function WorkspaceHomeCharts({
  totalTasks,
  completed,
  taskStats,
  projects,
}: {
  totalTasks: number
  completed: number
  taskStats: { status: string; count: number }[]
  projects: Array<{
    name: string
    completed: number
    inProgress: number
    todo: number
    drafts: number
    total: number
  }>
}) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)

  const completionRate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0

  const statusChartData = useMemo<StatusDatum[]>(
    () =>
      taskStats
        .filter((s) => s.count > 0)
        .map((s) => ({
          name: TASK_STATUS_LABELS[s.status] ?? s.status,
          value: s.count,
          status: s.status,
          pct: totalTasks > 0 ? Math.round((s.count / totalTasks) * 100) : 0,
        })),
    [taskStats, totalTasks]
  )

  const projectChartData = useMemo<ProjectDatum[]>(
    () =>
      projects.map((p) => ({
        name: p.name.length > 12 ? `${p.name.slice(0, 12)}…` : p.name,
        fullName: p.name,
        concluidas: p.completed,
        emCurso: p.inProgress,
        aFazer: p.todo,
        rascunhos: p.drafts,
        total: p.total,
      })),
    [projects]
  )

  if (totalTasks === 0) return null

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* Donut + legend */}
      <ChartCard
        title="Distribuição por status"
        subtitle={`${totalTasks} tarefas · ${completionRate}% concluídas`}
        className="lg:col-span-5"
      >
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="relative mx-auto h-[220px] w-full max-w-[220px] shrink-0 sm:mx-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {Object.entries(STATUS_THEME).map(([key, theme]) => (
                    <linearGradient key={key} id={`status-grad-${key}`} x1="0" y1="0" x2="1" y2="1">
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
                  activeIndex={activeIndex}
                  activeShape={ActiveDonutSlice}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(undefined)}
                >
                  {statusChartData.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={`url(#status-grad-${entry.status})`}
                      className="outline-none transition-opacity"
                      opacity={activeIndex === undefined || statusChartData[activeIndex]?.status === entry.status ? 1 : 0.45}
                    />
                  ))}
                </Pie>
                <Tooltip content={<StatusTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
                {totalTasks}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                tarefas
              </span>
              <span className="mt-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                {completionRate}% feito
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
                    setActiveIndex(statusChartData.findIndex((d) => d.status === item.status))
                  }
                  onMouseLeave={() => setActiveIndex(undefined)}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-full ring-2 ring-offset-1 ring-offset-card"
                        style={{ backgroundColor: theme.fill, boxShadow: `0 0 8px ${theme.glow}` }}
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
      </ChartCard>

      {/* Bar chart */}
      <ChartCard
        title="Tarefas por projeto"
        subtitle="Volume empilhado por status"
        className="lg:col-span-7"
      >
        <div className="h-[300px] px-2 pb-4 pt-2 sm:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={projectChartData} barCategoryGap="28%" margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                {Object.entries(STATUS_THEME).map(([key, theme]) => (
                  <linearGradient key={`bar-${key}`} id={`bar-grad-${key}`} x1="0" y1="0" x2="0" y2="1">
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
                content={<ProjectTooltip />}
              />
              <Bar
                dataKey="rascunhos"
                name="Rascunho"
                stackId="stack"
                fill="url(#bar-grad-DRAFT)"
                radius={[0, 0, 0, 0]}
                maxBarSize={48}
              />
              <Bar dataKey="aFazer" name="A Fazer" stackId="stack" fill="url(#bar-grad-TODO)" maxBarSize={48} />
              <Bar
                dataKey="emCurso"
                name="Em curso"
                stackId="stack"
                fill="url(#bar-grad-IN_PROGRESS)"
                maxBarSize={48}
              />
              <Bar
                dataKey="concluidas"
                name="Concluídas"
                stackId="stack"
                fill="url(#bar-grad-COMPLETED)"
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border/80 px-4 py-3">
          {[
            { key: 'DRAFT', label: 'Rascunho' },
            { key: 'TODO', label: 'A Fazer' },
            { key: 'IN_PROGRESS', label: 'Em curso' },
            { key: 'COMPLETED', label: 'Concluídas' },
          ].map(({ key, label }) => {
            const theme = STATUS_THEME[key]
            return (
              <span key={key} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  className="h-2 w-3 rounded-sm"
                  style={{
                    background: `linear-gradient(180deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
                  }}
                />
                {label}
              </span>
            )
          })}
        </div>
      </ChartCard>
    </div>
  )
}

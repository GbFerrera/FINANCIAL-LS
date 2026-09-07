"use client"

import { useMemo, useState } from "react"
import { parseISO, format, differenceInCalendarDays } from "date-fns"
import { ptBR } from "date-fns/locale"
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
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatsCard } from "@/components/ui/stats-card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface Project {
  id: string
  name: string
  status: "ACTIVE" | "COMPLETED" | "ON_HOLD"
  budget: number
  spent: number
  startDate: string
  endDate: string
  teamMembers: number
  progress: number
}

interface ProjectsOverviewProps {
  projects: Project[]
}

const statusLabels = {
  ACTIVE: "Ativo",
  COMPLETED: "Concluído",
  ON_HOLD: "Pausado",
} as const

const STATUS_CHART_COLORS: Record<Project["status"], string> = {
  ACTIVE: "var(--chart-1)",
  COMPLETED: "var(--chart-2)",
  ON_HOLD: "var(--chart-3)",
}

const VISIBLE_PROJECTS = 5
const CHART_PROJECT_LIMIT = 8

function truncateName(name: string, max = 18) {
  return name.length > max ? `${name.slice(0, max)}…` : name
}

const METRIC_LABELS: Record<string, string> = {
  budget: "Orçamento",
  spent: "Gasto",
  progress: "Progresso",
  value: "Quantidade",
}

function translateMetricLabel(name?: string) {
  if (!name) return name
  return METRIC_LABELS[name] ?? name
}

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  showMetricLabel = true,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string
  formatter?: (value: number, name?: string) => string
  showMetricLabel?: boolean
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-sm">
      {label && <p className="mb-1 font-medium text-foreground">{label}</p>}
      {payload.map((entry, index) => (
        <p key={index} className="text-muted-foreground">
          {showMetricLabel && (
            <>
              {translateMetricLabel(entry.name)}:{" "}
            </>
          )}
          <span className="font-medium tabular-nums text-foreground">
            {formatter ? formatter(entry.value ?? 0, entry.name) : entry.value}
          </span>
        </p>
      ))}
    </div>
  )
}

function ProgressRing({
  value,
  size = 80,
  strokeWidth = 6,
  centerLabel,
  centerSublabel,
}: {
  value: number
  size?: number
  strokeWidth?: number
  centerLabel?: string
  centerSublabel?: string
}) {
  const clamped = Math.min(100, Math.max(0, value))
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
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {centerLabel ?? `${clamped}%`}
        </span>
        {centerSublabel && (
          <span className="text-[10px] text-muted-foreground">{centerSublabel}</span>
        )}
      </div>
    </div>
  )
}

function MiniMetricRing({
  label,
  value,
  detail,
  unavailable,
}: {
  label: string
  value: number | null
  detail: string
  unavailable?: string
}) {
  return (
    <div className="flex flex-col items-center rounded-md border border-border px-3 py-3">
      <ProgressRing
        value={value ?? 0}
        size={52}
        strokeWidth={5}
        centerLabel={value != null ? `${value}%` : unavailable ?? "—"}
      />
      <p className="mt-2 text-xs font-medium text-foreground">{label}</p>
      <p className="mt-0.5 line-clamp-2 text-center text-[11px] text-muted-foreground">{detail}</p>
    </div>
  )
}

function getTimelineProgress(startDate: string, endDate: string) {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  const now = new Date()
  const totalDays = differenceInCalendarDays(end, start)

  if (totalDays <= 0) return { percent: 100, detail: "Prazo encerrado" }

  const elapsedDays = differenceInCalendarDays(now, start)
  const percent = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)))
  const remainingDays = differenceInCalendarDays(end, now)

  if (remainingDays < 0) {
    return { percent: 100, detail: `${Math.abs(remainingDays)}d de atraso` }
  }

  if (remainingDays === 0) {
    return { percent, detail: "Vence hoje" }
  }

  return { percent, detail: `${remainingDays}d restantes` }
}

function getBudgetUsage(budget: number, spent: number) {
  if (budget <= 0) return null
  return Math.min(100, Math.round((spent / budget) * 100))
}

function ProjectDetailCard({
  project,
  formatCurrency,
  formatDate,
}: {
  project: Project
  formatCurrency: (value: number) => string
  formatDate: (dateString: string) => string
}) {
  const timeline = getTimelineProgress(project.startDate, project.endDate)
  const budgetUsage = getBudgetUsage(project.budget, project.spent)
  const budgetRemaining = Math.max(0, project.budget - project.spent)

  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-2 sm:pt-1">
          <ProgressRing
            value={project.progress}
            size={88}
            strokeWidth={7}
            centerSublabel="progresso"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-base font-semibold text-foreground">{project.name}</h4>
            <Badge variant="outline" className="font-normal">
              {statusLabels[project.status]}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MiniMetricRing
              label="Orçamento"
              value={budgetUsage}
              unavailable="—"
              detail={
                project.budget > 0
                  ? `${formatCurrency(project.spent)} / ${formatCurrency(project.budget)}`
                  : "Sem orçamento"
              }
            />
            <MiniMetricRing
              label="Cronograma"
              value={timeline.percent}
              detail={`${timeline.detail} · ${formatDate(project.endDate)}`}
            />
            <div className="flex flex-col items-center rounded-md border border-border px-3 py-3">
              <div className="flex h-[52px] w-[52px] items-end justify-center gap-1">
                {project.teamMembers === 0 ? (
                  <span className="text-sm font-semibold text-muted-foreground">—</span>
                ) : (
                  Array.from({ length: Math.min(project.teamMembers, 6) }).map((_, index) => (
                    <div
                      key={index}
                      className="w-1.5 rounded-sm bg-foreground/70"
                      style={{ height: `${Math.max(35, 100 - index * 10)}%` }}
                    />
                  ))
                )}
              </div>
              <p className="mt-2 text-xs font-medium text-foreground">Equipe</p>
              <p className="mt-0.5 text-center text-[11px] text-muted-foreground">
                {project.teamMembers} {project.teamMembers === 1 ? "membro" : "membros"}
              </p>
              {budgetRemaining > 0 && (
                <p className="mt-1 text-center text-[11px] text-muted-foreground">
                  Saldo {formatCurrency(budgetRemaining)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ProjectsOverview({ projects }: ProjectsOverviewProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>("all")

  const filteredProjects =
    selectedStatus === "all"
      ? projects
      : projects.filter((project) => project.status === selectedStatus)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), "dd/MM/yyyy", { locale: ptBR })
  }

  const summary = useMemo(() => {
    const activeCount = filteredProjects.filter((p) => p.status === "ACTIVE").length
    const avgProgress =
      filteredProjects.length > 0
        ? Math.round(
            filteredProjects.reduce((sum, p) => sum + p.progress, 0) / filteredProjects.length
          )
        : 0
    const totalBudget = filteredProjects.reduce((sum, p) => sum + p.budget, 0)
    const totalSpent = filteredProjects.reduce((sum, p) => sum + p.spent, 0)

    return { activeCount, avgProgress, totalBudget, totalSpent }
  }, [filteredProjects])

  const statusChartData = useMemo(() => {
    const counts = {
      ACTIVE: 0,
      COMPLETED: 0,
      ON_HOLD: 0,
    }

    filteredProjects.forEach((project) => {
      counts[project.status] += 1
    })

    return (Object.keys(counts) as Project["status"][])
      .map((status) => ({
        status,
        name: statusLabels[status],
        value: counts[status],
      }))
      .filter((item) => item.value > 0)
  }, [filteredProjects])

  const progressChartData = useMemo(() => {
    return [...filteredProjects]
      .sort((a, b) => b.progress - a.progress)
      .slice(0, CHART_PROJECT_LIMIT)
      .map((project) => ({
        id: project.id,
        name: truncateName(project.name),
        fullName: project.name,
        progress: project.progress,
      }))
  }, [filteredProjects])

  const budgetChartData = useMemo(() => {
    return [...filteredProjects]
      .filter((project) => project.budget > 0 || project.spent > 0)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, CHART_PROJECT_LIMIT)
      .map((project) => ({
        id: project.id,
        name: truncateName(project.name),
        fullName: project.name,
        budget: project.budget,
        spent: project.spent,
      }))
  }, [filteredProjects])

  const visibleProjects = filteredProjects.slice(0, VISIBLE_PROJECTS)
  const hasMoreProjects = filteredProjects.length > VISIBLE_PROJECTS

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-semibold">Projetos Ativos</CardTitle>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ACTIVE">Ativos</SelectItem>
            <SelectItem value="COMPLETED">Concluídos</SelectItem>
            <SelectItem value="ON_HOLD">Pausados</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="space-y-6">
        {filteredProjects.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Nenhum projeto encontrado</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatsCard title="Total" value={filteredProjects.length} />
              <StatsCard title="Ativos" value={summary.activeCount} />
              <StatsCard title="Progresso médio" value={`${summary.avgProgress}%`} />
              <StatsCard
                title="Orçamento / Gasto"
                value={formatCurrency(summary.totalBudget)}
                description={`Gasto: ${formatCurrency(summary.totalSpent)}`}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border p-4">
                <p className="mb-4 text-sm font-medium text-foreground">Distribuição por status</p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {statusChartData.map((entry) => (
                          <Cell key={entry.status} fill={STATUS_CHART_COLORS[entry.status]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => (
                          <ChartTooltip
                            active={active}
                            payload={payload}
                            label={payload?.[0]?.payload?.name}
                            formatter={(value) => `${value} projeto${value === 1 ? "" : "s"}`}
                          />
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-3">
                  {statusChartData.map((item) => (
                    <div key={item.status} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: STATUS_CHART_COLORS[item.status] }}
                      />
                      {item.name} ({item.value})
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="mb-4 text-sm font-medium text-foreground">Progresso por projeto</p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={progressChartData}
                      layout="vertical"
                      margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/60" />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={72}
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => (
                          <ChartTooltip
                            active={active}
                            payload={payload}
                            label={payload?.[0]?.payload?.fullName}
                            formatter={(value) => `${value}%`}
                          />
                        )}
                      />
                      <Bar
                        dataKey="progress"
                        name="Progresso"
                        fill="var(--foreground)"
                        radius={[0, 4, 4, 0]}
                        maxBarSize={18}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {budgetChartData.length > 0 && (
              <div className="rounded-lg border border-border p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">Orçamento vs gasto</p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-foreground/80" />
                      Orçamento
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                      Gasto
                    </div>
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={budgetChartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => formatCurrency(value)}
                      />
                      <Tooltip
                        content={({ active, payload }) => (
                          <ChartTooltip
                            active={active}
                            payload={payload}
                            label={payload?.[0]?.payload?.fullName}
                            formatter={(value) => formatCurrency(value)}
                          />
                        )}
                      />
                      <Bar
                        dataKey="budget"
                        name="Orçamento"
                        fill="var(--foreground)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                      />
                      <Bar
                        dataKey="spent"
                        name="Gasto"
                        fill="var(--muted-foreground)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Detalhes recentes</p>
              {visibleProjects.map((project) => (
                <ProjectDetailCard
                  key={project.id}
                  project={project}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                />
              ))}
            </div>
          </>
        )}

        {filteredProjects.length > 0 && (
          <button
            type="button"
            className={cn(
              "w-full rounded-md border border-border bg-background py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            )}
          >
            {hasMoreProjects
              ? `Ver todos os projetos (${filteredProjects.length - VISIBLE_PROJECTS} restantes)`
              : "Ver todos os projetos"}
          </button>
        )}
      </CardContent>
    </Card>
  )
}

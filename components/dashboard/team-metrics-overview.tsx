"use client"

import { useMemo } from "react"
import { format, parseISO } from "date-fns"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatsCard } from "@/components/ui/stats-card"

interface TeamTask {
  id: string
  title: string
  projectName: string
  completedAt?: string | null
  status?: string
  dueDate?: string | null
  isOverdue?: boolean
}

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  tasksCompletedToday: number
  tasksPending: number
  tasksDueTodayNotCompleted: number
  completedTasks: TeamTask[]
  pendingTasks: TeamTask[]
}

interface TeamMetricsOverviewProps {
  members: TeamMember[]
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  TEAM: "Equipe",
  SUPERVISOR: "Supervisor",
}

const METRIC_LABELS: Record<string, string> = {
  concluidas: "Concluídas hoje",
  pendentes: "Pendentes",
  vencendo: "Vencendo hoje",
}

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

function truncateName(name: string, max = 14) {
  return name.length > max ? `${name.slice(0, max)}…` : name
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
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
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number }>
  label?: string
  formatter?: (value: number) => string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-sm">
      {label && <p className="mb-1 font-medium text-foreground">{label}</p>}
      {payload.map((entry, index) => (
        <p key={index} className="text-muted-foreground">
          {translateMetricLabel(entry.name)}:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {formatter ? formatter(entry.value ?? 0) : entry.value}
          </span>
        </p>
      ))}
    </div>
  )
}

export function TeamMetricsOverview({ members }: TeamMetricsOverviewProps) {
  const todayLabel = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })

  const summary = useMemo(() => {
    return members.reduce(
      (acc, member) => ({
        completedToday: acc.completedToday + member.tasksCompletedToday,
        pending: acc.pending + member.tasksPending,
        dueToday: acc.dueToday + member.tasksDueTodayNotCompleted,
      }),
      { completedToday: 0, pending: 0, dueToday: 0 }
    )
  }, [members])

  const productivityChartData = useMemo(() => {
    return members.map((member) => ({
      id: member.id,
      name: truncateName(member.name),
      fullName: member.name,
      concluidas: member.tasksCompletedToday,
      pendentes: member.tasksPending,
      vencendo: member.tasksDueTodayNotCompleted,
    }))
  }, [members])

  const pendingDistribution = useMemo(() => {
    return members
      .filter((member) => member.tasksPending > 0)
      .map((member) => ({
        id: member.id,
        name: truncateName(member.name),
        fullName: member.name,
        value: member.tasksPending,
      }))
  }, [members])

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base font-semibold">Métricas da Equipe — Hoje</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Tarefas concluídas e pendentes por membro
          </p>
        </div>
        <p className="hidden text-sm capitalize text-muted-foreground sm:block">{todayLabel}</p>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard title="Membros" value={members.length} />
          <StatsCard title="Concluídas hoje" value={summary.completedToday} />
          <StatsCard title="Pendentes" value={summary.pending} />
          <StatsCard title="Vencendo hoje" value={summary.dueToday} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">Produtividade por membro</p>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-foreground/80" />
                  Concluídas
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                  Pendentes
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/25" />
                  Vencendo
                </span>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productivityChartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
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
                        formatter={(value) => `${value} tarefa${value === 1 ? "" : "s"}`}
                      />
                    )}
                  />
                  <Bar dataKey="concluidas" name="Concluídas hoje" fill="var(--foreground)" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="pendentes" name="Pendentes" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="vencendo" name="Vencendo hoje" fill="var(--muted-foreground)" fillOpacity={0.35} radius={[4, 4, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <p className="mb-4 text-sm font-medium text-foreground">Distribuição de pendentes</p>
            {pendingDistribution.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                Nenhuma tarefa pendente no momento
              </div>
            ) : (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pendingDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {pendingDistribution.map((entry, index) => (
                          <Cell key={entry.id} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => (
                          <ChartTooltip
                            active={active}
                            payload={payload}
                            label={payload?.[0]?.payload?.fullName}
                            formatter={(value) => `${value} tarefa${value === 1 ? "" : "s"}`}
                          />
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-3">
                  {pendingDistribution.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                      />
                      {item.name} ({item.value})
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex min-w-0 items-center gap-3 xl:min-w-[240px] xl:shrink-0">
                  <Avatar className="h-10 w-10 border border-border">
                    <AvatarFallback className="bg-muted text-sm font-medium text-foreground">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-foreground">{member.name}</h3>
                      <Badge variant="outline" className="font-normal">
                        {ROLE_LABELS[member.role] ?? member.role}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 xl:shrink-0">
                  {[
                    { label: "Concluídas", value: member.tasksCompletedToday },
                    { label: "Pendentes", value: member.tasksPending },
                    { label: "Vencendo", value: member.tasksDueTodayNotCompleted },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex min-w-[5.5rem] items-center gap-2 rounded-md border border-border px-3 py-2"
                    >
                      <span className="text-lg font-semibold tabular-nums text-foreground">{item.value}</span>
                      <span className="text-[11px] leading-tight text-muted-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="min-w-0 flex-1 space-y-2 xl:max-w-none">
                  {member.completedTasks.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Concluídas hoje
                      </span>
                      {member.completedTasks.slice(0, 3).map((task) => (
                        <div
                          key={task.id}
                          className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5"
                        >
                          <span className="truncate text-xs font-medium text-foreground">{task.title}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{task.projectName}</span>
                        </div>
                      ))}
                      {member.completedTasks.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{member.completedTasks.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {member.pendingTasks.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Pendentes
                      </span>
                      {member.pendingTasks.slice(0, 3).map((task) => (
                        <div
                          key={task.id}
                          className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5"
                        >
                          <span className="truncate text-xs font-medium text-foreground">{task.title}</span>
                          {task.isOverdue && (
                            <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px] font-normal">
                              Atrasada
                            </Badge>
                          )}
                          <span className="shrink-0 text-[10px] text-muted-foreground">{task.projectName}</span>
                          {task.dueDate && (
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              Vence: {format(parseISO(task.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      ))}
                      {member.pendingTasks.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{member.pendingTasks.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {member.completedTasks.length === 0 && member.pendingTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sem tarefas registradas hoje</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

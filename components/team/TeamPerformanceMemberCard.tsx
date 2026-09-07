'use client'

import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MODULES_LABEL, MODULE_LABEL_LOWER } from '@/lib/module-labels'

export type PerformanceMember = {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
  tasksToday: { completed: number; pending: number; overdue: number }
  tasksTomorrow: { scheduled: number; pending: number }
  performance: {
    completionRate: number
    averageTimePerTask: number
    onTimeDelivery: number
    efficiency: number
  }
  currentTasks: Array<{
    id: string
    title: string
    status: string
    priority: string
    dueDate: string | null
    projectName: string
    milestone?: string
    isOverdue: boolean
  }>
  milestones: Array<{
    id: string
    name: string
    projectName: string
    status: string
    dueDate: string | null
    progress: number
    tasksCompleted: number
    totalTasks: number
  }>
  timeTracking: {
    hoursToday: number
    hoursThisWeek: number
    hoursThisMonth: number
    averageHoursPerDay: number
  }
}

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  TEAM: 'Equipe',
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function formatStatus(status: string) {
  const map: Record<string, string> = {
    COMPLETED: 'Concluída',
    IN_PROGRESS: 'Em andamento',
    IN_REVIEW: 'Em revisão',
    TODO: 'A fazer',
    DRAFT: 'Rascunho',
  }
  return map[status] ?? status.replace(/_/g, ' ').toLowerCase()
}

function formatPriority(priority: string) {
  const map: Record<string, string> = {
    URGENT: 'Urgente',
    HIGH: 'Alta',
    MEDIUM: 'Média',
    LOW: 'Baixa',
  }
  return map[priority] ?? priority.toLowerCase()
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

function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex min-w-[5.5rem] flex-col rounded-md border border-border px-3 py-2">
      <span className="text-lg font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>
    </div>
  )
}

export function TeamPerformanceMemberCard({ member }: { member: PerformanceMember }) {
  const tasksChart = [
    { name: 'Concluídas', value: member.tasksToday.completed },
    { name: 'Pendentes', value: member.tasksToday.pending },
    { name: 'Atrasadas', value: member.tasksToday.overdue },
    { name: 'Amanhã', value: member.tasksTomorrow.scheduled },
  ]

  const performanceChart = [
    { name: 'Conclusão', value: member.performance.completionRate },
    { name: 'Eficiência', value: member.performance.efficiency },
    { name: 'No prazo', value: member.performance.onTimeDelivery },
  ]

  const timeChart = [
    { name: 'Hoje', value: member.timeTracking.hoursToday },
    { name: 'Semana', value: member.timeTracking.hoursThisWeek },
    { name: 'Mês', value: member.timeTracking.hoursThisMonth },
    { name: 'Média/dia', value: member.timeTracking.averageHoursPerDay },
  ]

  const milestonePie = member.milestones.map((m) => ({
    name: m.name,
    value: Math.max(m.progress, 1),
  }))

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 border border-border">
              <AvatarImage src={member.avatar} alt={member.name} />
              <AvatarFallback className="bg-muted text-sm font-medium">
                {getInitials(member.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{member.name}</CardTitle>
                <Badge variant="outline" className="font-normal">
                  {ROLE_LABELS[member.role] ?? member.role}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{member.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <MetricPill label="Conclusão" value={`${member.performance.completionRate.toFixed(0)}%`} />
            <MetricPill label="Eficiência" value={`${member.performance.efficiency.toFixed(0)}%`} />
            <MetricPill label="Horas hoje" value={`${member.timeTracking.hoursToday.toFixed(1)}h`} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="tasks">Tarefas</TabsTrigger>
            <TabsTrigger value="milestones">{MODULES_LABEL}</TabsTrigger>
            <TabsTrigger value="time">Tempo</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border p-4">
                <p className="mb-3 text-sm font-medium">Indicadores de performance</p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceChart} layout="vertical" margin={{ left: 4, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/60" />
                      <XAxis type="number" domain={[0, 100]} hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={72}
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => (
                          <ChartTooltip active={active} payload={payload} suffix="%" />
                        )}
                      />
                      <Bar dataKey="value" fill="var(--foreground)" radius={[0, 4, 4, 0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="mb-3 text-sm font-medium">Horas registradas</p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timeChart}>
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
                          <ChartTooltip active={active} payload={payload} suffix="h" />
                        )}
                      />
                      <Bar dataKey="value" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4 space-y-4">
            <div className="rounded-lg border border-border p-4">
              <p className="mb-3 text-sm font-medium">Tarefas por status (hoje e amanhã)</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tasksChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={({ active, payload }) => <ChartTooltip active={active} payload={payload} />} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {tasksChart.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Tarefas atuais</p>
              {member.currentTasks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  Nenhuma tarefa em aberto
                </p>
              ) : (
                member.currentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.projectName}
                        {task.milestone ? ` · ${task.milestone}` : ''}
                        {task.dueDate
                          ? ` · ${format(parseISO(task.dueDate), 'dd/MM/yyyy', { locale: ptBR })}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      {task.isOverdue ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Atrasada
                        </Badge>
                      ) : null}
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {formatPriority(task.priority)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {formatStatus(task.status)}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="milestones" className="mt-4 space-y-4">
            {member.milestones.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                Nenhum {MODULE_LABEL_LOWER} atribuído
              </p>
            ) : (
              <>
                {milestonePie.length > 0 ? (
                  <div className="rounded-lg border border-border p-4">
                    <p className="mb-3 text-sm font-medium">Progresso dos {MODULES_LABEL.toLowerCase()}</p>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={milestonePie}
                            cx="50%"
                            cy="50%"
                            innerRadius={48}
                            outerRadius={72}
                            paddingAngle={2}
                            dataKey="value"
                            nameKey="name"
                          >
                            {milestonePie.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => (
                              <ChartTooltip active={active} payload={payload} suffix="%" />
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3">
                  {member.milestones.map((milestone) => (
                    <div key={milestone.id} className="rounded-lg border border-border p-4">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{milestone.name}</p>
                          <p className="text-xs text-muted-foreground">{milestone.projectName}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                          {formatStatus(milestone.status)}
                        </Badge>
                      </div>
                      <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                        <span>
                          {milestone.tasksCompleted}/{milestone.totalTasks} tarefas
                        </span>
                        <span className="font-medium tabular-nums text-foreground">{milestone.progress}%</span>
                      </div>
                      <Progress value={milestone.progress} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="time" className="mt-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {timeChart.map((item) => (
                <div key={item.name} className="rounded-lg border border-border p-4 text-center">
                  <p className="text-2xl font-semibold tabular-nums">{item.value.toFixed(1)}h</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.name}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border p-4">
              <p className="mb-1 text-sm text-muted-foreground">Tempo médio por tarefa</p>
              <p className="text-xl font-semibold tabular-nums">
                {member.performance.averageTimePerTask.toFixed(1)}h
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

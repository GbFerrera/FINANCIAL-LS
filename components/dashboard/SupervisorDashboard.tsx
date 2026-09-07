'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StatsCard } from '@/components/ui/stats-card'
import { LoadingAnimation } from '@/components/ui/loading-animation'
import {
  Users,
  Pause,
  AlertCircle,
  Timer,
  Target,
  Activity,
  Building2,
  LayoutGrid,
  List,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useSocket } from '@/hooks/useSocket'
import { CollaboratorStats } from './CollaboratorStats'
import { cn } from '@/lib/utils'

interface ActiveTask {
  id: string
  title: string
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  estimatedMinutes?: number
  actualMinutes?: number
  storyPoints?: number
  startTime?: string
  project: {
    id: string
    name: string
  }
  sprint?: {
    id: string
    name: string
  }
  assignee: {
    id: string
    name: string
    email: string
  }
  timeEntries: Array<{
    id: string
    startTime: string
    endTime?: string
    duration?: number
  }>
}

interface AgendaBlock {
  id: string
  startTime: string
  endTime?: string | null
  durationSeconds: number
  taskTitle: string
  projectName: string
  isActive?: boolean
}

interface CollaboratorActivity {
  userId: string
  userName: string
  userEmail: string
  isActive: boolean
  currentTask?: ActiveTask
  todayStats: {
    tasksCompleted: number
    timeWorked: number
    tasksInProgress: number
  }
  agendaBlocks?: AgendaBlock[]
}

const WORKDAY_MINUTES = 8 * 60
const AGENDA_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) return `${hours}h ${mins}min`
  return `${mins}min`
}

function formatTimeInSeconds(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function getAgendaBlocks(activity: CollaboratorActivity) {
  const dayStart = AGENDA_HOURS[0]
  const dayEnd = AGENDA_HOURS[AGENDA_HOURS.length - 1] + 1
  const source = activity.agendaBlocks?.length
    ? activity.agendaBlocks
    : (activity.currentTask?.timeEntries ?? []).map((entry) => ({
        id: entry.id,
        startTime: entry.startTime,
        endTime: entry.endTime ?? null,
        durationSeconds: entry.duration
          ? entry.duration
          : activity.isActive && !entry.endTime
            ? Math.floor((Date.now() - new Date(entry.startTime).getTime()) / 1000)
            : 1800,
        taskTitle: activity.currentTask?.title ?? 'Tarefa',
        projectName: activity.currentTask?.project?.name ?? 'Sem projeto',
        isActive: !entry.endTime,
      }))

  return source
    .map((block) => {
      const start = new Date(block.startTime)
      const startHour = start.getHours() + start.getMinutes() / 60
      const durationHours = Math.max(block.durationSeconds / 3600, 0.25)
      const endHour = Math.min(startHour + durationHours, dayEnd)

      return {
        ...block,
        startHour,
        endHour,
        startLabel: format(start, 'HH:mm'),
        endLabel: block.endTime ? format(new Date(block.endTime), 'HH:mm') : 'agora',
        durationLabel: formatDuration(Math.max(1, Math.round(block.durationSeconds / 60))),
      }
    })
    .filter((block) => block.endHour > dayStart && block.startHour < dayEnd)
}

function AgendaTimeline({ blocks }: { blocks: ReturnType<typeof getAgendaBlocks> }) {
  const dayStart = AGENDA_HOURS[0]
  const dayEnd = AGENDA_HOURS[AGENDA_HOURS.length - 1] + 1
  const daySpan = dayEnd - dayStart

  if (blocks.length === 0) {
    return (
      <div className="space-y-2">
        <div className="relative flex h-8 items-center overflow-hidden rounded-md border border-dashed border-border bg-muted/20 px-2">
          <span className="text-[10px] text-muted-foreground">Nenhum registro de tempo hoje</span>
        </div>
        <div className="flex justify-between text-[9px] tabular-nums text-muted-foreground">
          {AGENDA_HOURS.filter((_, i) => i % 2 === 0).map((hour) => (
            <span key={hour}>{hour}h</span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative h-10 overflow-hidden rounded-md border border-border bg-muted/40">
        <div className="absolute inset-0 grid grid-cols-11">
          {AGENDA_HOURS.map((hour) => (
            <div key={hour} className="border-r border-border/60 last:border-r-0" />
          ))}
        </div>
        {blocks.map((block) => {
          const left = ((block.startHour - dayStart) / daySpan) * 100
          const width = ((block.endHour - block.startHour) / daySpan) * 100
          return (
            <div
              key={block.id}
              title={`${block.taskTitle} · ${block.projectName} · ${block.startLabel}–${block.endLabel} (${block.durationLabel})`}
              className={cn(
                'absolute top-1 bottom-1 cursor-default rounded-sm px-1 transition-opacity hover:opacity-100',
                block.isActive ? 'bg-foreground/85 opacity-100' : 'bg-foreground/50 opacity-90'
              )}
              style={{ left: `${left}%`, width: `${Math.max(width, 3)}%` }}
            >
              <span className="block truncate text-[8px] font-medium leading-8 text-background">
                {block.taskTitle}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[9px] tabular-nums text-muted-foreground">
        {AGENDA_HOURS.filter((_, i) => i % 2 === 0).map((hour) => (
          <span key={hour}>{hour}h</span>
        ))}
      </div>
      <div className="space-y-1">
        {blocks.map((block) => (
          <div
            key={`${block.id}-detail`}
            className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground"
          >
            <span className="min-w-0 truncate">
              <span className="font-medium text-foreground">{block.startLabel}–{block.endLabel}</span>
              {' · '}
              {block.taskTitle}
            </span>
            <span className="shrink-0 tabular-nums">{block.durationLabel}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CollaboratorAgendaRow({
  activity,
  activeTimers,
  calculateCurrentSessionTime,
  variant = 'grid',
  onToggleStats,
  statsOpen,
}: {
  activity: CollaboratorActivity
  activeTimers: Map<string, { isPaused?: boolean; pausedTime?: number; duration?: number }>
  calculateCurrentSessionTime: (task: ActiveTask) => number
  variant?: 'grid' | 'list'
  onToggleStats?: () => void
  statsOpen?: boolean
}) {
  const blocks = getAgendaBlocks(activity)
  const workloadPercent = Math.min(100, Math.round((activity.todayStats.timeWorked / WORKDAY_MINUTES) * 100))

  const timerBlock = activity.currentTask ? (
    activeTimers.get(activity.currentTask.id)?.isPaused ? (
      <>
        <div className="mb-0.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          <Pause className="h-3 w-3" />
          Pausado
        </div>
        <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
          {formatTimeInSeconds(activeTimers.get(activity.currentTask.id)?.pausedTime || 0)}
        </p>
      </>
    ) : (
      <>
        <div className="mb-0.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          <Timer className="h-3 w-3" />
          Agora
        </div>
        <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
          {formatTimeInSeconds(calculateCurrentSessionTime(activity.currentTask))}
        </p>
      </>
    )
  ) : null

  const statItems = [
    { label: 'Concluídas', shortLabel: 'Concluídas', value: activity.todayStats.tasksCompleted },
    { label: 'Em andamento', shortLabel: 'Andamento', value: activity.todayStats.tasksInProgress },
    { label: 'Tempo hoje', shortLabel: 'Tempo', value: formatDuration(activity.todayStats.timeWorked) },
  ] as const

  const statsRow = (compact?: boolean) => (
    <div className={cn('grid gap-2', compact ? 'grid-cols-3' : 'grid-cols-3')}>
      {statItems.map((item) => (
        <div
          key={item.label}
          className={cn(
            'rounded-md border border-border text-center',
            compact ? 'min-w-[4.5rem] px-2 py-2' : 'px-2 py-2'
          )}
        >
          <p className="text-sm font-semibold tabular-nums text-foreground">{item.value}</p>
          <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
            {compact ? item.shortLabel : item.label}
          </p>
        </div>
      ))}
    </div>
  )

  if (variant === 'list') {
    return (
      <div className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Avatar className="h-10 w-10 border border-border">
              <AvatarFallback className="bg-muted text-xs font-medium text-foreground">
                {getInitials(activity.userName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{activity.userName}</p>
                <Badge variant="outline" className="font-normal">
                  {activity.isActive ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">{activity.userEmail}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 lg:shrink-0">
            <div className="shrink-0 text-right">{timerBlock}</div>
            {onToggleStats && (
              <Button size="sm" variant="outline" className="shrink-0" onClick={onToggleStats}>
                {statsOpen ? 'Ocultar' : 'Estatísticas'}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="min-w-0">
            {activity.currentTask ? (
              <div className="rounded-md border border-border px-3 py-2">
                <p className="truncate text-sm font-medium text-foreground">{activity.currentTask.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3 shrink-0" />
                    {activity.currentTask.project?.name}
                  </span>
                  {activity.currentTask.sprint && (
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3 shrink-0" />
                      {activity.currentTask.sprint.name}
                    </span>
                  )}
                  <Badge variant="outline" className="font-normal text-[10px]">
                    {activity.currentTask.status === 'IN_PROGRESS' ? 'Em andamento' : 'Pausado'}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Nenhuma tarefa em andamento
              </div>
            )}
          </div>

          <div className="w-full min-w-[15rem] sm:w-auto">{statsRow(true)}</div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-[72px_1fr] lg:items-start">
          <p className="text-[11px] text-muted-foreground lg:pt-2">Agenda</p>
          <AgendaTimeline blocks={blocks} />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-[72px_1fr] lg:items-center">
          <p className="text-[11px] text-muted-foreground">Carga</p>
          <div className="space-y-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground/75 transition-all duration-500"
                style={{ width: `${workloadPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {formatDuration(activity.todayStats.timeWorked)} de jornada ({workloadPercent}%)
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/30">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarFallback className="bg-muted text-xs font-medium text-foreground">
              {getInitials(activity.userName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{activity.userName}</p>
              <Badge variant="outline" className="font-normal">
                {activity.isActive ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">{activity.userEmail}</p>
          </div>
        </div>
        <div
          className={cn(
            'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
            activity.isActive ? 'bg-foreground' : 'bg-muted-foreground/40'
          )}
        />
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[72px_1fr] sm:items-start">
        <p className="text-[11px] text-muted-foreground sm:pt-2">Agenda</p>
        <AgendaTimeline blocks={blocks} />
      </div>

      <div className="mb-3 grid grid-cols-[72px_1fr] items-center gap-2">
        <p className="text-[11px] text-muted-foreground">Carga</p>
        <div className="space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground/75 transition-all duration-500"
              style={{ width: `${workloadPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {formatDuration(activity.todayStats.timeWorked)} de jornada ({workloadPercent}%)
          </p>
        </div>
      </div>

      {activity.currentTask ? (
        <div className="rounded-md border border-border px-3 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">{activity.currentTask.title}</p>
                <Badge variant="outline" className="font-normal text-[10px]">
                  {activity.currentTask.status === 'IN_PROGRESS' ? 'Em andamento' : 'Pausado'}
                </Badge>
              </div>
              <div className="space-y-0.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Building2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{activity.currentTask.project?.name}</span>
                </div>
                {activity.currentTask.sprint && (
                  <div className="flex items-center gap-1">
                    <Target className="h-3 w-3 shrink-0" />
                    <span className="truncate">{activity.currentTask.sprint.name}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">{timerBlock}</div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          Nenhuma tarefa em andamento
        </div>
      )}

      {statsRow()}
    </div>
  )
}

export function SupervisorDashboard() {
  const [activities, setActivities] = useState<CollaboratorActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const { lastEvent, activeTimers, isConnected } = useSocket()

  useEffect(() => {
    fetchActivities()
    const interval = setInterval(fetchActivities, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!lastEvent) return

    setLastUpdate(new Date())
    setActivities((prev) =>
      prev.map((activity) => {
        if (activity.userId !== lastEvent.userId) return activity

        const updatedActivity = { ...activity }

        if (lastEvent.type === 'timer_start') {
          updatedActivity.isActive = true
          updatedActivity.currentTask = {
            id: lastEvent.taskId,
            title: lastEvent.taskTitle,
            status: 'IN_PROGRESS',
            priority: 'MEDIUM',
            project: { id: '', name: lastEvent.projectName },
            sprint: lastEvent.sprintName ? { id: '', name: lastEvent.sprintName } : undefined,
            assignee: { id: lastEvent.userId, name: lastEvent.userName, email: '' },
            timeEntries: [],
          }
          updatedActivity.agendaBlocks = [
            ...(updatedActivity.agendaBlocks ?? []).filter((block) => block.id !== `live-${lastEvent.taskId}`),
            {
              id: `live-${lastEvent.taskId}`,
              startTime: new Date().toISOString(),
              endTime: null,
              durationSeconds: 0,
              taskTitle: lastEvent.taskTitle,
              projectName: lastEvent.projectName || 'Sem projeto',
              isActive: true,
            },
          ]
        } else if (lastEvent.type === 'timer_pause') {
          updatedActivity.isActive = false
          if (updatedActivity.currentTask) {
            updatedActivity.currentTask = { ...updatedActivity.currentTask, status: 'TODO' }
          }
        } else if (lastEvent.type === 'timer_stop') {
          updatedActivity.isActive = false
          updatedActivity.currentTask = undefined
        } else if (lastEvent.type === 'task_complete') {
          updatedActivity.isActive = false
          updatedActivity.currentTask = undefined
          updatedActivity.todayStats.tasksCompleted += 1
          updatedActivity.todayStats.tasksInProgress = Math.max(
            0,
            updatedActivity.todayStats.tasksInProgress - 1
          )
        }

        return updatedActivity
      })
    )
  }, [lastEvent])

  const fetchActivities = async () => {
    try {
      const response = await fetch('/api/supervisor/collaborator-activities')
      if (response.ok) {
        const data = await response.json()
        setActivities(data.activities)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Erro ao carregar atividades:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActiveTimeEntry = (task: ActiveTask) => task.timeEntries.find((entry) => !entry.endTime)

  const calculateCurrentSessionTime = (task: ActiveTask) => {
    const activeTimer = activeTimers.get(task.id)
    if (activeTimer?.isPaused && activeTimer.pausedTime) return activeTimer.pausedTime
    if (activeTimer && activeTimer.duration !== undefined) return activeTimer.duration

    const activeEntry = getActiveTimeEntry(task)
    if (!activeEntry) return 0

    const startTime = new Date(activeEntry.startTime).getTime()
    return Math.floor((Date.now() - startTime) / 1000)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingAnimation size="md" />
      </div>
    )
  }

  const activeCollaborators = activities.filter((a) => a.isActive).length
  const totalTasksInProgress = activities.reduce((sum, a) => sum + a.todayStats.tasksInProgress, 0)
  const totalTasksCompleted = activities.reduce((sum, a) => sum + a.todayStats.tasksCompleted, 0)
  const totalTimeWorked = activities.reduce((sum, a) => sum + a.todayStats.timeWorked, 0)
  const selectedMember = activities.find((a) => a.userId === selectedUserId)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Supervisão</h2>
          <p className="text-sm text-muted-foreground">Acompanhe a equipe em tempo real</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                isConnected ? 'bg-foreground' : 'bg-destructive'
              )}
            />
            <span className="text-muted-foreground">
              {isConnected ? 'Tempo real ativo' : 'Desconectado'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            {format(lastUpdate, 'HH:mm:ss')}
          </div>
          <Button variant="outline" size="sm" onClick={fetchActivities}>
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Colaboradores ativos"
          value={activeCollaborators}
          description={`de ${activities.length} colaboradores`}
        />
        <StatsCard title="Em progresso" value={totalTasksInProgress} description="tarefas agora" />
        <StatsCard title="Concluídas hoje" value={totalTasksCompleted} description="finalizadas" />
        <StatsCard
          title="Tempo total"
          value={formatDuration(totalTimeWorked)}
          description="trabalhado hoje"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 space-y-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Atividade dos colaboradores</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {viewMode === 'grid' ? 'Grade diária' : 'Lista detalhada'} ·{' '}
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-md border border-border p-0.5">
              <Button
                type="button"
                size="sm"
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                className="h-8 px-3"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="mr-1.5 h-4 w-4" />
                Grade
              </Button>
              <Button
                type="button"
                size="sm"
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                className="h-8 px-3"
                onClick={() => setViewMode('list')}
              >
                <List className="mr-1.5 h-4 w-4" />
                Lista
              </Button>
            </div>
            {viewMode === 'grid' && (
              <div className="hidden items-center gap-3 text-xs text-muted-foreground lg:flex">
                {AGENDA_HOURS.map((hour) => (
                  <span key={hour} className="w-6 text-center">
                    {hour}h
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {activities.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
              <p className="text-sm font-medium text-foreground">Nenhuma atividade encontrada</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Não há colaboradores com atividade no momento.
              </p>
            </div>
          ) : (
            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'
                  : 'flex flex-col gap-3'
              )}
            >
              {activities.map((activity) => (
                <div key={activity.userId} className={cn(viewMode === 'grid' && 'space-y-3')}>
                  <CollaboratorAgendaRow
                    activity={activity}
                    activeTimers={activeTimers}
                    calculateCurrentSessionTime={calculateCurrentSessionTime}
                    variant={viewMode}
                    statsOpen={selectedUserId === activity.userId}
                    onToggleStats={
                      viewMode === 'list'
                        ? () =>
                            setSelectedUserId(
                              selectedUserId === activity.userId ? null : activity.userId
                            )
                        : undefined
                    }
                  />
                  {viewMode === 'grid' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        setSelectedUserId(selectedUserId === activity.userId ? null : activity.userId)
                      }
                    >
                      {selectedUserId === activity.userId ? 'Ocultar estatísticas' : 'Ver estatísticas'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedMember && selectedUserId && (
        <CollaboratorStats userId={selectedMember.userId} userName={selectedMember.userName} />
      )}
    </div>
  )
}

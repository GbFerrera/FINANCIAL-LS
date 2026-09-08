'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatsCard } from '@/components/ui/stats-card'
import { PageLoadingGate } from '@/components/ui/loading-animation'
import { useScrumProjectData } from '@/hooks/useScrumProjectData'
import { Users, AlertTriangle } from 'lucide-react'
import { BurndownChart } from './BurndownChart'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

interface ScrumDashboardProps {
  projectId: string
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  TODO: 'A fazer',
  IN_PROGRESS: 'Em andamento',
  IN_REVIEW: 'Em teste',
  COMPLETED: 'Concluído',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'hsl(var(--muted-foreground))',
  TODO: 'oklch(0.55 0.02 286)',
  IN_PROGRESS: 'oklch(0.55 0.18 250)',
  IN_REVIEW: 'oklch(0.65 0.17 85)',
  COMPLETED: 'oklch(0.55 0.15 145)',
}

export function ScrumDashboard({ projectId }: ScrumDashboardProps) {
  const { data, loading, error } = useScrumProjectData(projectId)
  const [selectedSprint, setSelectedSprint] = useState<string | null>(null)

  const activeSprintId =
    selectedSprint ?? data?.sprints.find((s) => s.status === 'ACTIVE')?.id ?? null

  const selectedSprintData = data?.sprints.find((s) => s.id === activeSprintId)

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">Erro ao carregar dados do dashboard</p>
      </div>
    )
  }

  const velocityData =
    data?.sprints
      .filter((s) => s.status === 'COMPLETED')
      .slice(-6)
      .map((sprint) => ({
        name: sprint.name.length > 14 ? `${sprint.name.slice(0, 14)}…` : sprint.name,
        fullName: sprint.name,
        velocity: sprint.tasks
          .filter((t) => t.status === 'COMPLETED')
          .reduce((sum, t) => sum + (t.storyPoints || 0), 0),
        planned: sprint.capacity || 0,
      })) ?? []

  const taskStatusData = Object.entries(
    data?.tasks.reduce(
      (acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    ) ?? {}
  ).map(([status, value]) => ({
    status,
    name: STATUS_LABELS[status] || status,
    value,
    color: STATUS_COLORS[status] || 'oklch(0.55 0.02 286)',
  }))

  const teamProductivityData =
    data?.teamMembers.map((member) => {
      const memberTasks = data.tasks.filter((t) => t.assigneeId === member.id)
      const completedTasks = memberTasks.filter((t) => t.status === 'COMPLETED')
      const completedPoints = completedTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0)
      return {
        id: member.id,
        name: member.name,
        tasks: memberTasks.length,
        completed: completedTasks.length,
        storyPoints: completedPoints,
      }
    }) ?? []

  return (
    <PageLoadingGate loading={loading}>
      {!data ? null : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatsCard title="Sprints ativas" value={data.metrics.activeSprints} />
            <StatsCard
              title="Tarefas concluídas"
              value={`${data.metrics.completedTasks}/${data.metrics.totalTasks}`}
            />
            <StatsCard
              title="Story points"
              value={`${data.metrics.completedStoryPoints}/${data.metrics.totalStoryPoints}`}
            />
            <StatsCard title="Velocidade média" value={`${data.metrics.averageVelocity} SP`} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-sm font-semibold">
                  Velocidade das sprints
                </CardTitle>
              </CardHeader>
              <CardContent>
                {velocityData.length === 0 ? (
                  <EmptyState message="Conclua sprints para ver a velocidade" />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={velocityData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} width={32} />
                        <Tooltip
                          labelFormatter={(_, payload) =>
                            payload?.[0]?.payload?.fullName ?? ''
                          }
                        />
                        <Legend />
                        <Bar dataKey="velocity" name="Realizado" fill="oklch(0.55 0.18 250)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="planned" name="Planejado" fill="oklch(0.85 0.01 286)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-sm font-semibold">
                  Status das tarefas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {taskStatusData.length === 0 ? (
                  <EmptyState message="Sem tarefas para analisar" />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={taskStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {taskStatusData.map((entry, index) => (
                            <Cell key={entry.status || `status-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {selectedSprintData ? (
            <Card className="overflow-hidden rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="font-heading text-sm font-semibold">Burndown</CardTitle>
                <select
                  value={activeSprintId ?? ''}
                  onChange={(e) => setSelectedSprint(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                >
                  {data.sprints
                    .filter((s) => s.status === 'ACTIVE' || s.status === 'COMPLETED')
                    .map((sprint) => (
                      <option key={sprint.id} value={sprint.id}>
                        {sprint.name}
                      </option>
                    ))}
                </select>
              </CardHeader>
              <CardContent>
                <BurndownChart sprint={selectedSprintData} />
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-lg border border-border">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma sprint disponível para análise
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-heading text-sm font-semibold">
                <Users className="h-4 w-4" />
                Produtividade da equipe
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teamProductivityData.length === 0 ? (
                <EmptyState message="Nenhum membro na equipe" />
              ) : (
                <div className="space-y-3">
                  {teamProductivityData.map((member, index) => (
                    <div
                      key={member.id || `team-member-${index}`}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/10 px-4 py-3"
                    >
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-foreground">{member.name}</h4>
                        <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                          <span>{member.tasks} tarefas</span>
                          <span>{member.completed} concluídas</span>
                          <span>{member.storyPoints} SP</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold tabular-nums text-foreground">
                          {member.tasks > 0
                            ? Math.round((member.completed / member.tasks) * 100)
                            : 0}
                          %
                        </div>
                        <div className="text-xs text-muted-foreground">Conclusão</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageLoadingGate>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border bg-muted/10">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

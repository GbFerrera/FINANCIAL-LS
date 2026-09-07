'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowRight,
  FolderGit2,
  LayoutGrid,
  LayoutList,
  LayoutPanelTop,
  Pencil,
  RotateCcw,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WorkspaceCompactCard } from '@/components/workspace/WorkspacePage'
import { WorkspaceHomeCharts } from '@/components/workspace/WorkspaceHomeCharts'
import { WorkspaceMark } from '@/components/workspace/WorkspaceMark'
import { cn } from '@/lib/utils'

export type WorkspaceHomeProject = {
  id: string
  name: string
  status: string
  client: { id: string; name: string }
  total: number
  drafts: number
  inProgress: number
  completed: number
  todo: number
  teamCount: number
  sprintCount: number
}

export type WorkspaceHomeData = {
  slug: string
  name: string
  description: string | null
  icon: string | null
  projectCount: number
  sprintCount: number
  drafts: number
  completed: number
  totalTasks: number
  taskStats: { status: string; count: number }[]
  projects: WorkspaceHomeProject[]
}

const PROJECT_STATUS_LABELS: Record<string, string> = {
  PLANNING: 'Planejamento',
  IN_PROGRESS: 'Em andamento',
  ON_HOLD: 'Pausado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
}

type ViewMode = 'list' | 'grid'

export function WorkspaceHomeView({ data }: { data: WorkspaceHomeData }) {
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const completionRate =
    data.totalTasks > 0 ? Math.round((data.completed / data.totalTasks) * 100) : 0

  return (
    <div className="flex min-h-full w-full flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <WorkspaceMark />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {data.name}
            </h1>
            {data.description ? (
              <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{data.description}</p>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">Visão geral do espaço de trabalho</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="h-8">
            <Link href={`/workspace/${data.slug}/drafts?new=1`}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Rascunhos
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8">
            <Link href={`/workspace/${data.slug}/cycles`}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Sprints
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8">
            <Link href="/pipeline">
              <FolderGit2 className="mr-1.5 h-3.5 w-3.5" />
              Pipeline
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Projetos', value: data.projectCount },
          { label: 'Sprints', value: data.sprintCount },
          { label: 'Tarefas', value: data.totalTasks },
          { label: 'Rascunhos', value: data.drafts },
          { label: 'Conclusão', value: `${completionRate}%` },
        ].map((stat) => (
          <WorkspaceCompactCard key={stat.label} className="px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{stat.value}</p>
          </WorkspaceCompactCard>
        ))}
      </div>

      {/* Charts */}
      <WorkspaceHomeCharts
        totalTasks={data.totalTasks}
        completed={data.completed}
        taskStats={data.taskStats}
        projects={data.projects}
      />

      {/* Projects */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Projetos vinculados</h2>
            <p className="text-xs text-muted-foreground">
              {data.projects.length} {data.projects.length === 1 ? 'projeto' : 'projetos'} neste espaço
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium transition-colors',
                viewMode === 'list'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
              Linha
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium transition-colors',
                viewMode === 'grid'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <LayoutPanelTop className="h-3.5 w-3.5" />
              Grade
            </button>
          </div>
        </div>

        {data.projects.length === 0 ? (
          <WorkspaceCompactCard className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum projeto neste espaço.{' '}
              <Link href="/settings/workspaces" className="font-medium text-foreground underline underline-offset-2">
                Configurar espaço
              </Link>
            </p>
          </WorkspaceCompactCard>
        ) : viewMode === 'list' ? (
          <WorkspaceCompactCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Projeto</th>
                    <th className="px-3 py-2.5 font-medium">Cliente</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Progresso</th>
                    <th className="px-3 py-2.5 text-center font-medium">Rasc.</th>
                    <th className="px-3 py-2.5 text-center font-medium" title="Tarefas em andamento">
                      Andamento
                    </th>
                    <th className="px-3 py-2.5 text-center font-medium">Feito</th>
                    <th className="px-3 py-2.5 text-center font-medium">Time</th>
                    <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.projects.map((project) => {
                    const progress =
                      project.total > 0 ? Math.round((project.completed / project.total) * 100) : 0
                    return (
                      <tr key={project.id} className="transition-colors hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <Link
                            href={`/projects/${project.id}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {project.name}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{project.client.name}</td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium',
                              project.status === 'IN_PROGRESS'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : project.status === 'COMPLETED'
                                  ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : 'border-border bg-muted text-muted-foreground'
                            )}
                          >
                            {PROJECT_STATUS_LABELS[project.status] ?? project.status}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex min-w-[120px] items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                              {progress}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-muted-foreground">
                          {project.drafts}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-muted-foreground">
                          {project.inProgress}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-muted-foreground">
                          {project.completed}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center justify-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {project.teamCount}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                              <Link href={`/projects/${project.id}`}>
                                Abrir
                                <ArrowRight className="ml-1 h-3 w-3" />
                              </Link>
                            </Button>
                            <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <Link href={`/workspace/${data.slug}/projects/${project.id}/items`} title="Itens">
                                <LayoutGrid className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <Link href={`/workspace/${data.slug}/projects/${project.id}/cycles`} title="Sprints">
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </WorkspaceCompactCard>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.projects.map((project) => {
              const progress =
                project.total > 0 ? Math.round((project.completed / project.total) * 100) : 0
              return (
                <WorkspaceCompactCard key={project.id} className="flex flex-col overflow-hidden">
                  <div className="border-b border-border px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/projects/${project.id}`}
                          className="truncate text-sm font-semibold text-foreground hover:underline"
                        >
                          {project.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted-foreground">{project.client.name}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {PROJECT_STATUS_LABELS[project.status] ?? project.status}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 divide-x divide-border border-b border-border text-center">
                    {[
                      { label: 'Total', value: project.total },
                      { label: 'Rasc.', value: project.drafts },
                      { label: 'Andamento', value: project.inProgress },
                      { label: 'Feito', value: project.completed },
                    ].map((s) => (
                      <div key={s.label} className="px-2 py-2.5">
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                        <p className="text-sm font-semibold tabular-nums">{s.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto flex gap-1 px-3 py-2">
                    <Button asChild variant="ghost" size="sm" className="h-7 flex-1 text-xs">
                      <Link href={`/projects/${project.id}`}>Detalhes</Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="h-7 flex-1 text-xs">
                      <Link href={`/workspace/${data.slug}/projects/${project.id}/items`}>Itens</Link>
                    </Button>
                  </div>
                </WorkspaceCompactCard>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

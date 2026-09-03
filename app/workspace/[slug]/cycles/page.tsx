'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { WorkspaceCompactCard, WorkspacePage } from '@/components/workspace/WorkspacePage'

import { LoadingAnimation, LoadingInline, LoadingScreen, PageLoadingGate } from '@/components/ui/loading-animation'
type SprintRow = {
  id: string
  name: string
  status: string
  startDate: string
  endDate: string
  goal?: string | null
  projects: Array<{ project: { id: string; name: string }; projectId?: string }>
  tasks: Array<{ id: string; status: string; storyPoints?: number | null }>
}

const statusLabel: Record<string, string> = {
  PLANNING: 'Planejamento',
  ACTIVE: 'Ativa',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
}

export default function WorkspaceCyclesPage() {
  const params = useParams()
  const slug = String(params.slug)
  const [sprints, setSprints] = useState<SprintRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/workspaces/${slug}/cycles`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setSprints(data?.sprints || []))
      .finally(() => setLoading(false))
  }, [slug])

  return (
    <PageLoadingGate loading={loading}>
    <WorkspacePage size="narrow" className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Ciclos</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Sprints dos projetos deste espaço de trabalho</p>
      </div>

      {sprints.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum ciclo encontrado neste espaço.</p>
      ) : (
        <div className="space-y-2">
          {sprints.map((sprint) => {
            const totalSp = sprint.tasks.reduce((a, t) => a + (t.storyPoints || 0), 0)
            const doneSp = sprint.tasks
              .filter((t) => t.status === 'COMPLETED')
              .reduce((a, t) => a + (t.storyPoints || 0), 0)
            const projectId = sprint.projects[0]?.project.id
            return (
              <WorkspaceCompactCard key={sprint.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-medium text-foreground">{sprint.name}</h2>
                      <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                        {statusLabel[sprint.status] || sprint.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(sprint.startDate), 'dd/MM/yyyy', { locale: ptBR })} —{' '}
                      {format(new Date(sprint.endDate), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                    {sprint.goal && <p className="text-sm text-muted-foreground">{sprint.goal}</p>}
                    <p className="text-xs text-muted-foreground">
                      {sprint.projects.map((p) => p.project.name).join(', ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-sm">
                    <span className="text-muted-foreground">
                      {doneSp}/{totalSp} SP
                    </span>
                    {projectId && (
                      <Link
                        href={`/projects/${projectId}/scrum?sprint=${sprint.id}`}
                        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        Abrir quadro
                      </Link>
                    )}
                  </div>
                </div>
              </WorkspaceCompactCard>
            )
          })}
        </div>
      )}
    </WorkspacePage>
    </PageLoadingGate>
  )
}

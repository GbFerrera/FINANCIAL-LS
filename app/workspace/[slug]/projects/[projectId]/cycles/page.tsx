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
  projects: Array<{ projectId?: string; project?: { id: string } }>
}

export default function ProjectCyclesPage() {
  const params = useParams()
  const slug = String(params.slug)
  const projectId = String(params.projectId)
  const [sprints, setSprints] = useState<SprintRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/workspaces/${slug}/cycles`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const all = (data?.sprints || []) as SprintRow[]
        setSprints(
          all.filter((s) =>
            s.projects.some(
              (p) => (p.projectId || p.project?.id) === projectId
            )
          )
        )
      })
      .finally(() => setLoading(false))
  }, [slug, projectId])

  return (
    <PageLoadingGate loading={loading}>
    <WorkspacePage size="narrow" className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Ciclos do projeto</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Sprints vinculadas a este projeto</p>
      </div>

      {sprints.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum ciclo para este projeto.</p>
      ) : (
        <div className="space-y-2">
          {sprints.map((sprint) => (
            <WorkspaceCompactCard key={sprint.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{sprint.name}</span>
                  <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[11px]">
                    {sprint.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(sprint.startDate), 'dd/MM/yyyy', { locale: ptBR })} —{' '}
                  {format(new Date(sprint.endDate), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
              <Link
                href={`/projects/${projectId}/scrum?sprint=${sprint.id}`}
                className="shrink-0 text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                Abrir
              </Link>
            </WorkspaceCompactCard>
          ))}
        </div>
      )}
    </WorkspacePage>
    </PageLoadingGate>
  )
}

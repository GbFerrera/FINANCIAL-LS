'use client'

import { useEffect, useMemo, useState } from 'react'
import { PipelineView } from '@/components/pipeline/PipelineView'
import { LoadingAnimation } from '@/components/ui/loading-animation'
import type { WorkspaceDTO } from '@/lib/workspace-utils'

export function WorkspacePipelineView({ slug }: { slug: string }) {
  const [workspace, setWorkspace] = useState<WorkspaceDTO | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/workspaces/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setWorkspace(data)
      })
      .catch(() => {
        if (!cancelled) setWorkspace(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const projects = useMemo(
    () =>
      (workspace?.projects ?? []).map(({ project }) => ({
        id: project.id,
        name: project.name,
      })),
    [workspace]
  )

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center">
        <LoadingAnimation size="md" />
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center px-6 text-sm text-muted-foreground">
        Espaço de trabalho não encontrado.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <PipelineView
        basePath={`/workspace/${slug}/pipeline`}
        scopedProjectIds={workspace.projectIds}
        initialProjects={projects}
        contextLabel={workspace.name}
      />
    </div>
  )
}

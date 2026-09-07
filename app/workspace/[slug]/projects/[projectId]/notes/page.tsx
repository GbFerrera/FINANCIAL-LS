'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ProjectNotesView } from '@/components/notes/ProjectNotesView'
import { LoadingAnimation } from '@/components/ui/loading-animation'

export default function WorkspaceProjectNotesPage() {
  const params = useParams()
  const projectId = String(params.projectId)
  const workspaceSlug = String(params.slug)
  const [projectName, setProjectName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/projects/${projectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.name) setProjectName(data.name)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingAnimation size="md" />
      </div>
    )
  }

  return (
    <ProjectNotesView
      variant="workspace"
      lockedProjectId={projectId}
      projectName={projectName || 'Projeto'}
      workspaceSlug={workspaceSlug}
    />
  )
}

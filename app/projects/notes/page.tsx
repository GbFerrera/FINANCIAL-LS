'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ProjectNotesView } from '@/components/notes/ProjectNotesView'
import { LoadingAnimation } from '@/components/ui/loading-animation'

function NotesPageContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams?.get('projectId')

  return <ProjectNotesView initialProjectId={projectId} />
}

export default function NotesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <LoadingAnimation size="md" />
        </div>
      }
    >
      <NotesPageContent />
    </Suspense>
  )
}

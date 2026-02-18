'use client'

import { use } from 'react'
import { SprintView } from '@/components/collaborator/SprintView'

interface PageProps {
  params: Promise<{
    token: string
  }>
}

export default function CollaboratorSprintsPage({ params }: PageProps) {
  const { token } = use(params)

  return (
    <div className="min-h-screen bg-card">
      <div className="container mx-auto px-4 py-8">
        <SprintView token={token} />
      </div>
    </div>
  )
}

import { Suspense } from 'react'
import { WorkspaceDraftsView } from '@/components/workspace/WorkspaceDraftsView'

type Props = { params: Promise<{ slug: string }> }

function DraftsFallback() {
  return (
    <div className="py-8 text-sm text-muted-foreground">Carregando rascunhos...</div>
  )
}

export default async function WorkspaceDraftsPage({ params }: Props) {
  const { slug } = await params
  return (
    <Suspense fallback={<DraftsFallback />}>
      <WorkspaceDraftsView slug={slug} />
    </Suspense>
  )
}

import { Suspense } from 'react'
import { WorkspacePipelineView } from '@/components/workspace/WorkspacePipelineView'

type Props = { params: Promise<{ slug: string }> }

function PipelineFallback() {
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center py-8 text-sm text-muted-foreground">
      Carregando pipeline...
    </div>
  )
}

export default async function WorkspacePipelinePage({ params }: Props) {
  const { slug } = await params
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Suspense fallback={<PipelineFallback />}>
        <WorkspacePipelineView slug={slug} />
      </Suspense>
    </div>
  )
}

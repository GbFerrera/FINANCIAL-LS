"use client"

import { Suspense } from "react"
import { PipelineView } from "@/components/pipeline/PipelineView"
import { LoadingAnimation } from '@/components/ui/loading-animation'

export default function PipelinePage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Suspense
        fallback={
          <div className="flex h-full min-h-0 flex-1 items-center justify-center">
            <LoadingAnimation size="md" />
          </div>
        }
      >
        <PipelineView />
      </Suspense>
    </div>
  )
}

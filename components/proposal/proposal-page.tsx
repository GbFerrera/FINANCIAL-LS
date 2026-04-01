"use client"

import { useEffect, useMemo, useState } from "react"
import type { ProposalStepId, Proposal } from "@/components/proposal/proposal-mock"
import { ProposalHeader } from "@/components/proposal/proposal-header"
import { ProposalSidebar, proposalSteps } from "@/components/proposal/proposal-sidebar"
import { ProposalDrawers } from "@/components/proposal/proposal-drawers"
import { ProposalFinalSummary } from "@/components/proposal/proposal-final-summary"
import { ProposalOverview } from "@/components/proposal/proposal-overview"
import { stepAnchor } from "@/components/proposal/proposal-utils"

function useHashStep(steps: { id: ProposalStepId }[], openStep: (id: ProposalStepId) => void) {
  useEffect(() => {
    const byAnchor = new Map(steps.map(s => [stepAnchor(s.id), s.id] as const))

    const applyHash = () => {
      const raw = window.location.hash
      const anchor = raw.startsWith("#") ? raw.slice(1) : raw
      const stepId = byAnchor.get(anchor)
      if (stepId) openStep(stepId)
    }

    applyHash()
    window.addEventListener("hashchange", applyHash)
    return () => window.removeEventListener("hashchange", applyHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps])
}

export function ProposalPage({ proposal }: { proposal: Proposal }) {
  const steps = useMemo(() => proposalSteps, [])

  const [openIds, setOpenIds] = useState<Set<ProposalStepId>>(
    () => new Set<ProposalStepId>([steps[0]?.id ?? "escopo-modulos"])
  )

  const toggle = (id: ProposalStepId) => {
    setOpenIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openStep = (id: ProposalStepId) => {
    setOpenIds(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  useHashStep(steps, openStep)

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-6xl md:px-4 md:py-8 lg:py-10">
        <div className="md:rounded-[28px] bg-white md:shadow-[0_30px_80px_rgba(15,37,69,0.12)] md:ring-1 md:ring-slate-200/70 overflow-hidden">
          <ProposalHeader proposal={proposal} />

          <div className="px-4 sm:px-6 pb-8 pt-6">
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-8 space-y-4">
                <ProposalOverview proposal={proposal} />
                <ProposalDrawers proposal={proposal} steps={steps} openIds={openIds} onToggle={toggle} />
                <ProposalFinalSummary proposal={proposal} />
              </div>

              <div className="col-span-12 lg:col-span-4">
                <ProposalSidebar proposal={proposal} steps={steps} openIds={openIds} onOpenStep={openStep} />
              </div>
            </div>

            <div className="mt-10">
              <div className="h-14 bg-[#0f2545] rounded-tr-[24px] rounded-tl-[72px] overflow-hidden">
                <div className="h-1.5 w-40 bg-[#c79b6b]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

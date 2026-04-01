import { FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Proposal } from "@/components/proposal/proposal-mock"

export function ProposalOverview({ proposal }: { proposal: Proposal }) {
  return (
    <Card className="py-0 bg-white border-slate-200/70 text-black">
      <CardHeader className="border-b border-slate-200/70 py-5">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="size-4 text-slate-500" />
          Visão geral
        </CardTitle>
      </CardHeader>
      <CardContent className="py-5">
        <p className="text-sm text-slate-900 leading-relaxed">{proposal.objective}</p>
      </CardContent>
    </Card>
  )
}

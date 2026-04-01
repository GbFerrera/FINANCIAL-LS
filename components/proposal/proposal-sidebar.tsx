import { BadgeCheck, BookOpen, ChevronRight, Cpu, HandCoins, Ban, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Proposal, ProposalStepId } from "@/components/proposal/proposal-mock"
import { formatBRL, stepAnchor } from "@/components/proposal/proposal-utils"
import Link from "next/link"

export type ProposalStepDef = {
  id: ProposalStepId
  title: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export const proposalSteps: ProposalStepDef[] = [
  { id: "escopo-modulos", title: "Escopo e Módulos", label: "Etapa 1", icon: BookOpen },
  { id: "nao-entregaveis", title: "Não Entregáveis e Ajustes", label: "Etapa 2", icon: Ban },
  { id: "sprints-entregaveis", title: "Sprints e Entregáveis", label: "Etapa 3", icon: BadgeCheck },
  { id: "stack-propriedade", title: "Stack e Propriedade", label: "Etapa 4", icon: Cpu },
  { id: "suporte-financeiro", title: "Financeiro e Termos Jurídicos", label: "Etapa 5", icon: HandCoins },
]

export function ProposalSidebar({
  proposal,
  steps,
  openIds,
  onOpenStep,
}: {
  proposal: Proposal
  steps: ProposalStepDef[]
  openIds: Set<ProposalStepId>
  onOpenStep: (id: ProposalStepId) => void
}) {
  return (
    <div className="space-y-6 lg:sticky lg:top-6">
      <Card className="py-0 bg-white border-slate-200/70">
        <CardHeader className="border-b border-slate-200/70 py-5">
          <CardTitle className="text-base uppercase tracking-widest text-slate-800">
            Resumo rápido
          </CardTitle>
        </CardHeader>
        <CardContent className="py-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-slate-500">Valor total</div>
            <div className="text-base font-semibold text-slate-900">
              {formatBRL(proposal.financial.total)}
            </div>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="text-sm text-slate-500">Pagamento</div>
            <div className="text-sm text-slate-900 text-right leading-snug">
              {proposal.financial.paymentSummary}
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-slate-500">Duração estimada</div>
            <div className="text-sm font-medium text-slate-900">
              {proposal.sprints.length} sprints
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-slate-500">Validade</div>
            <div className="text-sm font-medium text-slate-900">
              até {proposal.validUntilLabel}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="py-0 bg-white border-slate-200/70">
        <CardHeader className="border-b border-slate-200/70 py-5">
          <CardTitle className="text-base uppercase tracking-widest text-slate-800">
            Atalhos
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <div className="space-y-2">
            {steps.map(step => {
              const Icon = step.icon
              const isOpen = openIds.has(step.id)
              return (
                <Button
                  key={step.id}
                  variant={isOpen ? "secondary" : "ghost"}
                  className="w-full justify-start border border-transparent hover:border-slate-200 hover:bg-[#f7f3ea] text-slate-900"
                  onClick={() => {
                    onOpenStep(step.id)
                    const el = document.getElementById(stepAnchor(step.id))
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
                    window.history.replaceState(null, "", `#${stepAnchor(step.id)}`)
                  }}
                >
                  <Icon className="size-4" />
                  <span className="truncate flex-1">{step.title}</span>
                  <ChevronRight className="size-4 text-slate-400" />
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>
      <Card className="py-0 bg-white border-slate-200/70">
        <CardHeader className="border-b border-slate-200/70 py-5">
          <CardTitle className="text-base uppercase tracking-widest text-slate-800">
            Ações
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <Button asChild className="w-full bg-[#0f2545] hover:bg-[#0f2545]/90 text-white">
            <Link href={`/proposta/pdf?code=${proposal.id}`} target="_blank">
              <FileText className="mr-2 size-4" />
              Gerar PDF do Contrato
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

import type { Metadata } from "next"
import { ProposalPage } from "@/components/proposal/proposal-page"
import { prisma } from "@/lib/prisma"
import { proposalMock, type Proposal } from "@/components/proposal/proposal-mock"

export const metadata: Metadata = {
  title: "Proposta / Contrato",
  description:
    "Proposta comercial em formato de contrato com escopo, não entregáveis, sprints/entregáveis, stack/propriedade e suporte/financeiro.",
}

function toUiProposal(db: any): Proposal {
  const data = (db?.data as any) || {}
  return {
    id: db.code,
    title: db.title,
    clientName: db.client?.name || "",
    projectName: db.project?.name || "",
    issuedAtLabel: db.issuedAt ? new Date(db.issuedAt).toLocaleDateString("pt-BR") : "",
    validUntilLabel: db.validUntil ? new Date(db.validUntil).toLocaleDateString("pt-BR") : "",
    objective: data.objective || proposalMock.objective,
    scopeModules: data.scopeModules || proposalMock.scopeModules,
    nonDeliverables: data.nonDeliverables || proposalMock.nonDeliverables,
    sprints: data.sprints || proposalMock.sprints,
    stack: data.stack || proposalMock.stack,
    ownershipTerms: data.ownershipTerms || proposalMock.ownershipTerms,
    supportTerms: data.supportTerms || proposalMock.supportTerms,
    penaltyTerms: data.penaltyTerms || proposalMock.penaltyTerms,
    financial: data.financial || proposalMock.financial,
  }
}

export default async function Page({ searchParams }: { searchParams?: Record<string, string | undefined> }) {
  const code = searchParams?.code
  if (!code) {
    return <ProposalPage proposal={proposalMock} />
  }
  const db = await prisma.proposal.findUnique({
    where: { code },
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } }
    }
  })
  const ui = db ? toUiProposal(db) : proposalMock
  return <ProposalPage proposal={ui} />
}

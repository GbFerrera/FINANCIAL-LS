import type { Metadata } from "next"
import { ProposalPdfPage } from "@/components/proposal/proposal-pdf-page"
import { prisma } from "@/lib/prisma"
import { proposalMock, type Proposal } from "@/components/proposal/proposal-mock"

export const metadata: Metadata = {
  title: "Contrato em PDF",
  description: "Versão para impressão do contrato.",
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

export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const params = await searchParams
  const code = params.code

  if (!code) {
    return <ProposalPdfPage proposal={proposalMock} />
  }
  const db = await prisma.proposal.findUnique({
    where: { code },
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } }
    }
  })
  const ui = db ? toUiProposal(db) : proposalMock
  return <ProposalPdfPage proposal={ui} />
}

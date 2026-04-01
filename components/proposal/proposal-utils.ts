import type { ProposalStepId } from "@/components/proposal/proposal-mock"

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value)
}

export function stepAnchor(id: ProposalStepId) {
  return `etapa-${id}`
}


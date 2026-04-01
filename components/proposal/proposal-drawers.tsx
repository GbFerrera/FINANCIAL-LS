import { BadgeCheck, Ban, HandCoins, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Proposal, ProposalStepId } from "@/components/proposal/proposal-mock"
import type { ProposalStepDef } from "@/components/proposal/proposal-sidebar"
import { ProposalDrawerItem } from "@/components/proposal/proposal-drawer-item"
import { formatBRL } from "@/components/proposal/proposal-utils"

function ScopeModulesSection({ proposal }: { proposal: Proposal }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500">
          O quê será entregue
        </div>
        <p className="mt-2 text-sm text-slate-900 leading-relaxed">
          Escopo e módulos definem a visão geral + o detalhamento técnico do que entra nesta proposta.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {proposal.scopeModules.map(m => (
          <div
            key={m.title}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">{m.title}</div>
              <Badge variant="secondary" className="h-5 px-2 text-[11px]">
                Incluído
              </Badge>
            </div>
            <div className="mt-1 text-sm text-slate-500 leading-relaxed">{m.description}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function NonDeliverablesSection({ proposal }: { proposal: Proposal }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500">As regras</div>
        <p className="mt-2 text-sm text-slate-900 leading-relaxed">
          Para evitar ambiguidade: eu faço X, mas não faço Y. Se precisar de Y, vira ajuste com nova estimativa.
        </p>
      </div>
      <ul className="space-y-2">
        {proposal.nonDeliverables.map(item => (
          <li key={item} className="flex items-start gap-2 text-sm">
            <Ban className="mt-0.5 size-4 text-slate-500" />
            <span className="text-slate-900 leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SprintsSection({ proposal }: { proposal: Proposal }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500">
          Como e quando
        </div>
        <p className="mt-2 text-sm text-slate-900 leading-relaxed">
          Você recebe partes do software aos poucos. Cada sprint tem foco e entregáveis claros.
        </p>
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sprint</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Objetivo</TableHead>
              <TableHead>Entregáveis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proposal.sprints.map(s => (
              <TableRow key={s.name}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.durationLabel}</TableCell>
                <TableCell className="max-w-[280px]">
                  <div className="text-sm text-slate-700 leading-relaxed">{s.goal}</div>
                </TableCell>
                <TableCell className="max-w-[340px]">
                  <div className="flex flex-wrap gap-2 min-w-0">
                    {s.deliverables.map(d => (
                      <Badge
                        key={d}
                        variant="secondary"
                        className="h-auto min-h-6 max-w-full shrink justify-start items-start rounded-full bg-[#0f2545] px-3 py-1 text-[11px] font-medium leading-snug text-white whitespace-normal break-words"
                      >
                        {d}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden grid gap-3">
        {proposal.sprints.map(s => (
          <div key={s.name} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">{s.name}</div>
              <Badge variant="secondary" className="h-6">
                {s.durationLabel}
              </Badge>
            </div>
            <div className="mt-2 text-sm text-slate-900 leading-relaxed">{s.goal}</div>
            <div className="mt-3 flex flex-wrap gap-2 min-w-0">
              {s.deliverables.map(d => (
                <Badge
                  key={d}
                  variant="secondary"
                  className="h-auto min-h-6 max-w-full shrink justify-start items-start rounded-full bg-[#0f2545] px-3 py-1 text-[11px] font-medium leading-snug text-white whitespace-normal break-words"
                >
                  {d}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StackOwnershipSection({ proposal }: { proposal: Proposal }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500">
          Segurança técnica e ética
        </div>
        <p className="mt-2 text-sm text-slate-900 leading-relaxed">
          Stack e propriedade deixam claro como será construído e como fica o que é produzido.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {proposal.stack.map(item => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs uppercase tracking-widest text-slate-500">{item.label}</div>
            <div className="mt-1 text-sm font-medium leading-relaxed">{item.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-slate-500" />
          <div className="font-semibold">Propriedade</div>
        </div>
        <ul className="mt-3 space-y-2">
          {proposal.ownershipTerms.map(t => (
            <li key={t} className="text-sm text-slate-900 leading-relaxed">
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function SupportFinancialSection({ proposal }: { proposal: Proposal }) {
  return (
    <div className="space-y-4">
      {/* 1. Cronograma de Pagamentos */}
      <div className="rounded-xl border border-slate-200 bg-[#f7f3ea] p-4">
        <div className="flex items-center gap-2">
          <HandCoins className="size-4 text-slate-500" />
          <div className="font-semibold">Cronograma de Pagamentos</div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="text-sm text-slate-600">Total</div>
          <div className="text-base font-semibold text-slate-900">
            {formatBRL(proposal.financial.total)}
          </div>
        </div>
        <div className="mt-2 text-sm text-slate-900 leading-relaxed">
          {proposal.financial.paymentSummary}
        </div>

        {proposal.financial.paymentMethods?.length ? (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-widest text-slate-600">
              Opções de pagamento
            </div>
            <ul className="mt-2 space-y-1">
              {proposal.financial.paymentMethods.map(method => (
                <li key={method} className="text-sm text-slate-700 leading-relaxed">
                  {method}
                </li>
              ))}
            </ul>

            {proposal.financial.cardOption ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white/60 px-3 py-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-medium text-slate-800">Cartão</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {formatBRL(proposal.financial.cardOption.total)}
                  </div>
                </div>
                <div className="mt-1 text-sm text-slate-700 leading-relaxed">
                  Até {proposal.financial.cardOption.maxInstallments}x de{" "}
                  {formatBRL(proposal.financial.cardOption.installmentAmount)} (taxa {proposal.financial.cardOption.feePercent}%)
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marco</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposal.financial.schedule.map(i => (
                <TableRow key={i.label}>
                  <TableCell>
                    <div className="font-medium">{i.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{i.dueLabel}</div>
                  </TableCell>
                  <TableCell className="text-right">{i.percent}%</TableCell>
                  <TableCell className="text-right">{formatBRL(i.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <ul className="mt-3 space-y-1.5">
          {proposal.financial.notes.map(n => (
            <li key={n} className="text-xs text-slate-500 leading-relaxed">
              {n}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 2. Cláusulas de Rescisão e Multas */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Ban className="size-4 text-slate-500" />
            <div className="font-semibold">Cláusulas de Rescisão e Multas</div>
          </div>
          <ul className="mt-3 space-y-2">
            {proposal.penaltyTerms?.map(t => (
              <li key={t} className="text-sm text-slate-900 leading-relaxed">
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* 3. Garantia e Suporte Pós-Entrega */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <BadgeCheck className="size-4 text-slate-500" />
            <div className="font-semibold">Garantia e Suporte Pós-Entrega</div>
          </div>
          <ul className="mt-3 space-y-2">
            {proposal.supportTerms.map(t => (
              <li key={t} className="text-sm text-slate-900 leading-relaxed">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function contentFor(stepId: ProposalStepId, proposal: Proposal) {
  switch (stepId) {
    case "escopo-modulos":
      return <ScopeModulesSection proposal={proposal} />
    case "nao-entregaveis":
      return <NonDeliverablesSection proposal={proposal} />
    case "sprints-entregaveis":
      return <SprintsSection proposal={proposal} />
    case "stack-propriedade":
      return <StackOwnershipSection proposal={proposal} />
    case "suporte-financeiro":
      return <SupportFinancialSection proposal={proposal} />
  }
}

export function ProposalDrawers({
  proposal,
  steps,
  openIds,
  onToggle,
}: {
  proposal: Proposal
  steps: ProposalStepDef[]
  openIds: Set<ProposalStepId>
  onToggle: (id: ProposalStepId) => void
}) {
  return (
    <div className="space-y-3">
      {steps.map(step => (
        <ProposalDrawerItem
          key={step.id}
          step={step}
          open={openIds.has(step.id)}
          onToggle={() => onToggle(step.id)}
        >
          {contentFor(step.id, proposal)}
        </ProposalDrawerItem>
      ))}
    </div>
  )
}

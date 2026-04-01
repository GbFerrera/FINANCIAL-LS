import { ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Proposal } from "@/components/proposal/proposal-mock"
import { formatBRL } from "@/components/proposal/proposal-utils"

export function ProposalFinalSummary({ proposal }: { proposal: Proposal }) {
  return (
    <Card className="py-0 bg-white border-slate-200/70">
      <CardHeader className="border-b border-slate-200/70 py-5">
        <CardTitle className="text-black">Resumo final</CardTitle>
      </CardHeader>
      <CardContent className="py-5">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500">
              Resumo dos termos
            </div>
            <ul className="mt-3 space-y-2">
              <li className="text-sm text-slate-700 leading-relaxed">
                Entregas por etapas (sprints) com validação contínua.
              </li>
              <li className="text-sm text-slate-700 leading-relaxed">
                Itens fora do escopo ficam explícitos (evita surpresas).
              </li>
              <li className="text-sm text-slate-700 leading-relaxed">
                Propriedade do código sob encomenda ao final, mediante quitação.
              </li>
              <li className="text-sm text-slate-700 leading-relaxed">
                Suporte de 30 dias para correções de bugs do que foi entregue.
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-[#f7f3ea] p-4">
            <div className="text-xs uppercase tracking-widest text-slate-600">
              Resumo financeiro
            </div>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div className="text-sm text-slate-600">Total</div>
              <div className="text-xl font-semibold text-slate-900">
                {formatBRL(proposal.financial.total)}
              </div>
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


            <div className="mt-2 text-sm text-slate-900 leading-relaxed">
              {proposal.financial.paymentSummary}
            </div>

          
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

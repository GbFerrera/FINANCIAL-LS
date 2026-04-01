"use client"

import Image from "next/image"
import type { Proposal } from "@/components/proposal/proposal-mock"
import { formatBRL } from "@/components/proposal/proposal-utils"

export function ProposalPdfPage({ proposal }: { proposal: Proposal }) {
  return (
    <div id="pdf-content" className="bg-white text-black p-8 sm:p-12 md:p-16 print:p-0 font-sans relative">
      {/* PRINT BUTTON - HIDDEN ON PRINT */}
      <div className="fixed top-4 right-4 print:hidden z-50">
        <button 
          onClick={() => window.print()}
          className="bg-[#0f2545] text-white px-4 py-2 rounded-lg text-sm font-sans font-medium hover:bg-[#0f2545]/90 transition-colors shadow-lg flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Imprimir / Salvar PDF
        </button>
      </div>

      {/* HEADER VISUAL (Like Site) */}
      <div id="pdf-header" className="relative bg-[#0f2545] text-white mb-3 overflow-hidden rounded-2xl print:rounded-none print:bg-[#0f2545] print:text-white print:break-inside-avoid">
        <div
          className="absolute right-0 top-0 h-full w-[190px] md:w-[240px] bg-[#c79b6b] print:bg-[#c79b6b]"
          style={{ clipPath: "polygon(22% 0, 100% 0, 100% 100%, 0 100%)", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
        />
        
        <div className="relative px-4 sm:px-6 py-2 flex items-center justify-between gap-6 z-10">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-white/10 overflow-hidden print:bg-white/10" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
              <Image
                src="/logo-branca.png"
                alt="Logo"
                width={22}
                height={22}
                className="object-contain"
              />
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.22em] text-white/70 print:text-white/70 leading-tight">Link System</div>
              <div className="text-[11px] font-semibold leading-tight">{proposal.id}</div>
            </div>
          </div>

          <div className="text-[#0f2545]">
            <div className="grid gap-0 text-[9px] font-medium leading-tight">
              <div className="flex items-center gap-2 justify-end">
                <span>(00) 0000-0000 • seuemail@email.com • www.seusite.com.br</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TÍTULO E INFOS DO PROJETO */}
      <div className="border-b border-slate-200 pb-3 mb-4 print:break-inside-avoid">
        <div className="text-center mb-2">
          <div className="inline-block rounded-md border border-slate-300 px-3 py-1" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-800">
              {proposal.title}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-slate-700">
          <span><span className="text-slate-500 uppercase tracking-widest text-[9px]">Cliente:</span> {proposal.clientName}</span>
          <span className="text-slate-300">•</span>
          <span><span className="text-slate-500 uppercase tracking-widest text-[9px]">Projeto:</span> {proposal.projectName}</span>
          <span className="text-slate-300">•</span>
          <span><span className="text-slate-500 uppercase tracking-widest text-[9px]">Emissão:</span> {proposal.issuedAtLabel}</span>
          <span className="text-slate-300">•</span>
          <span><span className="text-slate-500 uppercase tracking-widest text-[9px]">Validade:</span> {proposal.validUntilLabel}</span>
        </div>
      </div>

      <div className="space-y-12">
        {/* OBJETIVO */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#0f2545] text-white font-bold text-sm" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>1</div>
            <h2 className="text-xl font-bold uppercase tracking-wide text-[#0f2545]">Objetivo</h2>
          </div>
          <div className="pl-11">
            <p className="text-base leading-relaxed text-justify text-slate-700">
              {proposal.objective}
            </p>
          </div>
        </section>

        {/* ESCOPO E MÓDULOS */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#0f2545] text-white font-bold text-sm" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>2</div>
            <h2 className="text-xl font-bold uppercase tracking-wide text-[#0f2545]">Escopo e Módulos</h2>
          </div>
          <div className="pl-11 grid gap-4 sm:grid-cols-2">
            {proposal.scopeModules.map((m, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 p-5 bg-white page-break-inside-avoid" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
                <h3 className="font-bold text-slate-900 mb-2">{m.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  {m.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* NÃO ENTREGÁVEIS */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#0f2545] text-white font-bold text-sm" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>3</div>
            <h2 className="text-xl font-bold uppercase tracking-wide text-[#0f2545]">Não Entregáveis (Regras)</h2>
          </div>
          <div className="pl-11">
            <p className="mb-4 text-sm text-slate-600">Para evitar ambiguidade, os itens abaixo não estão inclusos no escopo:</p>
            <ul className="space-y-3">
              {proposal.nonDeliverables.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-slate-700">
                  <div className="mt-1 flex-shrink-0 size-1.5 rounded-full bg-red-400" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }} />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* SPRINTS E ENTREGÁVEIS */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#0f2545] text-white font-bold text-sm" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>4</div>
            <h2 className="text-xl font-bold uppercase tracking-wide text-[#0f2545]">Sprints e Entregáveis</h2>
          </div>
          <div className="pl-11 space-y-6">
            {proposal.sprints.map((s, idx) => (
              <div key={idx} className="border-l-2 border-[#c79b6b] pl-5 py-1 page-break-inside-avoid">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-lg text-slate-900">{s.name}</h3>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-xs font-medium text-slate-600 border border-slate-200" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
                    {s.durationLabel}
                  </span>
                </div>
                <p className="mb-3 text-sm text-slate-600 font-medium">Objetivo: {s.goal}</p>
                <div className="flex flex-wrap gap-2">
                  {s.deliverables.map((d, i) => (
                    <span key={i} className="px-3 py-1 rounded-full bg-[#0f2545] text-[11px] font-medium text-white" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* STACK E PROPRIEDADE */}
        <section className="page-break-inside-avoid">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#0f2545] text-white font-bold text-sm" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>5</div>
            <h2 className="text-xl font-bold uppercase tracking-wide text-[#0f2545]">Stack Tecnológica e Propriedade</h2>
          </div>
          <div className="pl-11 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="font-semibold text-sm uppercase tracking-widest text-slate-500 mb-4">Tecnologias</h3>
              <div className="space-y-3">
                {proposal.stack.map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 px-4 py-3 bg-white" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
                    <div className="text-[11px] uppercase tracking-widest text-slate-500">{item.label}</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-sm uppercase tracking-widest text-slate-500 mb-4">Propriedade</h3>
              <div className="rounded-xl border border-slate-200 p-5 bg-white h-full" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
                <ul className="space-y-3">
                  {proposal.ownershipTerms.map((t, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-700">
                      <div className="mt-1.5 flex-shrink-0 size-1.5 rounded-full bg-[#c79b6b]" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }} />
                      <span className="leading-relaxed">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FINANCEIRO E TERMOS JURÍDICOS */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#0f2545] text-white font-bold text-sm" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>6</div>
            <h2 className="text-xl font-bold uppercase tracking-wide text-[#0f2545]">Financeiro e Termos Jurídicos</h2>
          </div>
          
          <div className="pl-11 space-y-6">
            {/* Bloco Financeiro */}
            <div className="rounded-xl border border-[#c79b6b]/30 bg-[#fefcf8] p-6 print:border-[#c79b6b] print:bg-[#fefcf8] page-break-inside-avoid" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 mb-1">Resumo Financeiro</h3>
                  <p className="text-sm text-slate-600">{proposal.financial.paymentSummary}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-500 mb-1">Valor Total</div>
                  <div className="text-2xl font-bold text-[#0f2545]">{formatBRL(proposal.financial.total)}</div>
                </div>
              </div>

              <table className="w-full text-left border-collapse mb-6">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="py-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Marco / Condição</th>
                    <th className="py-3 text-sm font-semibold text-slate-600 uppercase tracking-wider text-right">%</th>
                    <th className="py-3 text-sm font-semibold text-slate-600 uppercase tracking-wider text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 print:divide-slate-200">
                  {proposal.financial.schedule.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-3">
                        <div className="font-medium text-slate-900">{item.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{item.dueLabel}</div>
                      </td>
                      <td className="py-3 text-right font-medium text-slate-700">{item.percent}%</td>
                      <td className="py-3 text-right font-semibold text-slate-900">{formatBRL(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {proposal.financial.paymentMethods && (
                <div className="border-t border-slate-200 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Métodos de Pagamento</p>
                  <div className="flex flex-wrap gap-2">
                    {proposal.financial.paymentMethods.map((m, idx) => (
                      <span key={idx} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-5 bg-white page-break-inside-avoid" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
                <h3 className="font-semibold text-sm uppercase tracking-widest text-slate-500 mb-4">Rescisão e Multas</h3>
                <ul className="space-y-3">
                  {proposal.penaltyTerms?.map((t, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-700">
                      <div className="mt-1.5 flex-shrink-0 size-1.5 rounded-full bg-red-400" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }} />
                      <span className="leading-relaxed">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-slate-200 p-5 bg-white page-break-inside-avoid" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
                <h3 className="font-semibold text-sm uppercase tracking-widest text-slate-500 mb-4">Garantia e Suporte</h3>
                <ul className="space-y-3">
                  {proposal.supportTerms.map((t, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-700">
                      <div className="mt-1.5 flex-shrink-0 size-1.5 rounded-full bg-emerald-500" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }} />
                      <span className="leading-relaxed">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {proposal.financial.notes.length > 0 && (
              <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 print:border-slate-200 page-break-inside-avoid" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Observações</p>
                <ul className="space-y-1">
                  {proposal.financial.notes.map((n, idx) => (
                    <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="text-slate-400 mt-0.5">•</span> {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* ASSINATURAS */}
        <section className="pt-20 pb-8 page-break-inside-avoid">
          <div className="grid grid-cols-2 gap-16 text-center mt-12">
            <div>
              <div className="border-b border-slate-400 mb-3 mx-auto w-full max-w-[250px]"></div>
              <p className="font-bold text-slate-900">Contratante</p>
              <p className="text-sm text-slate-500 mt-1">{proposal.clientName}</p>
            </div>
            <div>
              <div className="border-b border-slate-400 mb-3 mx-auto w-full max-w-[250px]"></div>
              <p className="font-bold text-slate-900">Contratado</p>
              <p className="text-sm text-slate-500 mt-1">Seu Nome / Sua Empresa</p>
            </div>
          </div>
        </section>
      </div>

      {/* STYLES FOR PRINTING */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { margin: 0; }
          body { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
            margin: 0;
            padding: 0;
          }
          .page-break-inside-avoid { page-break-inside: avoid; }
          
          /* Padding for print pages */
          #pdf-content {
            padding: 2cm !important;
          }
          
          /* Override the negative margins of the header when printing to ensure it spans full width */
          #pdf-header {
            margin-top: -2cm !important;
            margin-left: -2cm !important;
            margin-right: -2cm !important;
            padding-top: 2cm !important;
            padding-left: 2cm !important;
            padding-right: 2cm !important;
          }
        }
      `}} />
    </div>
  )
}

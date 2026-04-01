import { HandCoins, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Proposal, ProposalFinancialScheduleItem } from "@/components/proposal/proposal-mock"
import { formatBRL } from "@/components/proposal/proposal-utils"

export function EditableFinancial({ 
  proposal, 
  onChange 
}: { 
  proposal: Proposal, 
  onChange: (data: Partial<Proposal>) => void 
}) {
  const updateFinancial = (field: string, value: any) => {
    onChange({ financial: { ...proposal.financial, [field]: value } })
  }

  const updateCard = (field: string, value: any) => {
    onChange({ 
      financial: { 
        ...proposal.financial, 
        cardOption: proposal.financial.cardOption ? { ...proposal.financial.cardOption, [field]: value } : undefined 
      } 
    })
  }

  const updateScheduleItem = (index: number, field: keyof ProposalFinancialScheduleItem, value: any) => {
    const newSchedule = [...proposal.financial.schedule]
    newSchedule[index] = { ...newSchedule[index], [field]: value }
    onChange({ financial: { ...proposal.financial, schedule: newSchedule } })
  }

  const addScheduleItem = () => {
    const newSchedule = [
      ...proposal.financial.schedule, 
      { label: "Novo Marco", percent: 0, amount: 0, dueLabel: "Data" }
    ]
    onChange({ financial: { ...proposal.financial, schedule: newSchedule } })
  }

  const removeScheduleItem = (index: number) => {
    const newSchedule = proposal.financial.schedule.filter((_, i) => i !== index)
    onChange({ financial: { ...proposal.financial, schedule: newSchedule } })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[#f7f3ea] dark:bg-slate-800/40 p-5">
        <div className="flex items-center gap-2 mb-4">
          <HandCoins className="size-4 text-slate-500 dark:text-slate-400" />
          <div className="font-semibold text-slate-800 dark:text-slate-200">Cronograma de Pagamentos</div>
        </div>

        <div className="grid gap-4 mb-6">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
            <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">Valor Total do Projeto</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={1}
                value={proposal.financial.total}
                onChange={(e) => updateFinancial("total", Number(e.target.value))}
                className="w-32 h-8 text-right font-bold border-none bg-transparent p-0 focus:ring-0 dark:text-slate-100"
              />
              <span className="text-sm text-slate-500 dark:text-slate-400">({formatBRL(proposal.financial.total)})</span>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-500 mb-1">Resumo do Pagamento</div>
            <Input 
              value={proposal.financial.paymentSummary} 
              onChange={e => updateFinancial("paymentSummary", e.target.value)}
              className="h-8 border-none p-0 focus-visible:ring-0 bg-transparent text-sm font-medium dark:text-slate-300"
            />
          </div>
        </div>

        {proposal.financial.cardOption && (
          <div className="mb-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Opção de Cartão</div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-500">Taxa %:</span>
                <input 
                  type="number" 
                  value={proposal.financial.cardOption.feePercent} 
                  onChange={e => updateCard("feePercent", Number(e.target.value))}
                  className="w-12 h-6 text-xs border border-slate-200 dark:border-slate-700 rounded px-1 bg-white dark:bg-slate-800 dark:text-slate-300"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase text-slate-500 dark:text-slate-500 block mb-1">Total Cartão</label>
                <input 
                  type="number" 
                  value={proposal.financial.cardOption.total} 
                  onChange={e => updateCard("total", Number(e.target.value))}
                  className="w-full h-8 text-sm font-bold border-none bg-transparent p-0 focus:ring-0 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-slate-500 dark:text-slate-500 block mb-1">Parcelas (até)</label>
                <input 
                  type="number" 
                  value={proposal.financial.cardOption.maxInstallments} 
                  onChange={e => updateCard("maxInstallments", Number(e.target.value))}
                  className="w-full h-8 text-sm border-none bg-transparent p-0 focus:ring-0 dark:text-slate-300"
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-500 font-semibold">Marcos de Pagamento</div>
            <button 
              type="button" 
              onClick={addScheduleItem}
              className="size-6 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-primary transition-all"
            >
              <Plus className="size-3" />
            </button>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="h-8 text-[10px] uppercase text-slate-400 dark:text-slate-500 p-0">Marco</TableHead>
                <TableHead className="h-8 text-[10px] uppercase text-slate-400 dark:text-slate-500 text-right p-0">%</TableHead>
                <TableHead className="h-8 text-[10px] uppercase text-slate-400 dark:text-slate-500 text-right p-0 pr-2">Valor</TableHead>
                <TableHead className="h-8 w-8 p-0"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposal.financial.schedule.map((item, idx) => (
                <TableRow key={idx} className="group border-slate-200/50 dark:border-slate-700/50 hover:bg-transparent">
                  <TableCell className="p-0 py-2">
                    <input 
                      value={item.label} 
                      onChange={e => updateScheduleItem(idx, "label", e.target.value)}
                      className="w-full h-6 text-sm font-semibold border-none bg-transparent p-0 focus:ring-0 dark:text-slate-200"
                    />
                    <input 
                      value={item.dueLabel} 
                      onChange={e => updateScheduleItem(idx, "dueLabel", e.target.value)}
                      className="w-full h-4 text-[11px] text-slate-500 dark:text-slate-500 border-none bg-transparent p-0 focus:ring-0"
                    />
                  </TableCell>
                  <TableCell className="p-0 py-2 text-right">
                    <input 
                      type="number"
                      value={item.percent} 
                      onChange={e => updateScheduleItem(idx, "percent", Number(e.target.value))}
                      className="w-12 h-6 text-sm text-right border-none bg-transparent p-0 focus:ring-0 dark:text-slate-300"
                    />
                  </TableCell>
                  <TableCell className="p-0 py-2 text-right pr-2">
                    <input 
                      type="number"
                      value={item.amount} 
                      onChange={e => updateScheduleItem(idx, "amount", Number(e.target.value))}
                      className="w-24 h-6 text-sm font-bold text-right border-none bg-transparent p-0 focus:ring-0 dark:text-slate-100"
                    />
                  </TableCell>
                  <TableCell className="p-0 py-2 text-right">
                    <button 
                      type="button"
                      onClick={() => removeScheduleItem(idx)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-slate-500 hover:text-red-500"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

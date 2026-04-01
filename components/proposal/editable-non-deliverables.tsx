import { Plus, Trash2, Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Proposal } from "@/components/proposal/proposal-mock"

export function EditableNonDeliverables({ 
  proposal, 
  onChange 
}: { 
  proposal: Proposal, 
  onChange: (data: Partial<Proposal>) => void 
}) {
  const updateItem = (index: number, value: string) => {
    const newItems = [...proposal.nonDeliverables]
    newItems[index] = value
    onChange({ nonDeliverables: newItems })
  }

  const addItem = () => {
    onChange({ 
      nonDeliverables: [...proposal.nonDeliverables, "Novo item não entregável"] 
    })
  }

  const removeItem = (index: number) => {
    onChange({ nonDeliverables: proposal.nonDeliverables.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ban className="size-4 text-slate-500" />
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Não Entregáveis</div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="size-4 mr-1" /> Add Item
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {proposal.nonDeliverables.map((item, idx) => (
          <div key={idx} className="group relative flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 hover:border-red-200 dark:hover:border-red-900/30 transition-all">
            <div className="mt-2.5 size-1.5 shrink-0 rounded-full bg-red-400 dark:bg-red-500/50" />
            <Textarea 
              value={item} 
              onChange={e => updateItem(idx, e.target.value)}
              className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-none p-0 focus-visible:ring-0 bg-transparent resize-none min-h-[40px]"
            />
            <button 
              type="button"
              onClick={() => removeItem(idx)}
              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

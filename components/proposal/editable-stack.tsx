import { Plus, Trash2, ShieldCheck, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Proposal } from "@/components/proposal/proposal-mock"

export function EditableStack({ 
  proposal, 
  onChange 
}: { 
  proposal: Proposal, 
  onChange: (data: Partial<Proposal>) => void 
}) {
  const updateStack = (index: number, field: "label" | "value", value: string) => {
    const newStack = [...proposal.stack]
    newStack[index] = { ...newStack[index], [field]: value }
    onChange({ stack: newStack })
  }

  const addStack = () => {
    onChange({ 
      stack: [...proposal.stack, { label: "Nova Categoria", value: "Tecnologia" }] 
    })
  }

  const removeStack = (index: number) => {
    onChange({ stack: proposal.stack.filter((_, i) => i !== index) })
  }

  const updateOwnership = (index: number, value: string) => {
    const newTerms = [...proposal.ownershipTerms]
    newTerms[index] = value
    onChange({ ownershipTerms: newTerms })
  }

  const addOwnership = () => {
    onChange({ 
      ownershipTerms: [...proposal.ownershipTerms, "Novo termo de propriedade intelectual"] 
    })
  }

  const removeOwnership = (index: number) => {
    onChange({ ownershipTerms: proposal.ownershipTerms.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-8">
      {/* Stack Tecnológica */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="size-4 text-slate-500" />
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Stack Tecnológica</div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addStack}>
            <Plus className="size-4 mr-1" /> Add Item
          </Button>
        </div>
        
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {proposal.stack.map((item, idx) => (
            <div key={idx} className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 hover:border-primary/30 transition-all">
              <button 
                type="button"
                onClick={() => removeStack(idx)}
                className="absolute -top-2 -right-2 hidden group-hover:flex size-6 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600 transition-colors"
              >
                <Trash2 className="size-3" />
              </button>
              <Input 
                value={item.label} 
                onChange={e => updateStack(idx, "label", e.target.value)}
                className="h-6 text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold border-none p-0 focus-visible:ring-0 bg-transparent mb-1"
              />
              <Input 
                value={item.value} 
                onChange={e => updateStack(idx, "value", e.target.value)}
                className="h-7 text-sm font-medium border-none p-0 focus-visible:ring-0 bg-transparent dark:text-slate-200"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Propriedade Intelectual */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-slate-500" />
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Propriedade Intelectual</div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addOwnership}>
            <Plus className="size-4 mr-1" /> Add Termo
          </Button>
        </div>

        <div className="space-y-3">
          {proposal.ownershipTerms.map((term, idx) => (
            <div key={idx} className="group relative flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
              <div className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[#c79b6b]" />
              <Textarea 
                value={term} 
                onChange={e => updateOwnership(idx, e.target.value)}
                className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-none p-0 focus-visible:ring-0 bg-transparent resize-none min-h-[40px]"
              />
              <button 
                type="button"
                onClick={() => removeOwnership(idx)}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

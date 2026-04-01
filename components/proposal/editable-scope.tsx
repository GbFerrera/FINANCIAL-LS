import { Plus, Trash2, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Proposal } from "@/components/proposal/proposal-mock"

export function EditableScope({ 
  proposal, 
  onChange 
}: { 
  proposal: Proposal, 
  onChange: (data: Partial<Proposal>) => void 
}) {
  const updateModule = (index: number, field: string, value: string) => {
    const newModules = [...proposal.scopeModules]
    newModules[index] = { ...newModules[index], [field]: value }
    onChange({ scopeModules: newModules })
  }

  const addModule = () => {
    onChange({ 
      scopeModules: [...proposal.scopeModules, { title: "Novo Módulo", description: "Descrição do módulo" }] 
    })
  }

  const removeModule = (index: number) => {
    onChange({ scopeModules: proposal.scopeModules.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">O quê será entregue</div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Adicione ou remova os módulos que compõem o escopo do projeto.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addModule}>
          <Plus className="size-4 mr-1" /> Add Módulo
        </Button>
      </div>
      
      <div className="grid gap-3 sm:grid-cols-2">
        {proposal.scopeModules.map((m, idx) => (
          <div key={idx} className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-primary/30 transition-all">
            <button 
              type="button"
              onClick={() => removeModule(idx)}
              className="absolute -top-2 -right-2 hidden group-hover:flex size-6 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600 transition-colors"
            >
              <Trash2 className="size-3" />
            </button>
            <div className="flex items-center justify-between gap-3 mb-2">
              <Input 
                value={m.title} 
                onChange={e => updateModule(idx, "title", e.target.value)}
                className="h-7 font-semibold border-none p-0 focus-visible:ring-0 bg-transparent dark:text-slate-100"
              />
              <Badge variant="secondary" className="h-5 px-2 text-[11px] shrink-0">Incluído</Badge>
            </div>
            <Textarea 
              value={m.description} 
              onChange={e => updateModule(idx, "description", e.target.value)}
              className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-none p-0 focus-visible:ring-0 bg-transparent resize-none min-h-[60px]"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

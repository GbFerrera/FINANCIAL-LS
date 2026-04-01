import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Proposal, ProposalSprint } from "@/components/proposal/proposal-mock"

export function EditableSprints({ 
  proposal, 
  onChange 
}: { 
  proposal: Proposal, 
  onChange: (data: Partial<Proposal>) => void 
}) {
  const updateSprint = (index: number, field: keyof ProposalSprint, value: any) => {
    const newSprints = [...proposal.sprints]
    newSprints[index] = { ...newSprints[index], [field]: value }
    onChange({ sprints: newSprints })
  }

  const addSprint = () => {
    onChange({ 
      sprints: [...proposal.sprints, { 
        name: `Sprint ${proposal.sprints.length + 1}`, 
        durationLabel: "1 semana", 
        goal: "Objetivo da sprint", 
        deliverables: ["Entregável 1"] 
      }] 
    })
  }

  const removeSprint = (index: number) => {
    onChange({ sprints: proposal.sprints.filter((_, i) => i !== index) })
  }

  const updateDeliverable = (sprintIdx: number, dIdx: number, value: string) => {
    const newSprints = [...proposal.sprints]
    newSprints[sprintIdx].deliverables[dIdx] = value
    onChange({ sprints: newSprints })
  }

  const addDeliverable = (sprintIdx: number) => {
    const newSprints = [...proposal.sprints]
    newSprints[sprintIdx].deliverables.push("Novo entregável")
    onChange({ sprints: newSprints })
  }

  const removeDeliverable = (sprintIdx: number, dIdx: number) => {
    const newSprints = [...proposal.sprints]
    newSprints[sprintIdx].deliverables = newSprints[sprintIdx].deliverables.filter((_, i) => i !== dIdx)
    onChange({ sprints: newSprints })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Como e quando</div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Defina as etapas de entrega do projeto.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addSprint}>
          <Plus className="size-4 mr-1" /> Add Sprint
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800">
              <TableHead className="w-[120px] dark:text-slate-400">Sprint</TableHead>
              <TableHead className="w-[140px] dark:text-slate-400">Duração</TableHead>
              <TableHead className="dark:text-slate-400">Objetivo</TableHead>
              <TableHead className="dark:text-slate-400">Entregáveis</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proposal.sprints.map((s, sIdx) => (
              <TableRow key={sIdx} className="group border-slate-200 dark:border-slate-800">
                <TableCell>
                  <Input 
                    value={s.name} 
                    onChange={e => updateSprint(sIdx, "name", e.target.value)}
                    className="h-8 font-medium border-none p-0 focus-visible:ring-0 bg-transparent dark:text-slate-200"
                  />
                </TableCell>
                <TableCell>
                  <Input 
                    value={s.durationLabel} 
                    onChange={e => updateSprint(sIdx, "durationLabel", e.target.value)}
                    className="h-8 border-none p-0 focus-visible:ring-0 bg-transparent dark:text-slate-400"
                  />
                </TableCell>
                <TableCell>
                  <Input 
                    value={s.goal} 
                    onChange={e => updateSprint(sIdx, "goal", e.target.value)}
                    className="h-8 border-none p-0 focus-visible:ring-0 bg-transparent text-slate-600 dark:text-slate-400"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {s.deliverables.map((d, dIdx) => (
                      <div key={dIdx} className="group/item relative">
                        <Badge variant="secondary" className="pr-6 bg-[#0f2545] dark:bg-slate-800 text-white hover:bg-[#0f2545]/90 dark:hover:bg-slate-700 border-none">
                          <input 
                            value={d}
                            onChange={e => updateDeliverable(sIdx, dIdx, e.target.value)}
                            className="bg-transparent border-none p-0 focus:ring-0 text-[11px] w-auto min-w-[60px]"
                            style={{ width: `${Math.max(d.length * 7, 60)}px` }}
                          />
                          <button 
                            type="button"
                            onClick={() => removeDeliverable(sIdx, dIdx)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </Badge>
                      </div>
                    ))}
                    <button 
                      type="button"
                      onClick={() => addDeliverable(sIdx)}
                      className="size-6 flex items-center justify-center rounded-full border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:border-primary hover:text-primary transition-all"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                </TableCell>
                <TableCell>
                  <button 
                    type="button"
                    onClick={() => removeSprint(sIdx)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

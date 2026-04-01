import { ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ProposalStepDef } from "@/components/proposal/proposal-sidebar"
import { stepAnchor } from "@/components/proposal/proposal-utils"

export function ProposalDrawerItem({
  step,
  open,
  onToggle,
  children,
}: {
  step: ProposalStepDef
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const Icon = step.icon
  const panelId = `${stepAnchor(step.id)}-panel`
  const buttonId = `${stepAnchor(step.id)}-button`

  return (
    <section
      id={stepAnchor(step.id)}
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm",
        open && "ring-1 ring-[#c79b6b]/35 border-[#c79b6b]/40"
      )}
    >
      <button
        id={buttonId}
        type="button"
        className="w-full px-5 py-4 flex items-start gap-3 text-left hover:bg-[#f7f3ea] transition-colors"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <div className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-[#f7f3ea] text-slate-700">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-xs uppercase tracking-widest text-slate-500">
              {step.label}
            </div>
            {open ? (
              <Badge
                variant="outline"
                className="h-5 px-2 text-[11px] border-[#c79b6b]/50 text-[#0f2545] bg-[#c79b6b]/20"
              >
                Aberto
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold leading-snug text-slate-900">
              {step.title}
            </h2>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-slate-500 transition-transform",
                open && "rotate-180"
              )}
            />
          </div>
        </div>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 pt-1 border-t border-slate-200/70">
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}

import Image from "next/image"
import { Globe, Mail, Phone, CalendarIcon } from "lucide-react"
import type { Proposal } from "@/components/proposal/proposal-mock"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface ProposalHeaderProps {
  proposal: Proposal
  editable?: boolean
  clients?: { id: string; name: string }[]
  projects?: { id: string; name: string; clientId: string }[]
  onClientChange?: (id: string) => void
  onProjectChange?: (id: string) => void
  onDateRangeChange?: (range: { from: Date; to: Date }) => void
  selectedClientId?: string
  selectedProjectId?: string
  dateRange?: { from: Date; to: Date }
}

export function ProposalHeader({ 
  proposal,
  editable,
  clients = [],
  projects = [],
  onClientChange,
  onProjectChange,
  onDateRangeChange,
  selectedClientId,
  selectedProjectId,
  dateRange
}: ProposalHeaderProps) {
  return (
    <div>
      <div className="relative bg-[#0f2545] text-white">
        <div
          className="absolute right-0 top-0 h-full w-[160px] sm:w-[260px] md:w-[340px] bg-[#c79b6b]"
          style={{ clipPath: "polygon(22% 0, 100% 0, 100% 100%, 0 100%)" }}
        />

        <div className="relative px-4 sm:px-6 py-5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl overflow-hidden">
              <Image
                src="/logo-branca.png"
                alt="Logo"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <div>
              <div className="text-xl uppercase tracking-[0.22em] font-semibold text-white">Link System</div>
              <div className="text-sm text-white/90">{proposal.id}</div>
            </div>
          </div>

          <div className="hidden sm:block text-[#0f2545]">
            <div className="grid gap-1 text-xs font-medium">
              <div className="flex items-center gap-2 justify-end">
                <Phone className="size-4" />
                <span>(00) 0000-0000</span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <Mail className="size-4" />
                <span>seuemail@email.com</span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <Globe className="size-4" />
                <span>www.seusite.com.br</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-6 border-b border-slate-200/70 bg-white dark:bg-slate-900">
        <div className="flex flex-col items-center gap-6">
          {/* Editable Title Badge */}
          <div className="rounded-xl border border-slate-300 dark:border-slate-700 px-6 py-2.5 text-center">
            <div className="text-sm font-semibold uppercase tracking-widest text-slate-800 dark:text-slate-200">
              {proposal.title}
            </div>
          </div>

          <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Cliente */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-900 shadow-sm">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Cliente</div>
              {editable ? (
                <Select value={selectedClientId} onValueChange={onClientChange}>
                  <SelectTrigger className="h-7 border-none p-0 focus:ring-0 text-sm font-medium bg-transparent dark:text-slate-100">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm font-medium truncate dark:text-slate-200">{proposal.clientName}</div>
              )}
            </div>

            {/* Projeto */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-900 shadow-sm">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Projeto</div>
              {editable ? (
                <Select value={selectedProjectId} onValueChange={onProjectChange} disabled={!selectedClientId}>
                  <SelectTrigger className="h-7 border-none p-0 focus:ring-0 text-sm font-medium bg-transparent dark:text-slate-100">
                    <SelectValue placeholder="Nenhum..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum projeto</SelectItem>
                    {projects.filter(p => p.clientId === selectedClientId).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm font-medium truncate dark:text-slate-200">{proposal.projectName || "N/A"}</div>
              )}
            </div>

            {/* Emissão & Validade with Calendar Popover */}
            {editable && dateRange && onDateRangeChange ? (
              <>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-900 shadow-sm">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Emissão</div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 text-sm font-medium dark:text-slate-100 hover:text-primary transition-colors">
                        <CalendarIcon className="size-3 text-slate-400" />
                        {format(dateRange.from, "dd/MM/yyyy")}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.from}
                        onSelect={(date) => date && onDateRangeChange({ ...dateRange, from: date })}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-900 shadow-sm">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Validade</div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 text-sm font-medium dark:text-slate-100 hover:text-primary transition-colors">
                        <CalendarIcon className="size-3 text-slate-400" />
                        {format(dateRange.to, "dd/MM/yyyy")}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.to}
                        onSelect={(date) => date && onDateRangeChange({ ...dateRange, to: date })}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-900 shadow-sm">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Emissão</div>
                  <div className="mt-1 text-sm font-medium dark:text-slate-200">{proposal.issuedAtLabel}</div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-900 shadow-sm">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Validade</div>
                  <div className="mt-1 text-sm font-medium dark:text-slate-200">{proposal.validUntilLabel}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { format, addDays } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, Loader2, Save, ChevronDown, ChevronUp, FileText, Ban, Layers, Cpu, HandCoins } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as RangeCalendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { ProposalHeader } from "@/components/proposal/proposal-header"
import { proposalMock as INITIAL_PROPOSAL_DATA, Proposal } from "@/components/proposal/proposal-mock"
import { EditableScope } from "@/components/proposal/editable-scope"
import { EditableSprints } from "@/components/proposal/editable-sprints"
import { EditableFinancial } from "@/components/proposal/editable-financial"
import { EditableStack } from "@/components/proposal/editable-stack"
import { EditableNonDeliverables } from "@/components/proposal/editable-non-deliverables"

type Client = { id: string; name: string }
type Project = { id: string; name: string; clientId: string }

export default function NewProposalPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  
  const [clientId, setClientId] = useState("")
  const [projectId, setProjectId] = useState<string>("")
  
  // Proposal Data state (matching the mock structure)
  const [proposalData, setProposalData] = useState<Proposal>({
    ...INITIAL_PROPOSAL_DATA,
    id: "PROP-XXXX", // Placeholder
  })

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(),
    to: addDays(new Date(), 30)
  })

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    scope: true,
    nonDeliverables: true,
    sprints: true,
    stack: true,
    financial: true,
  })

  useEffect(() => {
    const load = async () => {
      try {
        const [clientsRes, projectsRes] = await Promise.all([
          fetch("/api/clients?limit=100"),
          fetch("/api/projects?limit=100")
        ])
        const clientsData = await clientsRes.json()
        const projectsData = await projectsRes.json()
        setClients(clientsData.clients.map((c: any) => ({ id: c.id, name: c.name })))
        setProjects(projectsData.projects.map((p: any) => ({ id: p.id, name: p.name, clientId: p.client.id })))
      } catch {
        toast.error("Erro ao carregar dados")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filteredProjects = projects.filter(p => p.clientId === clientId)
  const selectedClient = clients.find(c => c.id === clientId)
  const selectedProject = projects.find(p => p.id === projectId)

  const toggleSection = (id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const updateProposal = (updates: Partial<Proposal>) => {
    setProposalData(prev => ({ ...prev, ...updates }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) {
      toast.error("Selecione o cliente")
      return
    }
    if (!dateRange.from || !dateRange.to) {
      toast.error("Selecione o período (Emissão e Validade)")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          projectId: projectId || null,
          title: proposalData.title,
          issuedAt: format(dateRange.from, 'yyyy-MM-dd'),
          validUntil: format(dateRange.to, 'yyyy-MM-dd'),
          objective: proposalData.objective,
          data: proposalData // Send the whole editable object
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Erro ao criar proposta")
      }
      const created = await res.json()
      toast.success("Proposta criada com sucesso!")
      router.push(`/proposta?code=${created.code}`)
    } catch (err: any) {
      toast.error(err.message || "Erro")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Montar Proposta</h1>
          <p className="text-muted-foreground text-sm">Edite os campos diretamente na estrutura final do contrato.</p>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button disabled={saving} onClick={submit} className="bg-[#0f2545] hover:bg-[#0f2545]/90 text-white min-w-[150px]">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Finalizar Proposta
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl">
        {/* THE VISUAL PROPOSAL CONTAINER */}
        <div className="rounded-[28px] bg-white dark:bg-slate-900 shadow-[0_30px_80px_rgba(15,37,69,0.12)] ring-1 ring-slate-200/70 dark:ring-slate-800 overflow-hidden">
          
          {/* HEADER (With interactive fields) */}
          <ProposalHeader 
            proposal={{ 
              id: proposalData.id, 
              title: proposalData.title,
              clientName: selectedClient?.name || "Cliente Exemplo",
              projectName: selectedProject?.name || "N/A",
              issuedAtLabel: format(dateRange.from, "dd/MM/yyyy"),
              validUntilLabel: format(dateRange.to, "dd/MM/yyyy"),
            } as any}
            editable
            clients={clients}
            projects={projects}
            selectedClientId={clientId}
            selectedProjectId={projectId}
            dateRange={dateRange}
            onClientChange={(val) => { setClientId(val); setProjectId("") }}
            onProjectChange={(val) => setProjectId(val === "none" ? "" : val)}
            onDateRangeChange={setDateRange}
          />

          <div className="px-4 sm:px-6 pb-8 pt-6 space-y-8">
            {/* Title & Date Range (Now handled in Header) */}
            <div className="flex flex-col items-center gap-4 text-center">
              <input 
                className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 border-none text-center focus:ring-0 w-full bg-transparent"
                value={proposalData.title}
                onChange={e => updateProposal({ title: e.target.value })}
              />
            </div>

            {/* Sections (Cards) */}
            <div className="space-y-6">
              
              {/* Visão Geral Section */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden transition-all">
                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                  <FileText className="size-5 text-slate-400 dark:text-slate-500" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Visão geral</span>
                </div>
                <div className="p-5">
                  <Textarea 
                    className="min-h-[120px] border-none p-0 focus-visible:ring-0 bg-transparent text-slate-600 dark:text-slate-400 leading-relaxed resize-none"
                    placeholder="Descreva o objetivo principal..."
                    value={proposalData.objective}
                    onChange={e => updateProposal({ objective: e.target.value })}
                  />
                </div>
              </div>

              {/* ETAPA 1: Escopo Section */}
              <div className={cn(
                "rounded-2xl border transition-all overflow-hidden",
                openSections.scope ? "border-[#c79b6b] ring-1 ring-[#c79b6b]/20" : "border-slate-200 dark:border-slate-800"
              )}>
                <button 
                  onClick={() => toggleSection('scope')}
                  className="flex w-full items-center justify-between bg-white dark:bg-slate-900 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      <Layers className="size-5" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Etapa 1</span>
                        <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 border-none h-4 px-1.5 text-[9px]">Aberto</Badge>
                      </div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">Escopo e Módulos</div>
                    </div>
                  </div>
                  {openSections.scope ? <ChevronUp className="size-5 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="size-5 text-slate-400 dark:text-slate-500" />}
                </button>
                {openSections.scope && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-[#fdfcf9]/50 dark:bg-slate-900/50 p-6">
                    <EditableScope proposal={proposalData} onChange={updateProposal} />
                  </div>
                )}
              </div>

              {/* ETAPA 2: Não Entregáveis Section */}
              <div className={cn(
                "rounded-2xl border transition-all overflow-hidden",
                openSections.nonDeliverables ? "border-[#c79b6b] ring-1 ring-[#c79b6b]/20" : "border-slate-200 dark:border-slate-800"
              )}>
                <button 
                  onClick={() => toggleSection('nonDeliverables')}
                  className="flex w-full items-center justify-between bg-white dark:bg-slate-900 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      <Ban className="size-5" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Etapa 2</span>
                        <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 border-none h-4 px-1.5 text-[9px]">Aberto</Badge>
                      </div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">Não Entregáveis e Ajustes</div>
                    </div>
                  </div>
                  {openSections.nonDeliverables ? <ChevronUp className="size-5 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="size-5 text-slate-400 dark:text-slate-500" />}
                </button>
                {openSections.nonDeliverables && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-[#fdfcf9]/50 dark:bg-slate-900/50 p-6">
                    <EditableNonDeliverables proposal={proposalData} onChange={updateProposal} />
                  </div>
                )}
              </div>

              {/* ETAPA 3: Sprints Section */}
              <div className={cn(
                "rounded-2xl border transition-all overflow-hidden",
                openSections.sprints ? "border-[#c79b6b] ring-1 ring-[#c79b6b]/20" : "border-slate-200 dark:border-slate-800"
              )}>
                <button 
                  onClick={() => toggleSection('sprints')}
                  className="flex w-full items-center justify-between bg-white dark:bg-slate-900 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      <Cpu className="size-5" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Etapa 3</span>
                        <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 border-none h-4 px-1.5 text-[9px]">Aberto</Badge>
                      </div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">Sprints e Entregáveis</div>
                    </div>
                  </div>
                  {openSections.sprints ? <ChevronUp className="size-5 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="size-5 text-slate-400 dark:text-slate-500" />}
                </button>
                {openSections.sprints && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-[#fdfcf9]/50 dark:bg-slate-900/50 p-6">
                    <EditableSprints proposal={proposalData} onChange={updateProposal} />
                  </div>
                )}
              </div>

              {/* ETAPA 4: Stack & Propriedade Intelectual Section */}
              <div className={cn(
                "rounded-2xl border transition-all overflow-hidden",
                openSections.stack ? "border-[#c79b6b] ring-1 ring-[#c79b6b]/20" : "border-slate-200 dark:border-slate-800"
              )}>
                <button 
                  onClick={() => toggleSection('stack')}
                  className="flex w-full items-center justify-between bg-white dark:bg-slate-900 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      <Cpu className="size-5" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Etapa 4</span>
                        <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 border-none h-4 px-1.5 text-[9px]">Aberto</Badge>
                      </div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">Stack e Propriedade</div>
                    </div>
                  </div>
                  {openSections.stack ? <ChevronUp className="size-5 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="size-5 text-slate-400 dark:text-slate-500" />}
                </button>
                {openSections.stack && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-[#fdfcf9]/50 dark:bg-slate-900/50 p-6">
                    <EditableStack proposal={proposalData} onChange={updateProposal} />
                  </div>
                )}
              </div>

              {/* ETAPA 5: Financeiro Section */}
              <div className={cn(
                "rounded-2xl border transition-all overflow-hidden",
                openSections.financial ? "border-[#c79b6b] ring-1 ring-[#c79b6b]/20" : "border-slate-200 dark:border-slate-800"
              )}>
                <button 
                  onClick={() => toggleSection('financial')}
                  className="flex w-full items-center justify-between bg-white dark:bg-slate-900 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      <HandCoins className="size-5" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Etapa 5</span>
                        <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 border-none h-4 px-1.5 text-[9px]">Aberto</Badge>
                      </div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">Financeiro e Termos Jurídicos</div>
                    </div>
                  </div>
                  {openSections.financial ? <ChevronUp className="size-5 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="size-5 text-slate-400 dark:text-slate-500" />}
                </button>
                {openSections.financial && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-[#fdfcf9]/50 dark:bg-slate-900/50 p-6">
                    <EditableFinancial proposal={proposalData} onChange={updateProposal} />
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

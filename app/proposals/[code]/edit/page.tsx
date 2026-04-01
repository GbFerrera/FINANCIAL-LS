"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { format, addDays, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, Loader2, Save } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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

type ProposalItem = {
  code: string
  title: string
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "ARCHIVED"
  issuedAt: string
  validUntil?: string
  data?: any
  client?: { id: string; name: string }
  project?: { id: string; name: string }
}

export default function EditProposalPage() {
  const params = useParams() as { code: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [proposal, setProposal] = useState<ProposalItem | null>(null)
  
  const [title, setTitle] = useState("")
  const [status, setStatus] = useState<ProposalItem["status"]>("DRAFT")
  const [objective, setObjective] = useState("")
  
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  })

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/proposals/${params.code}`)
        if (!res.ok) throw new Error("Proposta não encontrada")
        const data = await res.json()
        setProposal(data)
        setTitle(data.title)
        setStatus(data.status)
        setDateRange({
          from: data.issuedAt ? new Date(data.issuedAt.split('T')[0] + 'T12:00:00') : undefined,
          to: data.validUntil ? new Date(data.validUntil.split('T')[0] + 'T12:00:00') : undefined
        })
        setObjective((data.data?.objective as string) || "")
      } catch (err: any) {
        toast.error(err.message || "Erro ao carregar")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.code])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dateRange.from) {
      toast.error("A data de emissão é obrigatória.")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/proposals/${params.code}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          status,
          issuedAt: format(dateRange.from, 'yyyy-MM-dd'),
          validUntil: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined,
          objective
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Erro ao salvar")
      }
      toast.success("Proposta atualizada com sucesso!")
      router.push(`/proposta?code=${params.code}`)
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
  if (!proposal) {
    return <div className="p-8 text-center text-slate-500">Proposta não encontrada</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Editar Proposta {proposal.code}</h1>
          <p className="text-muted-foreground">
            Cliente: <span className="font-medium text-foreground">{proposal.client?.name}</span>
            {proposal.project?.name && <span> • Projeto: <span className="font-medium text-foreground">{proposal.project?.name}</span></span>}
          </p>
        </div>
      </div>

      <Card className="border-border shadow-sm max-w-4xl">
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title">Título da Proposta <span className="text-red-500">*</span></Label>
                <Input 
                  id="title" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(val) => setStatus(val as ProposalItem["status"])}>
                  <SelectTrigger id="status" className="w-full">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Rascunho</SelectItem>
                    <SelectItem value="SENT">Enviada</SelectItem>
                    <SelectItem value="ACCEPTED">Aceita</SelectItem>
                    <SelectItem value="REJECTED">Recusada</SelectItem>
                    <SelectItem value="ARCHIVED">Arquivada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Período (Emissão e Validade) <span className="text-red-500">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd 'de' MMMM, yyyy", { locale: ptBR })} -{" "}
                          {format(dateRange.to, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                        </>
                      ) : (
                        format(dateRange.from, "dd 'de' MMMM, yyyy", { locale: ptBR })
                      )
                    ) : (
                      <span>Selecione o período de validade</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <RangeCalendar
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range: any) => {
                      if (range) {
                        setDateRange({ from: range.from, to: range.to })
                      }
                    }}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="objective">Objetivo</Label>
              <Textarea 
                id="objective" 
                value={objective} 
                onChange={e => setObjective(e.target.value)} 
                rows={5} 
                className="resize-none"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button disabled={saving} type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[150px]">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { MoreHorizontal, Plus, Users } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { PageLoadingGate } from "@/components/ui/loading-animation"
import { StatsCard } from "@/components/ui/stats-card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import {
  REMINDER_VARIABLE_HINTS,
  renderReminderTemplate,
  formatBRL,
  formatDateBR,
  daysUntilDue,
  reminderTemplateVarsFromRemaining,
  type ReminderTemplateVars,
} from "@/lib/subscription-reminder"
import { buildReminderEmailHtml } from "@/lib/subscription-reminder-email"
import { unpaidDueDateForClientSubscription, type BillingCycle } from "@/lib/subscription-billing"
import {
  ReminderWhatsAppSection,
  type ReminderWhatsAppInstance,
} from "@/components/financial/ReminderWhatsAppSection"
import { ReminderTemplateList } from "@/components/financial/ReminderTemplateList"

type Group = { id: string; name: string; description?: string | null }

type SubscriptionPlan = {
  id: string
  name: string
  price: number
  billingCycle: string
  groupId: string
  group: { id: string; name: string }
  clients: {
    id: string
    dueDay: number
    startedAt: string
    lastPaidFor: string | null
    client: { id: string; name: string; email: string; company?: string | null }
  }[]
}

const EMPTY_PREVIEW_VARS: ReminderTemplateVars = {
  nome: "—",
  cliente: "—",
  preco: "—",
  vencimento: "—",
  plano: "—",
  empresa: "—",
  grupo: "—",
  dias_antes: "0",
  dias_atraso: "0",
}

function billingLabel(cycle: string) {
  return cycle === "YEARLY" ? "Anual" : "Mensal"
}

function formatPlanPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

type WhatsAppInstanceOption = Pick<
  ReminderWhatsAppInstance,
  "id" | "label" | "phone" | "status"
>

type Template = {
  id: string
  groupId: string
  name: string
  subject: string
  body: string
  daysBeforeDue: number
  daysAfterDue: number
  sendTime: string
  whatsAppPauseSeconds: number
  isActive: boolean
  sendEmail: boolean
  sendWhatsApp: boolean
  whatsAppInstanceId: string | null
  whatsAppPixButton?: boolean
  pixKey?: string | null
  pixKeyType?: string | null
  pixReceiverName?: string | null
  pixButtonLabel?: string | null
  pixCity?: string | null
  pixDescription?: string | null
  pixTxid?: string | null
  whatsAppInstance?: WhatsAppInstanceOption | null
  group: { id: string; name: string }
  clientSubscriptionIds?: string[]
  _count?: { sendLogs: number }
}

function allClientSubIdsForGroup(groupId: string, plans: SubscriptionPlan[]) {
  return plans
    .filter((s) => s.groupId === groupId)
    .flatMap((p) => p.clients.map((c) => c.id))
}

export default function FinancialRemindersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [groups, setGroups] = useState<Group[]>([])
  const [subscriptions, setSubscriptions] = useState<SubscriptionPlan[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [waInstances, setWaInstances] = useState<WhatsAppInstanceOption[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)
  const [running, setRunning] = useState(false)

  const [formGroupId, setFormGroupId] = useState("")
  const [formName, setFormName] = useState("Lembrete")
  const [formSubject, setFormSubject] = useState("Olá {{nome}}, sua assinatura vence em {{vencimento}}")
  const [formBody, setFormBody] = useState(
    "Oi {{nome}},\n\nSua assinatura {{plano}} ({{grupo}}) no valor de {{preco}} vence em {{vencimento}}.\n\nQualquer dúvida, estamos à disposição."
  )
  const [formDays, setFormDays] = useState("3")
  const [formDaysAfter, setFormDaysAfter] = useState("0")
  const [formSendTime, setFormSendTime] = useState("09:00")
  const [formWaPause, setFormWaPause] = useState("10")
  const [formActive, setFormActive] = useState(true)
  const [formSendEmail, setFormSendEmail] = useState(true)
  const [formSendWhatsApp, setFormSendWhatsApp] = useState(false)
  const [formWhatsAppInstanceId, setFormWhatsAppInstanceId] = useState("")
  const [formWhatsAppPix, setFormWhatsAppPix] = useState(false)
  const [formPixKey, setFormPixKey] = useState("")
  const [formPixKeyType, setFormPixKeyType] = useState("email")
  const [formPixReceiverName, setFormPixReceiverName] = useState("Link System")
  const [formPixCity, setFormPixCity] = useState("Goiania")
  const [formPixDescription, setFormPixDescription] = useState("")
  const [formPixTxid, setFormPixTxid] = useState("")
  const [formPixButtonLabel, setFormPixButtonLabel] = useState("Pagar com Pix")
  const [formRecipientIds, setFormRecipientIds] = useState<string[]>([])

  const recipientIdSet = useMemo(() => new Set(formRecipientIds), [formRecipientIds])

  const templateStats = useMemo(() => {
    const active = templates.filter((t) => t.isActive).length
    const email = templates.filter((t) => t.sendEmail).length
    const whatsapp = templates.filter((t) => t.sendWhatsApp).length
    const sends = templates.reduce((sum, t) => sum + (t._count?.sendLogs ?? 0), 0)
    return { total: templates.length, active, email, whatsapp, sends }
  }, [templates])

  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/auth/signin")
      return
    }
    if (session.user.role !== "ADMIN") {
      router.push("/dashboard")
    }
  }, [session, status, router])

  const handleWaInstancesChange = useCallback((list: ReminderWhatsAppInstance[]) => {
    setWaInstances(list.map(({ id, label, phone, status }) => ({ id, label, phone, status })))
  }, [])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [gRes, tRes, sRes] = await Promise.all([
        fetch("/api/subscriptions/groups"),
        fetch("/api/financial/subscription-reminders/templates"),
        fetch("/api/subscriptions"),
      ])
      if (gRes.ok) {
        const data = await gRes.json()
        setGroups(data.groups || [])
      }
      if (tRes.ok) {
        const data = await tRes.json()
        setTemplates(data.templates || [])
      }
      if (sRes.ok) {
        const data = await sRes.json()
        setSubscriptions(data.subscriptions || [])
      }
    } catch {
      toast.error("Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session?.user?.role === "ADMIN") void load()
  }, [session, load])

  const selectedGroupPlans = useMemo(() => {
    if (!formGroupId) return []
    return subscriptions.filter((s) => s.groupId === formGroupId)
  }, [formGroupId, subscriptions])

  const selectedGroupName = useMemo(
    () => groups.find((g) => g.id === formGroupId)?.name ?? "",
    [groups, formGroupId]
  )

  const previewVars = useMemo((): ReminderTemplateVars => {
    const diasAntesConfig = parseInt(formDays, 10)
    const diasAtrasoConfig = parseInt(formDaysAfter, 10)
    const today = new Date()

    for (const plan of selectedGroupPlans) {
      for (const link of plan.clients ?? []) {
        if (!recipientIdSet.has(link.id)) continue

        const due = unpaidDueDateForClientSubscription({
          dueDay: link.dueDay,
          billingCycle: plan.billingCycle as BillingCycle,
          startedAt: link.startedAt ? new Date(link.startedAt) : undefined,
          lastPaidFor: link.lastPaidFor ? new Date(link.lastPaidFor) : null,
        })

        const grupo = selectedGroupName || plan.group?.name || "—"
        const remaining = due ? daysUntilDue(today, due) : diasAntesConfig
        const previewRemaining =
          remaining >= 0
            ? Math.min(remaining, Number.isFinite(diasAntesConfig) ? diasAntesConfig : remaining)
            : Number.isFinite(diasAtrasoConfig)
              ? -Math.min(-remaining, diasAtrasoConfig)
              : remaining

        return reminderTemplateVarsFromRemaining(previewRemaining, {
          nome: link.client.name,
          cliente: link.client.name,
          preco: formatBRL(Number(plan.price || 0)),
          vencimento: due ? formatDateBR(due) : `dia ${link.dueDay}`,
          plano: plan.name,
          empresa: link.client.company?.trim() || "—",
          grupo,
        })
      }
    }

    const diasFallback = Number.isFinite(diasAntesConfig) ? String(diasAntesConfig) : "0"
    if (formGroupId && selectedGroupName) {
      return { ...EMPTY_PREVIEW_VARS, grupo: selectedGroupName, dias_antes: diasFallback }
    }

    return { ...EMPTY_PREVIEW_VARS, dias_antes: diasFallback }
  }, [selectedGroupPlans, selectedGroupName, formGroupId, formDays, formDaysAfter, recipientIdSet])

  const previewSubject = useMemo(
    () => renderReminderTemplate(formSubject, previewVars),
    [formSubject, previewVars]
  )
  const previewBody = useMemo(() => renderReminderTemplate(formBody, previewVars), [formBody, previewVars])

  const previewDaysUntilDue = useMemo(() => {
    const n = parseInt(previewVars.dias_antes, 10)
    return Number.isFinite(n) ? n : 0
  }, [previewVars.dias_antes])

  const previewEmailHtml = useMemo(() => {
    if (!formSendEmail) return null
    return buildReminderEmailHtml({
      bodyText: previewBody,
      vars: previewVars,
      daysUntilDue: previewDaysUntilDue,
      branding: { brandName: "Link System" },
    })
  }, [formSendEmail, previewBody, previewVars, previewDaysUntilDue])

  const previewSampleLabel = useMemo(() => {
    for (const plan of selectedGroupPlans) {
      for (const link of plan.clients ?? []) {
        if (!recipientIdSet.has(link.id)) continue
        return `${link.client.name} · ${plan.name}`
      }
    }
    return null
  }, [selectedGroupPlans, recipientIdSet])

  const allGroupRecipientIds = useMemo(
    () => allClientSubIdsForGroup(formGroupId, subscriptions),
    [formGroupId, subscriptions]
  )

  const recipientCount = formRecipientIds.length

  const toggleRecipient = (id: string, checked: boolean) => {
    setFormRecipientIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id]
      return prev.filter((x) => x !== id)
    })
  }

  const openCreate = () => {
    setEditing(null)
    const gid = groups[0]?.id || ""
    setFormGroupId(gid)
    setFormRecipientIds(allClientSubIdsForGroup(gid, subscriptions))
    setFormName("Lembrete")
    setFormSubject("Olá {{nome}}, sua assinatura vence em {{vencimento}}")
    setFormBody(
      "Oi {{nome}},\n\nSua assinatura {{plano}} ({{grupo}}) no valor de {{preco}} vence em {{vencimento}}.\n\nQualquer dúvida, estamos à disposição."
    )
    setFormDays("3")
    setFormDaysAfter("0")
    setFormSendTime("09:00")
    setFormWaPause("10")
    setFormActive(true)
    setFormSendEmail(true)
    setFormSendWhatsApp(false)
    setFormWhatsAppPix(false)
    setFormPixKey("")
    setFormPixKeyType("email")
    setFormPixReceiverName("Link System")
    setFormPixCity("Goiania")
    setFormPixDescription("")
    setFormPixTxid("")
    setFormPixButtonLabel("Pagar com Pix")
    setFormWhatsAppInstanceId(waInstances.find((w) => w.status === "CONNECTED")?.id || waInstances[0]?.id || "")
    setDialogOpen(true)
  }

  const openEdit = (t: Template) => {
    setEditing(t)
    setFormGroupId(t.groupId)
    const inGroup = new Set(allClientSubIdsForGroup(t.groupId, subscriptions))
    const saved = t.clientSubscriptionIds?.length ? t.clientSubscriptionIds : [...inGroup]
    setFormRecipientIds(saved.filter((id) => inGroup.has(id)))
    setFormName(t.name)
    setFormSubject(t.subject)
    setFormBody(t.body)
    setFormDays(String(t.daysBeforeDue))
    setFormDaysAfter(String(t.daysAfterDue ?? 0))
    setFormSendTime(t.sendTime?.match(/^\d{1,2}:\d{2}$/) ? t.sendTime : "09:00")
    setFormWaPause(String(t.whatsAppPauseSeconds ?? 10))
    setFormActive(t.isActive)
    setFormSendEmail(t.sendEmail ?? true)
    setFormSendWhatsApp(t.sendWhatsApp ?? false)
    setFormWhatsAppPix(t.whatsAppPixButton ?? false)
    setFormPixKey(t.pixKey || "")
    setFormPixKeyType(t.pixKeyType || "email")
    setFormPixReceiverName(t.pixReceiverName || "Link System")
    setFormPixCity(t.pixCity || "Goiania")
    setFormPixDescription(t.pixDescription || "")
    setFormPixTxid(t.pixTxid || "")
    setFormPixButtonLabel(t.pixButtonLabel || "Pagar com Pix")
    setFormWhatsAppInstanceId(t.whatsAppInstanceId || "")
    setDialogOpen(true)
  }

  const saveTemplate = async () => {
    if (!formGroupId || !formSubject.trim() || !formBody.trim()) {
      toast.error("Preencha grupo, assunto e mensagem")
      return
    }
    const days = parseInt(formDays, 10)
    if (!Number.isFinite(days) || days < 0) {
      toast.error("Dias antes inválido")
      return
    }
    const daysAfter = parseInt(formDaysAfter, 10)
    if (!Number.isFinite(daysAfter) || daysAfter < 0) {
      toast.error("Dias após vencimento inválido")
      return
    }

    if (!formSendEmail && !formSendWhatsApp) {
      toast.error("Ative e-mail ou WhatsApp")
      return
    }
    if (formSendWhatsApp && !formWhatsAppInstanceId) {
      toast.error("Selecione o número WhatsApp ou conecte um na seção WhatsApp abaixo")
      return
    }
    if (formRecipientIds.length === 0) {
      toast.error("Selecione ao menos um cliente em Quem recebe")
      return
    }

    const sendTime = formSendTime.trim()
    if (!/^\d{1,2}:\d{2}$/.test(sendTime)) {
      toast.error("Horário de envio inválido (HH:mm)")
      return
    }
    const waPause = parseInt(formWaPause, 10)
    if (!Number.isFinite(waPause) || waPause < 0 || waPause > 45) {
      toast.error("Pausa WhatsApp deve ser entre 0 e 45 segundos")
      return
    }

    if (formSendWhatsApp && formWhatsAppPix && !formPixKey.trim()) {
      toast.error("Informe a chave Pix para o botão de cobrança")
      return
    }

    const payload = {
      groupId: formGroupId,
      name: formName.trim() || "Lembrete",
      subject: formSubject,
      body: formBody,
      daysBeforeDue: days,
      daysAfterDue: daysAfter,
      sendTime,
      whatsAppPauseSeconds: waPause,
      isActive: formActive,
      sendEmail: formSendEmail,
      sendWhatsApp: formSendWhatsApp,
      whatsAppInstanceId: formSendWhatsApp ? formWhatsAppInstanceId : null,
      whatsAppPixButton: formSendWhatsApp && formWhatsAppPix,
      pixKey: formSendWhatsApp && formWhatsAppPix ? formPixKey.trim() : undefined,
      pixKeyType: formSendWhatsApp && formWhatsAppPix ? formPixKeyType : undefined,
      pixReceiverName:
        formSendWhatsApp && formWhatsAppPix ? formPixReceiverName.trim() || "Link System" : undefined,
      pixCity: formSendWhatsApp && formWhatsAppPix ? formPixCity.trim() || "Goiania" : undefined,
      pixDescription:
        formSendWhatsApp && formWhatsAppPix ? formPixDescription.trim() || undefined : undefined,
      pixTxid: formSendWhatsApp && formWhatsAppPix ? formPixTxid.trim() || undefined : undefined,
      pixButtonLabel: formSendWhatsApp && formWhatsAppPix ? formPixButtonLabel.trim() || "Pagar com Pix" : undefined,
      clientSubscriptionIds: formRecipientIds,
    }

    try {
      const res = await fetch(
        editing
          ? `/api/financial/subscription-reminders/templates/${editing.id}`
          : "/api/financial/subscription-reminders/templates",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Falha ao salvar")
      }
      toast.success(editing ? "Template atualizado" : "Template criado")
      setDialogOpen(false)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar")
    }
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm("Excluir este template?")) return
    const res = await fetch(`/api/financial/subscription-reminders/templates/${id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Erro ao excluir")
      return
    }
    toast.success("Template excluído")
    await load()
  }

  const runDispatches = async (dryRun: boolean) => {
    try {
      setRunning(true)
      const res = await fetch("/api/financial/subscription-reminders/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Falha na execução")

      if (dryRun) {
        toast.success(`${data.candidates ?? 0} envio(s) seriam disparados hoje`)
      } else {
        toast.success(`${data.sent ?? 0} envio(s) concluído(s)`)
      }
      if (Array.isArray(data.results) && data.results.length > 0) {
        console.table(data.results)
      }
      if (!dryRun) await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao executar")
    } finally {
      setRunning(false)
    }
  }

  return (
    <PageLoadingGate loading={status === "loading" || loading}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Lembretes de assinatura</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Templates por grupo, e-mail (Gmail/SMTP) e WhatsApp — tudo nesta página.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={running}>
                  <MoreHorizontal className="mr-2 h-4 w-4" />
                  Ações
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem disabled={running} onClick={() => runDispatches(true)}>
                  Simular hoje
                </DropdownMenuItem>
                <DropdownMenuItem disabled={running} onClick={() => runDispatches(false)}>
                  Disparar agora
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Novo template
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard title="Templates" value={templateStats.total} />
          <StatsCard title="Ativos" value={templateStats.active} />
          <StatsCard
            title="Com e-mail"
            value={templateStats.email}
            change={{ value: `${templateStats.whatsapp} com WhatsApp`, type: "neutral" }}
          />
          <StatsCard title="Envios registrados" value={templateStats.sends} />
        </div>

        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Variáveis disponíveis
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Use no assunto ou na mensagem:</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {REMINDER_VARIABLE_HINTS.map((v) => (
              <Badge key={v.key} variant="outline" className="font-mono text-[11px] font-normal">
                {`{{${v.key}}}`}
              </Badge>
            ))}
          </div>
        </div>

        <ReminderWhatsAppSection onInstancesChange={handleWaInstancesChange} />

        <ReminderTemplateList
          templates={templates}
          onCreate={openCreate}
          onEdit={openEdit}
          onDelete={deleteTemplate}
        />

        <details className="rounded-lg border border-border bg-card group">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-2">
              Cron em produção
              <span className="text-xs font-normal text-muted-foreground group-open:hidden">Ver detalhes</span>
            </span>
          </summary>
          <div className="space-y-2 border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <p>
              Em produção a fila BullMQ (Redis) dispara a varredura a cada 5 minutos após o horário do
              template. Configure <code className="rounded bg-muted px-1 text-xs">REDIS_URL</code> (db/1) e{" "}
              <code className="rounded bg-muted px-1 text-xs">TZ=America/Sao_Paulo</code>.
            </p>
            <p>Ou agende um POST externo (Coolify/cron):</p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {`POST /api/financial/subscription-reminders/run
Header: x-cron-secret: <CRON_SECRET>`}
            </pre>
          </div>
        </details>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[920px]">
            <DialogHeader className="shrink-0 px-6 pt-6">
              <DialogTitle>{editing ? "Editar template" : "Novo template"}</DialogTitle>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Grupo de assinatura</Label>
                    <Select
                      value={formGroupId}
                      onValueChange={(v) => {
                        setFormGroupId(v)
                        setFormRecipientIds(allClientSubIdsForGroup(v, subscriptions))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome interno</Label>
                    <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Dias antes do vencimento</Label>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={formDays}
                      onChange={(e) => setFormDays(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dias após o vencimento</Label>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={formDaysAfter}
                      onChange={(e) => setFormDaysAfter(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Início dos envios (horário)</Label>
                    <Input
                      type="time"
                      value={formSendTime}
                      onChange={(e) => setFormSendTime(e.target.value)}
                    />
                  </div>
                </div>
                <p className="-mt-2 text-xs text-muted-foreground">
                  Envia todo dia desde <span className="font-medium">N dias antes</span> até o vencimento
                  {parseInt(formDaysAfter, 10) > 0 ? (
                    <>
                      {" "}
                      e por mais <span className="font-medium">{formDaysAfter} dia(s)</span> sobre o atraso
                    </>
                  ) : null}
                  . Use 0 em ambos para enviar só no vencimento. Disparos reais só após o horário configurado.
                  Use <code className="rounded bg-muted px-1">{`{{dias_atraso}}`}</code> na mensagem para cobrança
                  em atraso.
                </p>
                <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">Canais de envio</p>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={formSendEmail}
                      onCheckedChange={(v) => setFormSendEmail(v === true)}
                      id="send-email"
                    />
                    <Label htmlFor="send-email">Enviar por e-mail (Gmail / SMTP)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={formSendWhatsApp}
                      onCheckedChange={(v) => setFormSendWhatsApp(v === true)}
                      id="send-wa"
                    />
                    <Label htmlFor="send-wa">Enviar por WhatsApp</Label>
                  </div>
                  {formSendWhatsApp && (
                    <div className="space-y-2 pl-6">
                      <Label>Número WhatsApp</Label>
                      <Select
                        value={
                          formWhatsAppInstanceId &&
                          waInstances.some((w) => w.id === formWhatsAppInstanceId)
                            ? formWhatsAppInstanceId
                            : undefined
                        }
                        onValueChange={setFormWhatsAppInstanceId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {waInstances.length === 0 ? (
                            <SelectItem value="__none" disabled>
                              Nenhum número — conecte na seção WhatsApp acima
                            </SelectItem>
                          ) : (
                            waInstances.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.label}
                                {w.status !== "CONNECTED" ? " (desconectado)" : w.phone ? ` · ${w.phone}` : ""}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <div className="space-y-2">
                        <Label>Pausa entre mensagens (segundos)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={45}
                          value={formWaPause}
                          onChange={(e) => setFormWaPause(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Aguarda entre cada WhatsApp quando houver vários envios na mesma execução (máx. 45 s).
                        </p>
                      </div>
                      <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/20 p-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={formWhatsAppPix}
                            onCheckedChange={(v) => setFormWhatsAppPix(v === true)}
                            id="send-wa-pix"
                          />
                          <Label htmlFor="send-wa-pix">Incluir botão de cobrança Pix</Label>
                        </div>
                        {formWhatsAppPix && (
                          <div className="grid gap-3 sm:grid-cols-2 sm:pl-6">
                            <div className="space-y-2 sm:col-span-2">
                              <Label>Chave Pix</Label>
                              <Input
                                value={formPixKey}
                                onChange={(e) => setFormPixKey(e.target.value)}
                                placeholder="E-mail, telefone, CPF/CNPJ ou aleatória"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Tipo da chave</Label>
                              <Select value={formPixKeyType} onValueChange={setFormPixKeyType}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="email">E-mail</SelectItem>
                                  <SelectItem value="phone">Telefone</SelectItem>
                                  <SelectItem value="cpf">CPF</SelectItem>
                                  <SelectItem value="cnpj">CNPJ</SelectItem>
                                  <SelectItem value="random">Aleatória (EVP)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Nome no Pix (DICT)</Label>
                              <Input
                                value={formPixReceiverName}
                                onChange={(e) => setFormPixReceiverName(e.target.value)}
                                placeholder="50122718 GABRIEL FERREI"
                                maxLength={25}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Cidade (Pix)</Label>
                              <Input
                                value={formPixCity}
                                onChange={(e) => setFormPixCity(e.target.value)}
                                placeholder="Niquelandia"
                                maxLength={15}
                              />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <Label>Descrição no Pix (opcional)</Label>
                              <Input
                                value={formPixDescription}
                                onChange={(e) => setFormPixDescription(e.target.value)}
                                placeholder="Assinatura mensal"
                                maxLength={72}
                              />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <Label>TxID no copia e cola (opcional, até 25)</Label>
                              <Input
                                value={formPixTxid}
                                onChange={(e) => setFormPixTxid(e.target.value)}
                                placeholder="5012271800000675390941ASA"
                                maxLength={25}
                              />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <Label>Texto do botão</Label>
                              <Input
                                value={formPixButtonLabel}
                                onChange={(e) => setFormPixButtonLabel(e.target.value)}
                                maxLength={40}
                                placeholder="Copiar chave Pix"
                              />
                            </div>
                            <p className="text-xs text-muted-foreground sm:col-span-2">
                              No WhatsApp e no e-mail: Pix copia e cola (sem chave avulsa). O nome do recebedor no
                              Pix deve ser igual ao cadastro do banco (máx. 25 caracteres).
                            </p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Telefone do cliente vem do cadastro do cliente.{" "}
                        <Link href="#whatsapp-lembretes" className="underline hover:text-foreground">
                          Conectar número
                        </Link>
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formActive}
                    onCheckedChange={(v) => setFormActive(v === true)}
                    id="active"
                  />
                  <Label htmlFor="active">Template ativo</Label>
                </div>
                <div className="space-y-2">
                  <Label>{formSendEmail ? "Assunto do e-mail" : "Assunto / título (WhatsApp)"}</Label>
                  <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <Textarea rows={7} value={formBody} onChange={(e) => setFormBody(e.target.value)} />
                </div>
                <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3 text-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Pré-visualização
                  </p>
                  {previewSampleLabel ? (
                    <p className="text-xs text-muted-foreground">Exemplo: {previewSampleLabel}</p>
                  ) : formGroupId ? (
                    <p className="text-xs text-muted-foreground">Nenhum assinante neste grupo para exemplificar.</p>
                  ) : null}
                  {formSendEmail && previewEmailHtml ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Assunto: <span className="font-medium text-foreground">{previewSubject}</span>
                      </p>
                      <div className="max-h-[min(420px,50vh)] overflow-hidden overflow-y-auto rounded-lg border border-border bg-muted/40">
                        <iframe
                          title="Pré-visualização do e-mail"
                          srcDoc={previewEmailHtml}
                          className="min-h-[380px] w-full border-0 bg-transparent"
                          sandbox=""
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold">{previewSubject}</p>
                      <p className="whitespace-pre-wrap text-muted-foreground">{previewBody}</p>
                    </>
                  )}
                </div>
              </div>

              <aside className="flex min-h-[200px] shrink-0 flex-col border-t border-border bg-muted/15 md:max-h-[calc(92vh-8rem)] md:min-h-0 md:w-[min(100%,320px)] md:border-l md:border-t-0">
                <div className="shrink-0 border-b border-border px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Users className="h-4 w-4" />
                    Quem recebe
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formGroupId ? (
                      <>
                        Grupo <span className="font-medium text-foreground">{selectedGroupName}</span>
                        {" · "}
                        {recipientCount} selecionado(s)
                        {allGroupRecipientIds.length > 0 && recipientCount < allGroupRecipientIds.length
                          ? ` de ${allGroupRecipientIds.length}`
                          : ""}
                      </>
                    ) : (
                      "Selecione um grupo"
                    )}
                  </p>
                  {formGroupId && allGroupRecipientIds.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setFormRecipientIds(allGroupRecipientIds)}
                      >
                        Todos
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setFormRecipientIds([])}
                      >
                        Nenhum
                      </Button>
                    </div>
                  )}
                </div>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                  {!formGroupId ? (
                    <p className="text-sm text-muted-foreground">Escolha o grupo para ver planos e clientes.</p>
                  ) : selectedGroupPlans.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum plano ativo neste grupo.</p>
                  ) : (
                    selectedGroupPlans.map((plan) => (
                      <div key={plan.id} className="space-y-2">
                        <div>
                          <p className="text-sm font-medium leading-tight">{plan.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPlanPrice(Number(plan.price))} · {billingLabel(plan.billingCycle)}
                          </p>
                        </div>
                        {(plan.clients?.length ?? 0) === 0 ? (
                          <p className="text-xs text-muted-foreground">Sem clientes</p>
                        ) : (
                          <ul className="space-y-2">
                            {plan.clients.map((clientSub) => {
                              const checked = recipientIdSet.has(clientSub.id)
                              const due = unpaidDueDateForClientSubscription({
                                dueDay: clientSub.dueDay,
                                billingCycle: plan.billingCycle as BillingCycle,
                                startedAt: clientSub.startedAt ? new Date(clientSub.startedAt) : undefined,
                                lastPaidFor: clientSub.lastPaidFor ? new Date(clientSub.lastPaidFor) : null,
                              })
                              return (
                                <li key={clientSub.id}>
                                  <label
                                    className={`flex cursor-pointer gap-2 rounded-md border border-border px-2.5 py-2 text-xs transition-colors ${
                                      checked ? "bg-muted/40" : "bg-background/80 hover:bg-muted/20"
                                    }`}
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(v) => toggleRecipient(clientSub.id, v === true)}
                                      className="mt-0.5"
                                    />
                                    <span className="min-w-0 flex-1">
                                      <p className="text-sm font-medium">{clientSub.client.name}</p>
                                      <p className="truncate text-muted-foreground">{clientSub.client.email}</p>
                                      <p className="mt-0.5 text-muted-foreground">
                                        {due
                                          ? `Venc. ${formatDateBR(due)}`
                                          : `Venc. dia ${clientSub.dueDay}`}
                                        {" · "}
                                        {formatPlanPrice(Number(plan.price))}
                                      </p>
                                    </span>
                                  </label>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </aside>
            </div>

            <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveTemplate}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageLoadingGate>
  )
}

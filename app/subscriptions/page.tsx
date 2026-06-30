"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { Calendar, CheckCircle2, CreditCard, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { StatsCard } from "@/components/ui/stats-card"
import { Badge } from "@/components/ui/badge"

type Group = {
  id: string
  name: string
  description?: string | null
  _count?: { subscriptions: number }
  totalPrice?: number
}

type Client = {
  id: string
  name: string
  email: string
}

type Subscription = {
  id: string
  groupId: string
  name: string
  description?: string | null
  price: number
  billingCycle: "MONTHLY" | "YEARLY"
  isActive: boolean
  group: Group
  clients: {
    id: string
    client: Client
    status: string
    dueDay: number
    startedAt: string
    endedAt?: string | null
    updatedAt?: string
    lastPaidFor?: string | null
    paidAt?: string | null
  }[]
}

function formatCurrencyBRFromDigits(digits: string) {
  const onlyDigits = (digits || "").replace(/\D/g, "")
  const normalized = onlyDigits.replace(/^0+/, "") || "0"
  const cents = normalized.padStart(3, "0")
  const integerPart = cents.slice(0, -2)
  const decimalPart = cents.slice(-2)
  const integerFormatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${integerFormatted},${decimalPart}`
}

function parseCurrencyBRToNumber(value: string) {
  const digits = (value || "").replace(/\D/g, "")
  const normalized = digits.replace(/^0+/, "") || "0"
  const cents = parseInt(normalized, 10)
  if (!Number.isFinite(cents)) return null
  return cents / 100
}

function formatBRL2(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatDateBR(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function formatDateTimeBR(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, "0")
  const mi = String(d.getMinutes()).padStart(2, "0")
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`
}

function daysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate()
}

function dueDateForMonth(year: number, monthIndex0: number, dueDay: number) {
  const dim = daysInMonth(year, monthIndex0)
  const day = Math.min(Math.max(1, dueDay), dim)
  return new Date(year, monthIndex0, day, 12, 0, 0, 0)
}

function monthStartDate(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

function monthEndDate(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

function chargeDueForMonth(input: {
  subscription: Subscription
  link: Subscription["clients"][number]
  year: number
  monthIndex0: number
}) {
  const { subscription: s, link, year, monthIndex0 } = input
  const dueDay = typeof link.dueDay === "number" ? link.dueDay : null
  if (dueDay === null) return null
  if (!s.isActive) return null
  if ((link.status || "").toUpperCase() !== "ACTIVE") return null

  const monthNumber = String(monthIndex0 + 1).padStart(2, "0")
  const mStartKey = `${year}-${monthNumber}-01`
  const mEndKey = dateKey(new Date(year, monthIndex0 + 1, 0, 12, 0, 0, 0))

  const startedAt = link.startedAt ? new Date(link.startedAt) : null
  const endedAt = link.endedAt ? new Date(link.endedAt) : null
  if (endedAt && dateKey(endedAt) < mStartKey) return null
  if (startedAt && dateKey(startedAt) > mEndKey) return null

  const due = dueDateForMonth(year, monthIndex0, dueDay)

  if (s.billingCycle === "MONTHLY") {
    return due
  }

  const cycleMonth = startedAt ? startedAt.getMonth() : monthIndex0
  if (cycleMonth !== monthIndex0) return null
  return due
}

function dateKey(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function nextChargeDateForClientSubscription(input: {
  from: Date
  dueDay: number
  billingCycle: "MONTHLY" | "YEARLY"
  startedAt?: Date | null
}) {
  const from = input.from
  const dueDay = Math.min(Math.max(1, input.dueDay), 31)

  const computeInMonth = (year: number, monthIndex0: number) => {
    const dim = daysInMonth(year, monthIndex0)
    const day = Math.min(dueDay, dim)
    return new Date(year, monthIndex0, day, 12, 0, 0, 0)
  }

  if (input.billingCycle === "YEARLY") {
    const base = input.startedAt ?? null
    const month = base ? base.getMonth() : from.getMonth()
    const thisYear = computeInMonth(from.getFullYear(), month)
    if (thisYear.getTime() >= from.getTime()) return thisYear
    return computeInMonth(from.getFullYear() + 1, month)
  }

  const thisMonth = computeInMonth(from.getFullYear(), from.getMonth())
  if (thisMonth.getTime() >= from.getTime()) return thisMonth
  const next = new Date(from.getFullYear(), from.getMonth() + 1, 1, 12, 0, 0, 0)
  return computeInMonth(next.getFullYear(), next.getMonth())
}

export default function SubscriptionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<"subscriptions" | "groups">("subscriptions")
  const [loading, setLoading] = useState(false)
  const [selectClientOpen, setSelectClientOpen] = useState(false)
  const [createSubscriptionOpen, setCreateSubscriptionOpen] = useState(false)
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null)
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)

  const [groups, setGroups] = useState<Group[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])

  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupDescription, setNewGroupDescription] = useState("")

  const [subGroupId, setSubGroupId] = useState("")
  const [subName, setSubName] = useState("")
  const [subDescription, setSubDescription] = useState("")
  const [subPrice, setSubPrice] = useState("0,00")
  const [subCycle, setSubCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY")
  const [subDueDay, setSubDueDay] = useState("10")
  const [clientSearch, setClientSearch] = useState("")
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => (c.name || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q))
  }, [clients, clientSearch])

  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/auth/signin")
      return
    }
    refreshAll().catch(() => {})
  }, [session, status, router])

  const refreshAll = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchGroups(), fetchClients(), fetchSubscriptions()])
    } finally {
      setLoading(false)
    }
  }

  const fetchGroups = async () => {
    const res = await fetch("/api/subscriptions/groups")
    if (!res.ok) throw new Error("Falha ao buscar grupos")
    const data = await res.json()
    setGroups(data.groups || [])
  }

  const fetchClients = async () => {
    const res = await fetch("/api/clients?page=1&limit=500")
    if (!res.ok) throw new Error("Falha ao buscar clientes")
    const data = await res.json()
    const list = (data.clients || []).map((c: any) => ({ id: c.id, name: c.name, email: c.email })) as Client[]
    setClients(list)
  }

  const fetchSubscriptions = async () => {
    const res = await fetch("/api/subscriptions")
    if (!res.ok) throw new Error("Falha ao buscar assinaturas")
    const data = await res.json()
    setSubscriptions(data.subscriptions || [])
  }

  const createGroup = async () => {
    const name = newGroupName.trim()
    if (!name) {
      toast.error("Informe o nome do grupo")
      return
    }
    const res = await fetch("/api/subscriptions/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: newGroupDescription.trim() || undefined,
      }),
    })
    if (!res.ok) {
      const msg = await res.text().catch(() => "")
      toast.error(msg || "Erro ao criar grupo")
      return
    }
    toast.success("Grupo criado")
    setNewGroupName("")
    setNewGroupDescription("")
    await fetchGroups()
    setCreateGroupOpen(false)
  }

  const createSubscription = async () => {
    if (!subGroupId) {
      toast.error("Selecione um grupo")
      return
    }
    const name = subName.trim()
    if (!name) {
      toast.error("Informe o nome da assinatura")
      return
    }
    const parsed = parseCurrencyBRToNumber(subPrice)
    const price = typeof parsed === "number" && Number.isFinite(parsed) && parsed >= 0 ? parsed : null
    if (price === null) {
      toast.error("Preço inválido")
      return
    }
    const dueDay = parseInt(subDueDay, 10)
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
      toast.error("Informe o dia de vencimento (1 a 31)")
      return
    }
    const res = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: subGroupId,
        name,
        description: subDescription.trim() || undefined,
        price,
        billingCycle: subCycle,
        clientIds: selectedClientId ? [selectedClientId] : [],
        dueDay,
      }),
    })
    if (!res.ok) {
      const msg = await res.text().catch(() => "")
      toast.error(msg || "Erro ao criar assinatura")
      return
    }
    toast.success("Assinatura criada")
    setSubName("")
    setSubDescription("")
    setSubPrice("0,00")
    setSubCycle("MONTHLY")
    setSubDueDay("10")
    setSelectedClientId(null)
    await Promise.all([fetchSubscriptions(), fetchGroups()])
    setActiveTab("subscriptions")
    setCreateSubscriptionOpen(false)
  }

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null
    return clients.find((c) => c.id === selectedClientId) || null
  }, [clients, selectedClientId])

  const markAsPaid = async (clientSubscriptionId: string, paidForDate: Date) => {
    try {
      setMarkingPaidId(clientSubscriptionId)
      const res = await fetch("/api/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientSubscriptionId,
          paidForDate: paidForDate.toISOString(),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || "Falha ao marcar como pago")
      }
      toast.success("Marcado como pago")
      await fetchSubscriptions()
    } catch (e: any) {
      toast.error(e?.message || "Erro ao marcar como pago")
    } finally {
      setMarkingPaidId(null)
    }
  }

  const subscriptionSummary = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const monthIndex0 = now.getMonth()
    const mStart = monthStartDate(now)
    const mEnd = monthEndDate(now)

    let total = 0
    let receivedThisMonth = 0
    let remainingThisMonth = 0
    let receivedCountThisMonth = 0
    let remainingCountThisMonth = 0
    let nextDueInMonth: Date | null = null
    let nextDueInMonthAmount = 0

    for (const s of subscriptions) {
      total += Number(s.price || 0)
      const price = Number(s.price || 0)

      for (const link of s.clients || []) {
        const due = chargeDueForMonth({ subscription: s, link, year, monthIndex0 })
        if (!due) continue

        const lastPaidFor = link.lastPaidFor ? new Date(link.lastPaidFor) : null
        const paid = lastPaidFor ? dateKey(lastPaidFor) === dateKey(due) : false

        if (paid) {
          receivedThisMonth += price
          receivedCountThisMonth += 1
          continue
        }

        remainingThisMonth += price
        remainingCountThisMonth += 1

        if (!nextDueInMonth || due.getTime() < nextDueInMonth.getTime()) {
          nextDueInMonth = due
          nextDueInMonthAmount = price
        } else if (dateKey(due) === dateKey(nextDueInMonth)) {
          nextDueInMonthAmount += price
        }
      }
    }

    const nextDueLabel = nextDueInMonth ? formatDateBR(nextDueInMonth) : "-"
    const nextDueIsThisMonth =
      nextDueInMonth ? nextDueInMonth.getTime() >= mStart.getTime() && nextDueInMonth.getTime() <= mEnd.getTime() : false

    return {
      total,
      receivedThisMonth,
      remainingThisMonth,
      receivedCountThisMonth,
      remainingCountThisMonth,
      nextDueInMonth,
      nextDueInMonthLabel: nextDueLabel,
      nextDueInMonthAmount,
      nextDueIsThisMonth,
    }
  }, [subscriptions])

  const groupSubscriberRows = useMemo(() => {
    if (!activeGroupId) return []
    const now = new Date()
    const monthYear = now.getFullYear()
    const monthIndex0 = now.getMonth()

    const rows: Array<{
      key: string
      subscriptionName: string
      billingCycle: "MONTHLY" | "YEARLY"
      price: number
      clientName: string
      clientEmail: string
      dueThisMonth: Date | null
      status: "PAID" | "PENDING"
      paidAt: Date | null
    }> = []

    for (const s of subscriptions) {
      if (s.groupId !== activeGroupId) continue
      const price = Number(s.price || 0)

      for (const link of s.clients || []) {
        const dueThisMonth = chargeDueForMonth({ subscription: s, link, year: monthYear, monthIndex0 })
        if (!dueThisMonth) continue

        const lastPaidFor = link?.lastPaidFor ? new Date(link.lastPaidFor) : null
        const paid = lastPaidFor ? dateKey(lastPaidFor) === dateKey(dueThisMonth) : false
        const paidAt =
          paid && link?.paidAt
            ? new Date(link.paidAt)
            : paid && link?.updatedAt
              ? new Date(link.updatedAt)
              : paid
                ? lastPaidFor
                : null

        rows.push({
          key: `${s.id}:${link.id}`,
          subscriptionName: s.name,
          billingCycle: s.billingCycle,
          price,
          clientName: link.client?.name || "-",
          clientEmail: link.client?.email || "-",
          dueThisMonth,
          status: paid ? "PAID" : "PENDING",
          paidAt,
        })
      }
    }

    rows.sort((a, b) => {
      if (a.status !== b.status) return a.status === "PENDING" ? -1 : 1
      const ad = a.dueThisMonth ? a.dueThisMonth.getTime() : 0
      const bd = b.dueThisMonth ? b.dueThisMonth.getTime() : 0
      return ad - bd
    })

    return rows
  }, [activeGroupId, subscriptions])

  const groupMonthSummary = useMemo(() => {
    if (!activeGroupId) return { received: 0, remaining: 0, receivedCount: 0, remainingCount: 0 }
    let received = 0
    let remaining = 0
    let receivedCount = 0
    let remainingCount = 0

    for (const r of groupSubscriberRows) {
      if (r.status === "PAID") {
        received += r.price
        receivedCount += 1
      } else {
        remaining += r.price
        remainingCount += 1
      }
    }

    return { received, remaining, receivedCount, remainingCount }
  }, [activeGroupId, groupSubscriberRows])

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Assinaturas</h1>
          <p className="text-muted-foreground">Crie grupos e vincule assinaturas aos clientes.</p>
        </div>
        <Button onClick={refreshAll} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
          <TabsTrigger value="groups">Grupos</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard title="Total em assinaturas" value={formatBRL2(subscriptionSummary.total)} icon={Wallet} color="blue" />
            <StatsCard
              title="Recebido (mês)"
              value={formatBRL2(subscriptionSummary.receivedThisMonth)}
              icon={CheckCircle2}
              color="green"
              description={`${subscriptionSummary.receivedCountThisMonth} assinatura(s)`}
            />
            <StatsCard
              title="Restante (mês)"
              value={formatBRL2(subscriptionSummary.remainingThisMonth)}
              icon={CreditCard}
              color="red"
              description={`${subscriptionSummary.remainingCountThisMonth} assinatura(s)`}
            />
            <StatsCard
              title="Próximo vencimento (mês)"
              value={subscriptionSummary.nextDueInMonthLabel}
              icon={Calendar}
              color={subscriptionSummary.nextDueInMonth ? "purple" : "blue"}
              description={subscriptionSummary.nextDueInMonth ? formatBRL2(subscriptionSummary.nextDueInMonthAmount) : undefined}
            />
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Assinaturas cadastradas</CardTitle>
                  <CardDescription>{subscriptions.length} registro(s)</CardDescription>
                </div>
                <Dialog open={createSubscriptionOpen} onOpenChange={setCreateSubscriptionOpen}>
                  <DialogTrigger asChild>
                    <Button>Criar assinatura</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Criar assinatura</DialogTitle>
                      <DialogDescription>Preencha os dados para criar a assinatura vinculada a um cliente.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Grupo</Label>
                          <Select value={subGroupId} onValueChange={setSubGroupId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um grupo" />
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
                          <Label>Ciclo</Label>
                          <Select value={subCycle} onValueChange={(v) => setSubCycle(v as any)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MONTHLY">Mensal</SelectItem>
                              <SelectItem value="YEARLY">Anual</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nome</Label>
                          <Input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="Ex: Suporte Premium" />
                        </div>
                        <div className="space-y-2">
                          <Label>Preço</Label>
                          <Input
                            value={subPrice}
                            inputMode="numeric"
                            onChange={(e) => setSubPrice(formatCurrencyBRFromDigits(e.target.value))}
                            placeholder="0,00"
                          />
                        </div>
                      </div>

                  <div className="space-y-2">
                    <Label>Dia de vencimento</Label>
                    <Select value={subDueDay} onValueChange={setSubDueDay}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 31 }).map((_, i) => {
                          const v = String(i + 1)
                          return (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                      <div className="space-y-2">
                        <Label>Descrição (opcional)</Label>
                        <Input value={subDescription} onChange={(e) => setSubDescription(e.target.value)} placeholder="Detalhes da assinatura" />
                      </div>

                      <div className="space-y-2">
                        <Label>Cliente</Label>
                        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                          <div className="min-w-0">
                            {selectedClient ? (
                              <div className="text-sm text-muted-foreground truncate">
                                {selectedClient.name} • {selectedClient.email}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">Nenhum cliente selecionado</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button variant="outline" onClick={() => setSelectedClientId(null)} disabled={!selectedClientId}>
                              Limpar
                            </Button>
                            <Dialog open={selectClientOpen} onOpenChange={setSelectClientOpen}>
                              <DialogTrigger asChild>
                                <Button variant="secondary">Selecionar</Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Selecionar cliente</DialogTitle>
                                  <DialogDescription>Escolha o cliente para vincular a esta assinatura.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-3">
                                  <Input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Buscar por nome ou email..." />
                                  <div className="max-h-[320px] overflow-auto rounded-md border p-3">
                                    {filteredClients.length === 0 ? (
                                      <div className="text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
                                    ) : (
                                      <div className="space-y-2">
                                        {filteredClients.map((c) => {
                                          const checked = selectedClientId === c.id
                                          return (
                                            <button
                                              key={c.id}
                                              type="button"
                                              onClick={() => setSelectedClientId(c.id)}
                                              className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                                                checked ? "border-primary bg-primary/10" : "hover:bg-muted/40"
                                              }`}
                                            >
                                              <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                  <div className="text-sm font-medium truncate">{c.name}</div>
                                                  <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                                                </div>
                                                <Checkbox checked={checked} />
                                              </div>
                                            </button>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setSelectClientOpen(false)}>
                                    Fechar
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      if (!selectedClientId) {
                                        toast.error("Selecione um cliente")
                                        return
                                      }
                                      setSelectClientOpen(false)
                                    }}
                                  >
                                    Confirmar
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateSubscriptionOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={createSubscription} disabled={loading}>
                        Criar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {subscriptions.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhuma assinatura cadastrada.</div>
              ) : (
                <div className="space-y-3">
                  {subscriptions.map((s) => {
                    const link = (s.clients || [])[0] || null
                    const clientName = link?.client?.name || "-"
                    const startedAt = link?.startedAt ? new Date(link.startedAt) : null
                    const dueDay = typeof link?.dueDay === "number" ? link.dueDay : null
                    const currentDue =
                      dueDay !== null
                        ? nextChargeDateForClientSubscription({
                            from: new Date(),
                            dueDay,
                            billingCycle: s.billingCycle,
                            startedAt,
                          })
                        : null
                    const now = new Date()
                    const monthYear = now.getFullYear()
                    const monthIndex0 = now.getMonth()
                    const isInThisMonthCycle =
                      s.billingCycle === "MONTHLY" ? true : (startedAt ? startedAt.getMonth() : monthIndex0) === monthIndex0
                    const dueThisMonth = dueDay !== null && isInThisMonthCycle ? dueDateForMonth(monthYear, monthIndex0, dueDay) : null
                    const lastPaidFor = link?.lastPaidFor ? new Date(link.lastPaidFor) : null
                    const isPaid = dueThisMonth ? !!lastPaidFor && dateKey(lastPaidFor) === dateKey(dueThisMonth) : currentDue && lastPaidFor ? dateKey(lastPaidFor) === dateKey(currentDue) : false
                    const nextChargeDate =
                      currentDue && isPaid
                        ? nextChargeDateForClientSubscription({
                            from: new Date(currentDue.getTime() + 24 * 60 * 60 * 1000),
                            dueDay: dueDay as number,
                            billingCycle: s.billingCycle,
                            startedAt,
                          })
                        : dueThisMonth ?? currentDue
                    const nextCharge = nextChargeDate ? formatDateBR(nextChargeDate) : "-"
                    return (
                      <div key={s.id} className="rounded-lg border p-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div className="min-w-0 flex items-start gap-3">
                            <CreditCard className={`mt-0.5 h-5 w-5 ${isPaid ? "text-emerald-500" : "text-red-500"}`} />
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{s.name}</div>
                              <div className="text-sm text-muted-foreground truncate">Cliente: {clientName}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Valor</div>
                              <div className="text-sm font-medium">{formatBRL2(Number(s.price || 0))}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Próx. cobrança</div>
                              <div className="text-sm font-medium">{nextCharge}</div>
                            </div>
                            <div className="flex items-center">
                              <Button
                                variant={isPaid ? "outline" : "secondary"}
                                disabled={!link?.id || isPaid || (!dueThisMonth && !currentDue) || markingPaidId === link?.id}
                                onClick={() => {
                                  if (!link?.id) return
                                  const paidFor = dueThisMonth ?? currentDue
                                  if (!paidFor) return
                                  void markAsPaid(link.id, paidFor)
                                }}
                              >
                                {isPaid ? "Pago" : markingPaidId === link?.id ? "Marcando..." : "Marcar como pago"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard title="Total em assinaturas" value={formatBRL2(subscriptionSummary.total)} icon={Wallet} color="blue" />
            <StatsCard
              title="Recebido (mês)"
              value={formatBRL2(subscriptionSummary.receivedThisMonth)}
              icon={CheckCircle2}
              color="green"
              description={`${subscriptionSummary.receivedCountThisMonth} assinatura(s)`}
            />
            <StatsCard
              title="Restante (mês)"
              value={formatBRL2(subscriptionSummary.remainingThisMonth)}
              icon={CreditCard}
              color="red"
              description={`${subscriptionSummary.remainingCountThisMonth} assinatura(s)`}
            />
            <StatsCard
              title="Próximo vencimento (mês)"
              value={subscriptionSummary.nextDueInMonthLabel}
              icon={Calendar}
              color={subscriptionSummary.nextDueInMonth ? "purple" : "blue"}
              description={subscriptionSummary.nextDueInMonth ? formatBRL2(subscriptionSummary.nextDueInMonthAmount) : undefined}
            />
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Grupos cadastrados</CardTitle>
                  <CardDescription>{groups.length} registro(s)</CardDescription>
                </div>
                <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
                  <DialogTrigger asChild>
                    <Button>Criar grupo</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Criar grupo</DialogTitle>
                      <DialogDescription>Os grupos organizam suas assinaturas (ex.: Planos, Serviços, Pacotes).</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nome</Label>
                          <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Ex: Planos de Suporte" />
                        </div>
                        <div className="space-y-2">
                          <Label>Descrição (opcional)</Label>
                          <Input
                            value={newGroupDescription}
                            onChange={(e) => setNewGroupDescription(e.target.value)}
                            placeholder="Detalhes do grupo"
                          />
                        </div>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateGroupOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={createGroup} disabled={loading}>
                        Criar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {groups.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum grupo cadastrado.</div>
              ) : (
                <div className="space-y-3">
                  {groups.map((g) => (
                    <div key={g.id} className="rounded-lg border p-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{g.name}</div>
                          {g.description ? <div className="text-sm text-muted-foreground truncate">{g.description}</div> : null}
                        </div>
                        <div className="flex items-center gap-3 justify-end">
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">{g._count?.subscriptions ?? 0} assinatura(s)</div>
                            <div className="text-sm font-medium">{formatBRL2(Number(g.totalPrice || 0))}</div>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setActiveGroupId(g.id)
                              setGroupDrawerOpen(true)
                            }}
                          >
                            Ver assinantes
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog
            open={groupDrawerOpen}
            onOpenChange={(open) => {
              setGroupDrawerOpen(open)
              if (!open) setActiveGroupId(null)
            }}
          >
            <DialogContent
              className="fixed right-0 top-0 left-auto h-dvh w-full max-w-[calc(100%-2rem)] translate-x-0 translate-y-0 rounded-none sm:rounded-l-lg sm:max-w-xl overflow-hidden p-0"
            >
              <div className="flex h-full flex-col">
                <div className="border-b p-6">
                  <DialogHeader className="text-left">
                    <DialogTitle>Assinantes do mês</DialogTitle>
                    <DialogDescription>
                      {activeGroupId ? groups.find((g) => g.id === activeGroupId)?.name : ""}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">Recebido (mês)</div>
                      <div className="text-sm font-medium">{formatBRL2(groupMonthSummary.received)}</div>
                      <div className="text-xs text-muted-foreground">{groupMonthSummary.receivedCount} assinatura(s)</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">Restante (mês)</div>
                      <div className="text-sm font-medium">{formatBRL2(groupMonthSummary.remaining)}</div>
                      <div className="text-xs text-muted-foreground">{groupMonthSummary.remainingCount} assinatura(s)</div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-6">
                  {groupSubscriberRows.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhum assinante neste grupo para o mês atual.</div>
                  ) : (
                    <div className="space-y-2">
                      {groupSubscriberRows.map((r) => (
                        <div key={r.key} className="rounded-md border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{r.clientName}</div>
                              <div className="text-xs text-muted-foreground truncate">{r.clientEmail}</div>
                              <div className="mt-1 text-xs text-muted-foreground truncate">
                                {r.subscriptionName} • {r.billingCycle === "MONTHLY" ? "Mensal" : "Anual"}
                              </div>
                              {r.status === "PAID" ? (
                                <div className="mt-1 text-xs text-muted-foreground truncate">
                                  Pago em: {r.paidAt ? formatDateTimeBR(r.paidAt) : "-"}
                                </div>
                              ) : null}
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-medium">{formatBRL2(r.price)}</div>
                              <div className="text-xs text-muted-foreground">
                                Venc.: {r.dueThisMonth ? formatDateBR(r.dueThisMonth) : "-"}
                              </div>
                              <div className="mt-2 flex justify-end">
                                <Badge variant={r.status === "PAID" ? "secondary" : "destructive"}>
                                  {r.status === "PAID" ? "Pago" : "Pendente"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t p-4">
                  <DialogFooter className="sm:justify-end">
                    <Button variant="outline" onClick={() => setGroupDrawerOpen(false)}>
                      Fechar
                    </Button>
                  </DialogFooter>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  )
}

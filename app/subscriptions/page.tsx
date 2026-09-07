"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { CreditCard, ChevronLeft, ChevronRight, Edit, FolderOpen, MoreHorizontal, Plus, RefreshCw, Search, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StatsCard } from "@/components/ui/stats-card"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ClientPicker } from "@/components/clients/client-picker"
import { CurrencyAmount } from "@/components/ui/currency-amount"
import { PageLoadingGate } from "@/components/ui/loading-animation"
import { cn } from "@/lib/utils"
import {
  chargeDueForMonth,
  dateKey,
  isCyclePaid,
  monthEndDate,
  monthStartDate,
  unpaidDueDateForClientSubscription,
  yearMonthKey,
} from "@/lib/subscription-billing"

const PAGE_SIZE = 20

type SubscriptionBillingStatus = "inactive" | "paid" | "pending" | "overdue"
type SubscriptionStatusFilter = "all" | SubscriptionBillingStatus
type SubscriptionCycleFilter = "all" | "MONTHLY" | "YEARLY"

function getSubscriptionBillingStatus(s: Subscription, todayKey: string): SubscriptionBillingStatus {
  if (!s.isActive) return "inactive"
  const link = s.clients?.[0]
  const dueDay = typeof link?.dueDay === "number" ? link.dueDay : null
  if (dueDay === null) return "pending"

  const startedAt = link?.startedAt ? new Date(link.startedAt) : null
  const lastPaidFor = link?.lastPaidFor ? new Date(link.lastPaidFor) : null
  const nextUnpaidDue = unpaidDueDateForClientSubscription({
    dueDay,
    billingCycle: s.billingCycle,
    startedAt,
    lastPaidFor,
    referenceDate: new Date(),
  })

  if (!nextUnpaidDue || dateKey(nextUnpaidDue) > todayKey) return "paid"
  if (dateKey(nextUnpaidDue) < todayKey) return "overdue"
  return "pending"
}

function ListPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
}) {
  if (totalItems === 0) return null

  const rangeStart = (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, totalItems)

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        {rangeStart}–{rangeEnd} de {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Badge variant="outline" className="min-w-[4rem] justify-center font-normal">
          {page} / {totalPages}
        </Badge>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

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

type SubscriptionSummary = {
  total: number
  receivedThisMonth: number
  remainingThisMonth: number
  receivedCountThisMonth: number
  remainingCountThisMonth: number
  nextDueInMonth: Date | null
  nextDueInMonthLabel: string
  nextDueInMonthAmount: number
}

function SubscriptionSummaryCards({ summary }: { summary: SubscriptionSummary }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="Total em assinaturas"
        value={<CurrencyAmount value={summary.total} size="xl" />}
      />
      <StatsCard
        title="Recebido (mês)"
        value={<CurrencyAmount value={summary.receivedThisMonth} size="xl" />}
        description={`${summary.receivedCountThisMonth} assinatura(s)`}
      />
      <StatsCard
        title="Restante (mês)"
        value={<CurrencyAmount value={summary.remainingThisMonth} size="xl" />}
        description={`${summary.remainingCountThisMonth} assinatura(s)`}
      />
      <StatsCard
        title="Próximo vencimento"
        value={summary.nextDueInMonthLabel}
        description={summary.nextDueInMonth ? formatBRL2(summary.nextDueInMonthAmount) : "Sem pendências no mês"}
      />
    </div>
  )
}

export default function SubscriptionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<"subscriptions" | "groups">("subscriptions")
  const [loading, setLoading] = useState(true)
  const [subscriptionSearchTerm, setSubscriptionSearchTerm] = useState("")
  const [groupSearchTerm, setGroupSearchTerm] = useState("")
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<SubscriptionStatusFilter>("all")
  const [subscriptionGroupFilter, setSubscriptionGroupFilter] = useState("all")
  const [subscriptionCycleFilter, setSubscriptionCycleFilter] = useState<SubscriptionCycleFilter>("all")
  const [subscriptionPage, setSubscriptionPage] = useState(1)
  const [groupPage, setGroupPage] = useState(1)
  const todayKey = useMemo(() => dateKey(new Date()), [])
  const [createSubscriptionOpen, setCreateSubscriptionOpen] = useState(false)
  const [editSubscriptionOpen, setEditSubscriptionOpen] = useState(false)
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null)
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)

  const [groups, setGroups] = useState<Group[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])

  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupDescription, setNewGroupDescription] = useState("")

  const [subGroupId, setSubGroupId] = useState("")
  const [subName, setSubName] = useState("")
  const [subDescription, setSubDescription] = useState("")
  const [subPrice, setSubPrice] = useState("0,00")
  const [subCycle, setSubCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY")
  const [subDueDay, setSubDueDay] = useState("10")
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  const [editingSubscriptionId, setEditingSubscriptionId] = useState<string | null>(null)
  const [editGroupId, setEditGroupId] = useState("")
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editPrice, setEditPrice] = useState("0,00")
  const [editCycle, setEditCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY")
  const [editDueDay, setEditDueDay] = useState("10")
  const [editClientId, setEditClientId] = useState<string | null>(null)

  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/auth/signin")
      return
    }
    refreshAll().catch(() => {})
  }, [session, status, router])

  useEffect(() => {
    setSubscriptionPage(1)
  }, [subscriptionSearchTerm, subscriptionStatusFilter, subscriptionGroupFilter, subscriptionCycleFilter])

  useEffect(() => {
    setGroupPage(1)
  }, [groupSearchTerm])

  const refreshAll = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchGroups(), fetchSubscriptions()])
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

  const openEditSubscription = (s: Subscription) => {
    const firstLink = (s.clients || [])[0] || null
    const dueDay = typeof firstLink?.dueDay === "number" ? firstLink.dueDay : 10
    setEditingSubscriptionId(s.id)
    setEditGroupId(s.groupId)
    setEditName(s.name)
    setEditDescription(s.description || "")
    setEditPrice(formatCurrencyBRFromDigits(String(Math.round(Number(s.price || 0) * 100))))
    setEditCycle(s.billingCycle)
    setEditDueDay(String(dueDay))
    setEditClientId(firstLink?.client?.id || null)
    setEditSubscriptionOpen(true)
  }

  const updateSubscription = async () => {
    const subscriptionId = editingSubscriptionId
    if (!subscriptionId) return
    const groupId = editGroupId
    if (!groupId) {
      toast.error("Selecione um grupo")
      return
    }
    const name = editName.trim()
    if (!name) {
      toast.error("Informe o nome da assinatura")
      return
    }
    const parsed = parseCurrencyBRToNumber(editPrice)
    const price = typeof parsed === "number" && Number.isFinite(parsed) && parsed >= 0 ? parsed : null
    if (price === null) {
      toast.error("Preço inválido")
      return
    }
    const dueDay = parseInt(editDueDay, 10)
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
      toast.error("Informe o dia de vencimento (1 a 31)")
      return
    }
    if (!editClientId) {
      toast.error("Selecione o cliente")
      return
    }

    try {
      setLoading(true)
      const res = await fetch("/api/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId,
          groupId,
          name,
          description: editDescription.trim() || null,
          price,
          billingCycle: editCycle,
          dueDay,
          clientId: editClientId,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(err.error || "Erro ao atualizar assinatura")
      }
      const updated = (await res.json().catch(() => null)) as Subscription | null
      if (updated?.id) {
        setSubscriptions((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      } else {
        await fetchSubscriptions()
      }
      toast.success("Assinatura atualizada")
      setEditSubscriptionOpen(false)
      setEditingSubscriptionId(null)
      await fetchGroups()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar assinatura")
    } finally {
      setLoading(false)
    }
  }

  const deleteSubscription = async (s: Subscription) => {
    if (!confirm(`Excluir a assinatura "${s.name}"?`)) return
    try {
      setLoading(true)
      const res = await fetch("/api/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: s.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(err.error || "Erro ao excluir assinatura")
      }
      setSubscriptions((prev) => prev.filter((p) => p.id !== s.id))
      toast.success("Assinatura excluída")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir assinatura")
    } finally {
      setLoading(false)
    }
  }

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
        const due = chargeDueForMonth({
          billingCycle: s.billingCycle,
          isActive: s.isActive,
          linkStatus: link.status,
          dueDay: link.dueDay,
          startedAt: link.startedAt,
          endedAt: link.endedAt,
          year,
          monthIndex0,
        })
        if (!due) continue

        const lastPaidFor = link.lastPaidFor ? new Date(link.lastPaidFor) : null
        const paid = isCyclePaid(lastPaidFor, due)

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
        const dueThisMonth = chargeDueForMonth({
          billingCycle: s.billingCycle,
          isActive: s.isActive,
          linkStatus: link.status,
          dueDay: link.dueDay,
          startedAt: link.startedAt,
          endedAt: link.endedAt,
          year: monthYear,
          monthIndex0,
        })
        if (!dueThisMonth) continue

        const lastPaidFor = link?.lastPaidFor ? new Date(link.lastPaidFor) : null
        const paid = isCyclePaid(lastPaidFor, dueThisMonth)
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

  const filteredSubscriptions = useMemo(() => {
    const q = subscriptionSearchTerm.trim().toLowerCase()
    return subscriptions.filter((s) => {
      const clientName = s.clients?.[0]?.client?.name?.toLowerCase() || ""
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        clientName.includes(q) ||
        (s.group?.name || "").toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q)

      const billingStatus = getSubscriptionBillingStatus(s, todayKey)
      const matchesStatus =
        subscriptionStatusFilter === "all" || billingStatus === subscriptionStatusFilter

      const matchesGroup =
        subscriptionGroupFilter === "all" || s.groupId === subscriptionGroupFilter

      const matchesCycle =
        subscriptionCycleFilter === "all" || s.billingCycle === subscriptionCycleFilter

      return matchesSearch && matchesStatus && matchesGroup && matchesCycle
    })
  }, [
    subscriptions,
    subscriptionSearchTerm,
    subscriptionStatusFilter,
    subscriptionGroupFilter,
    subscriptionCycleFilter,
    todayKey,
  ])

  const filteredGroups = useMemo(() => {
    const q = groupSearchTerm.trim().toLowerCase()
    if (!q) return groups
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.description || "").toLowerCase().includes(q)
    )
  }, [groups, groupSearchTerm])

  const subscriptionTotalPages = Math.max(1, Math.ceil(filteredSubscriptions.length / PAGE_SIZE))
  const safeSubscriptionPage = Math.min(subscriptionPage, subscriptionTotalPages)
  const paginatedSubscriptions = filteredSubscriptions.slice(
    (safeSubscriptionPage - 1) * PAGE_SIZE,
    safeSubscriptionPage * PAGE_SIZE
  )

  const groupTotalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE))
  const safeGroupPage = Math.min(groupPage, groupTotalPages)
  const paginatedGroups = filteredGroups.slice(
    (safeGroupPage - 1) * PAGE_SIZE,
    safeGroupPage * PAGE_SIZE
  )

  const hasSubscriptionFilters =
    subscriptionSearchTerm.trim() !== "" ||
    subscriptionStatusFilter !== "all" ||
    subscriptionGroupFilter !== "all" ||
    subscriptionCycleFilter !== "all"

  const clearSubscriptionFilters = () => {
    setSubscriptionSearchTerm("")
    setSubscriptionStatusFilter("all")
    setSubscriptionGroupFilter("all")
    setSubscriptionCycleFilter("all")
  }

  return (
    <PageLoadingGate loading={loading && subscriptions.length === 0 && groups.length === 0}>
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Assinaturas</h1>
          <p className="text-muted-foreground">Grupos, planos recorrentes e cobrança mensal por cliente.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={refreshAll} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </Button>
          {activeTab === "subscriptions" ? (
            <Button size="sm" className="h-9" onClick={() => setCreateSubscriptionOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova assinatura
            </Button>
          ) : (
            <Button size="sm" className="h-9" onClick={() => setCreateGroupOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo grupo
            </Button>
          )}
        </div>
      </div>

      <SubscriptionSummaryCards summary={subscriptionSummary} />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "subscriptions" | "groups")}>
        <TabsList>
          <TabsTrigger value="subscriptions" className="gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            Assinaturas
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" />
            Grupos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="mt-4 space-y-4">
          <Card className="gap-0 overflow-hidden py-0 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <CardHeader className="border-b border-border px-4 py-3">
              <div className="space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base">Assinaturas cadastradas</CardTitle>
                    <CardDescription className="mt-0.5">
                      {filteredSubscriptions.length} de {subscriptions.length} registro(s)
                      {hasSubscriptionFilters ? " · filtros ativos" : ""}
                    </CardDescription>
                  </div>
                  {hasSubscriptionFilters ? (
                    <Button variant="ghost" size="sm" className="h-8 self-start text-xs" onClick={clearSubscriptionFilters}>
                      Limpar filtros
                    </Button>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_140px_160px_120px]">
                  <div className="relative min-w-0">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar assinatura ou cliente..."
                      value={subscriptionSearchTerm}
                      onChange={(e) => setSubscriptionSearchTerm(e.target.value)}
                      className="h-9 pl-9"
                    />
                  </div>
                  <Select
                    value={subscriptionStatusFilter}
                    onValueChange={(v) => setSubscriptionStatusFilter(v as SubscriptionStatusFilter)}
                  >
                    <SelectTrigger size="sm" className="h-9 w-full">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos status</SelectItem>
                      <SelectItem value="paid">Em dia</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="overdue">Vencido</SelectItem>
                      <SelectItem value="inactive">Inativa</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={subscriptionGroupFilter} onValueChange={setSubscriptionGroupFilter}>
                    <SelectTrigger size="sm" className="h-9 w-full">
                      <SelectValue placeholder="Grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos grupos</SelectItem>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={subscriptionCycleFilter}
                    onValueChange={(v) => setSubscriptionCycleFilter(v as SubscriptionCycleFilter)}
                  >
                    <SelectTrigger size="sm" className="h-9 w-full">
                      <SelectValue placeholder="Ciclo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos ciclos</SelectItem>
                      <SelectItem value="MONTHLY">Mensal</SelectItem>
                      <SelectItem value="YEARLY">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {filteredSubscriptions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CreditCard className="mb-2 h-8 w-8 text-muted-foreground/35" />
                  <p className="text-sm font-medium text-foreground">
                    {subscriptions.length === 0
                      ? "Nenhuma assinatura cadastrada"
                      : hasSubscriptionFilters
                        ? "Nenhum resultado com os filtros atuais"
                        : "Nenhum resultado na busca"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {subscriptions.length === 0
                      ? "Crie a primeira assinatura para começar a cobrar"
                      : hasSubscriptionFilters
                        ? "Ajuste ou limpe os filtros para ver mais resultados"
                        : "Tente outro termo de busca"}
                  </p>
                </div>
              ) : (
                <>
                <div className="space-y-2">
                  {paginatedSubscriptions.map((s) => {
                    const link = (s.clients || [])[0] || null
                    const clientName = link?.client?.name || "—"
                    const startedAt = link?.startedAt ? new Date(link.startedAt) : null
                    const dueDay = typeof link?.dueDay === "number" ? link.dueDay : null
                    const lastPaidFor = link?.lastPaidFor ? new Date(link.lastPaidFor) : null
                    const now = new Date()

                    const nextUnpaidDue =
                      dueDay !== null
                        ? unpaidDueDateForClientSubscription({
                            dueDay,
                            billingCycle: s.billingCycle,
                            startedAt,
                            lastPaidFor,
                            referenceDate: now,
                          })
                        : null

                    const billingStatus = getSubscriptionBillingStatus(s, todayKey)
                    const isPaid = billingStatus === "paid" || billingStatus === "inactive"
                    const nextCharge = nextUnpaidDue ? formatDateBR(nextUnpaidDue) : "—"

                    return (
                      <div
                        key={s.id}
                        className="rounded-lg border border-border/70 bg-card p-4 transition-colors hover:bg-muted/20"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">{s.name}</p>
                              {s.group?.name ? (
                                <Badge variant="secondary" className="text-[10px] font-normal">
                                  {s.group.name}
                                </Badge>
                              ) : null}
                              <Badge variant="outline" className="text-[10px] font-normal">
                                {s.billingCycle === "MONTHLY" ? "Mensal" : "Anual"}
                              </Badge>
                              {!s.isActive ? (
                                <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                                  Inativa
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{clientName}</p>
                            {s.description ? (
                              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{s.description}</p>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap items-end gap-4 lg:shrink-0">
                            <div className="text-right">
                              <p className="text-[11px] text-muted-foreground">Valor</p>
                              <CurrencyAmount value={Number(s.price || 0)} size="sm" />
                            </div>
                            <div className="text-right">
                              <p className="text-[11px] text-muted-foreground">Próx. cobrança</p>
                              <p className="text-sm font-medium tabular-nums">{nextCharge}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-normal",
                                  billingStatus === "inactive"
                                    ? "border-border bg-muted/50 text-muted-foreground"
                                    : billingStatus === "paid"
                                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                      : billingStatus === "overdue"
                                        ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                                        : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                                )}
                              >
                                {billingStatus === "inactive"
                                  ? "Inativa"
                                  : billingStatus === "paid"
                                    ? "Em dia"
                                    : billingStatus === "overdue"
                                      ? "Vencido"
                                      : "Pendente"}
                              </Badge>
                              {!isPaid && billingStatus !== "inactive" && link?.id && nextUnpaidDue ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  disabled={markingPaidId === link.id}
                                  onClick={() => void markAsPaid(link.id, nextUnpaidDue)}
                                >
                                  {markingPaidId === link.id ? "Marcando..." : "Marcar pago"}
                                </Button>
                              ) : null}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon-sm" className="h-7 w-7">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditSubscription(s)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => void deleteSubscription(s)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <ListPagination
                  page={safeSubscriptionPage}
                  totalPages={subscriptionTotalPages}
                  totalItems={filteredSubscriptions.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setSubscriptionPage}
                />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="mt-4 space-y-4">
          <Card className="gap-0 overflow-hidden py-0 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <CardHeader className="border-b border-border px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Grupos cadastrados</CardTitle>
                  <CardDescription className="mt-0.5">
                    {filteredGroups.length} de {groups.length} registro(s)
                  </CardDescription>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar grupo..."
                    value={groupSearchTerm}
                    onChange={(e) => setGroupSearchTerm(e.target.value)}
                    className="h-9 pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {filteredGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderOpen className="mb-2 h-8 w-8 text-muted-foreground/35" />
                  <p className="text-sm font-medium text-foreground">
                    {groups.length === 0 ? "Nenhum grupo cadastrado" : "Nenhum resultado na busca"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {groups.length === 0
                      ? "Organize assinaturas em grupos como Planos ou Serviços"
                      : "Tente outro termo de busca"}
                  </p>
                </div>
              ) : (
                <>
                <div className="space-y-2">
                  {paginatedGroups.map((g) => (
                    <div
                      key={g.id}
                      className="rounded-lg border border-border/70 bg-card p-4 transition-colors hover:bg-muted/20"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground">{g.name}</p>
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              {g._count?.subscriptions ?? 0} assinatura(s)
                            </Badge>
                          </div>
                          {g.description ? (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{g.description}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-4">
                          <div className="text-right">
                            <p className="text-[11px] text-muted-foreground">Total do grupo</p>
                            <CurrencyAmount value={Number(g.totalPrice || 0)} size="sm" />
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => {
                              setActiveGroupId(g.id)
                              setGroupDrawerOpen(true)
                            }}
                          >
                            <Users className="h-3.5 w-3.5" />
                            Assinantes
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <ListPagination
                  page={safeGroupPage}
                  totalPages={groupTotalPages}
                  totalItems={filteredGroups.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setGroupPage}
                />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={createSubscriptionOpen} onOpenChange={setCreateSubscriptionOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova assinatura</DialogTitle>
            <DialogDescription>Preencha os dados para criar a assinatura vinculada a um cliente.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                <Select value={subCycle} onValueChange={(v) => setSubCycle(v as "MONTHLY" | "YEARLY")}>
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <ClientPicker
                value={selectedClientId || ""}
                onChange={(id) => setSelectedClientId(id ? id : null)}
                placeholder="Selecione um cliente"
              />
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

      <Dialog open={editSubscriptionOpen} onOpenChange={setEditSubscriptionOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar assinatura</DialogTitle>
            <DialogDescription>Atualize os dados da assinatura e o dia de vencimento.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Grupo</Label>
                <Select value={editGroupId} onValueChange={setEditGroupId}>
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
                <Select value={editCycle} onValueChange={(v) => setEditCycle(v as "MONTHLY" | "YEARLY")}>
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <ClientPicker
                  value={editClientId || ""}
                  onChange={(id) => setEditClientId(id ? id : null)}
                  placeholder="Selecione um cliente"
                />
              </div>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Ex: Suporte Premium" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Preço</Label>
                <Input
                  value={editPrice}
                  inputMode="numeric"
                  onChange={(e) => setEditPrice(formatCurrencyBRFromDigits(e.target.value))}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Dia de vencimento</Label>
                <Select value={editDueDay} onValueChange={setEditDueDay}>
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
            </div>

            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Detalhes da assinatura"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditSubscriptionOpen(false)
                setEditingSubscriptionId(null)
              }}
            >
              Cancelar
            </Button>
            <Button onClick={updateSubscription} disabled={loading || !editingSubscriptionId}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo grupo</DialogTitle>
            <DialogDescription>Organize assinaturas em grupos (ex.: Planos, Serviços, Pacotes).</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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

      <Dialog
        open={groupDrawerOpen}
        onOpenChange={(open) => {
          setGroupDrawerOpen(open)
          if (!open) setActiveGroupId(null)
        }}
      >
        <DialogContent className="fixed right-0 top-0 left-auto h-dvh w-full max-w-[calc(100%-2rem)] translate-x-0 translate-y-0 overflow-hidden rounded-none p-0 sm:max-w-xl sm:rounded-l-lg">
          <div className="flex h-full flex-col">
            <div className="border-b p-6">
              <DialogHeader className="text-left">
                <DialogTitle>Assinantes do mês</DialogTitle>
                <DialogDescription>
                  {activeGroupId ? groups.find((g) => g.id === activeGroupId)?.name : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <p className="text-[11px] font-medium text-muted-foreground">Recebido</p>
                  <CurrencyAmount value={groupMonthSummary.received} size="sm" className="mt-1" />
                  <p className="mt-1 text-xs text-muted-foreground">{groupMonthSummary.receivedCount} assinatura(s)</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <p className="text-[11px] font-medium text-muted-foreground">Restante</p>
                  <CurrencyAmount value={groupMonthSummary.remaining} size="sm" className="mt-1" />
                  <p className="mt-1 text-xs text-muted-foreground">{groupMonthSummary.remainingCount} assinatura(s)</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {groupSubscriberRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Users className="mb-2 h-8 w-8 text-muted-foreground/35" />
                  <p className="text-sm text-muted-foreground">Nenhum assinante neste grupo para o mês atual.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {groupSubscriberRows.map((r) => (
                    <div key={r.key} className="rounded-lg border border-border/70 bg-card p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{r.clientName}</p>
                          <p className="truncate text-xs text-muted-foreground">{r.clientEmail}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {r.subscriptionName} · {r.billingCycle === "MONTHLY" ? "Mensal" : "Anual"}
                          </p>
                          {r.status === "PAID" && r.paidAt ? (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Pago em {formatDateTimeBR(r.paidAt)}
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <CurrencyAmount value={r.price} size="sm" />
                          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                            Venc. {r.dueThisMonth ? formatDateBR(r.dueThisMonth) : "—"}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "mt-2 text-[10px] font-normal",
                              r.status === "PAID"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                            )}
                          >
                            {r.status === "PAID" ? "Pago" : "Pendente"}
                          </Badge>
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
    </div>
    </PageLoadingGate>
  )
}

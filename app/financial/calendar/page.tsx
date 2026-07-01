"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { Calendar as RBCalendar, dateFnsLocalizer, Views } from "react-big-calendar"
import { format, parse, startOfWeek, getDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import "react-big-calendar/lib/css/react-big-calendar.css"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatsCard } from "@/components/ui/stats-card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Calendar as CalendarIcon, Plus, TrendingDown, TrendingUp, Wallet, MoreHorizontal } from "lucide-react"
import { AddPaymentDialog } from "@/components/payments/add-payment-dialog"

const locales = {
  "pt-BR": ptBR,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

type Subscription = {
  id: string
  name: string
  price: number
  billingCycle: "MONTHLY" | "YEARLY"
  isActive: boolean
  group?: { id: string; name: string } | null
  clients: Array<{
    id: string
    dueDay: number
    lastPaidFor?: string | null
    paidAt?: string | null
    status?: string
    startedAt?: string | null
    endedAt?: string | null
    client: { id: string; name: string; email?: string | null }
  }>
}

type ChargeSource = "SUBSCRIPTION" | "PAYMENT" | "EXPENSE"
type ChargeStatus = "PAID" | "PENDING" | "RECEIVED"

type FinancialEntryRow = {
  id: string
  type: "INCOME" | "EXPENSE"
  category: string
  description: string
  amount: number
  date: string
  isRecurring?: boolean
  recurringType?: string | null
  projectName?: string | null
  paymentId?: string | null
  clientSubscriptionId?: string | null
  expenseBillId?: string | null
}

type FinancialChargeEvent = {
  id: string
  paymentId?: string | null
  clientSubscriptionId?: string | null
  financialEntryId?: string | null
  expenseBillId?: string | null
  isRecurring?: boolean
  recurringType?: string | null
  title: string
  start: Date
  end: Date
  allDay: boolean
  source: ChargeSource
  status: ChargeStatus
  amount: number
  dueDate: Date
  clientName: string
  subscriptionName: string
  groupName?: string | null
  paidAt?: Date | null
  manualDescription?: string | null
  projectName?: string | null
}

type CalendarDayTotalEvent = {
  id: string
  title: string
  start: Date
  end: Date
  allDay: boolean
  status: "OK" | "ATTENTION" | "OVERDUE"
  receiveAmount: number
  receiveCount: number
  receivedAmount: number
  receivedCount: number
  payAmount: number
  payCount: number
  payRecurringCount: number
  paidExpenseAmount: number
  paidExpenseCount: number
}

function formatBRL2(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatCurrencyBRFromDigits(digits: string) {
  const cleaned = (digits || "").replace(/\D/g, "")
  const padded = cleaned.replace(/^0+/, "") || "0"
  const cents = parseInt(padded, 10)
  const value = cents / 100
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatCurrencyBRFromNumber(value: number) {
  const cents = Math.round((Number(value) || 0) * 100)
  return formatCurrencyBRFromDigits(String(cents))
}

function parseCurrencyBRToNumber(value: string) {
  const digits = (value || "").replace(/\D/g, "")
  if (!digits) return null
  const cents = parseInt(digits, 10)
  if (!Number.isFinite(cents)) return null
  return cents / 100
}

function daysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate()
}

function dueDateForMonth(year: number, monthIndex0: number, dueDay: number) {
  const dim = daysInMonth(year, monthIndex0)
  const day = Math.min(Math.max(1, dueDay), dim)
  return new Date(year, monthIndex0, day, 12, 0, 0, 0)
}

function dateKey(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function paidForIsoFromDate(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}T12:00:00.000Z`
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

  if (s.billingCycle === "MONTHLY") return due

  const cycleMonth = startedAt ? startedAt.getMonth() : monthIndex0
  if (cycleMonth !== monthIndex0) return null
  return due
}

export default function FinancialCalendarPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const todayKey = useMemo(() => dateKey(new Date()), [])

  const [loading, setLoading] = useState(true)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [payments, setPayments] = useState<Array<{
    id: string
    amount: number
    description?: string | null
    paymentDate: string
    status: string
    method?: string | null
    client: { id: string; name: string; email: string; company?: string | null }
    paymentProjects?: Array<{ id: string; amount: number; project: { id: string; name: string } }>
  }>>([])
  const [financialEntries, setFinancialEntries] = useState<FinancialEntryRow[]>([])
  const [expenseOccurrences, setExpenseOccurrences] = useState<Array<{
    id: string
    billId: string
    category: string
    description: string
    amount: number
    projectName?: string | null
    isRecurring: boolean
    recurringType?: string | null
    dueDay: number
    dueDate: string
    status: "PENDING" | "PAID"
    financialEntryId?: string | null
    paidAt?: string | null
  }>>([])
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [addChargeOpen, setAddChargeOpen] = useState(false)
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [sendingDailyEmail, setSendingDailyEmail] = useState(false)
  const [markingReceivedId, setMarkingReceivedId] = useState<string | null>(null)
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null)
  const [markingExpensePaidId, setMarkingExpensePaidId] = useState<string | null>(null)
  const [creatingExpense, setCreatingExpense] = useState(false)
  const [paymentToEdit, setPaymentToEdit] = useState<{
    id: string
    clientId: string
    amount: number
    description?: string | null
    paymentDate: string
    method?: string | null
  } | undefined>(undefined)
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)
  const [expenseToEdit, setExpenseToEdit] = useState<{
    id: string
    category: string
    description: string
    amount: number
    dueDate: string
    isRecurring: boolean
    recurringType?: "MONTHLY" | "QUARTERLY" | "YEARLY"
    dueDay?: string
  } | undefined>(undefined)
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null)
  const [expenseForm, setExpenseForm] = useState({
    category: "",
    description: "",
    amount: "",
    dueDate: format(new Date(), "yyyy-MM-dd"),
    isRecurring: false,
    recurringType: "MONTHLY" as "MONTHLY" | "QUARTERLY" | "YEARLY",
    dueDay: String(new Date().getDate()).padStart(2, "0"),
  })

  useEffect(() => {
    if (!addExpenseOpen) return
    if (expenseToEdit) {
      setExpenseForm({
        category: expenseToEdit.category,
        description: expenseToEdit.description,
        amount: formatCurrencyBRFromNumber(expenseToEdit.amount),
        dueDate: expenseToEdit.dueDate.split('T')[0],
        isRecurring: expenseToEdit.isRecurring,
        recurringType: expenseToEdit.recurringType || "MONTHLY",
        dueDay: expenseToEdit.dueDay || String(selectedDate.getDate()).padStart(2, "0"),
      })
    } else {
      setExpenseForm({
        category: "",
        description: "",
        amount: "",
        dueDate: format(selectedDate, "yyyy-MM-dd"),
        isRecurring: false,
        recurringType: "MONTHLY",
        dueDay: String(selectedDate.getDate()).padStart(2, "0"),
      })
    }
  }, [addExpenseOpen, selectedDate, expenseToEdit])

  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/auth/signin")
      return
    }
    fetchSubscriptions()
  }, [session, status, router])

  useEffect(() => {
    if (status === "loading") return
    if (!session) return
    fetchPayments()
  }, [session, status, calendarDate])

  useEffect(() => {
    if (status === "loading") return
    if (!session) return
    fetchFinancialEntries()
  }, [session, status, calendarDate])

  useEffect(() => {
    if (status === "loading") return
    if (!session) return
    fetchExpenseOccurrences()
  }, [session, status, calendarDate])

  const fetchSubscriptions = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/subscriptions")
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(err.error || "Falha ao carregar assinaturas")
      }
      const data = await res.json()
      setSubscriptions(Array.isArray(data.subscriptions) ? data.subscriptions : [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar calendário financeiro")
      setSubscriptions([])
    } finally {
      setLoading(false)
    }
  }

  const fetchPayments = async () => {
    try {
      const y = calendarDate.getFullYear()
      const m = calendarDate.getMonth()
      const start = new Date(y, m, 1)
      const end = new Date(y, m + 1, 0)
      const params = new URLSearchParams()
      params.set("page", "1")
      params.set("limit", "1000")
      params.set("startDate", format(start, "yyyy-MM-dd"))
      params.set("endDate", format(end, "yyyy-MM-dd"))

      const res = await fetch(`/api/payments?${params.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(err.error || "Falha ao carregar cobranças avulsas")
      }
      const data = await res.json()
      setPayments(Array.isArray(data.payments) ? data.payments : [])
    } catch {
      setPayments([])
    }
  }

  const fetchFinancialEntries = async () => {
    try {
      const y = calendarDate.getFullYear()
      const m = calendarDate.getMonth()
      const start = new Date(y, m, 1)
      const end = new Date(y, m + 1, 0)
      const params = new URLSearchParams()
      params.set("page", "1")
      params.set("limit", "2000")
      params.set("startDate", format(start, "yyyy-MM-dd"))
      params.set("endDate", format(end, "yyyy-MM-dd"))

      const res = await fetch(`/api/financial?${params.toString()}`)
      if (!res.ok) {
        setFinancialEntries([])
        return
      }
      const data = await res.json().catch(() => ({} as any))
      setFinancialEntries(Array.isArray(data.entries) ? data.entries : [])
    } catch {
      setFinancialEntries([])
    }
  }

  const fetchExpenseOccurrences = async () => {
    try {
      const y = calendarDate.getFullYear()
      const m = calendarDate.getMonth() + 1
      const params = new URLSearchParams()
      params.set("year", String(y))
      params.set("month", String(m))

      const res = await fetch(`/api/expenses?${params.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(err.error || "Falha ao carregar despesas")
      }
      const data = await res.json().catch(() => ({} as any))
      setExpenseOccurrences(Array.isArray(data.occurrences) ? data.occurrences : [])
    } catch {
      setExpenseOccurrences([])
    }
  }

  const recurringLabel = (t?: string | null) => {
    const v = (t || "").toUpperCase()
    if (v === "YEARLY") return "Anual"
    if (v === "QUARTERLY") return "Trimestral"
    return "Mensal"
  }

  const createExpenseBill = async () => {
    try {
      const category = expenseForm.category.trim()
      const description = expenseForm.description.trim()
      const amount = parseCurrencyBRToNumber(expenseForm.amount)
      if (!category || !description || !amount || amount <= 0) {
        toast.error("Preencha categoria, descrição e valor")
        return
      }

      const isRecurring = expenseForm.isRecurring === true
      const dueDay = Math.min(Math.max(1, Number(expenseForm.dueDay)), 31)

      const payload: any = {
        category,
        description,
        amount,
        isRecurring,
      }

      if (isRecurring) {
        payload.recurringType = expenseForm.recurringType
        payload.dueDay = dueDay
        payload.startDate = paidForIsoFromDate(selectedDate)
      } else {
        payload.dueDate = `${expenseForm.dueDate}T12:00:00.000Z`
      }

      setCreatingExpense(true)
      const res = expenseToEdit
        ? await fetch("/api/expenses", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              billId: expenseToEdit.id,
              ...payload,
            }),
          })
        : await fetch("/api/expenses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(err.error || "Falha ao salvar despesa")
      }

      toast.success(expenseToEdit ? "Despesa atualizada" : "Despesa cadastrada")
      setAddExpenseOpen(false)
      setExpenseToEdit(undefined)
      fetchExpenseOccurrences()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar despesa")
    } finally {
      setCreatingExpense(false)
    }
  }

  const markPaymentAsReceived = async (paymentId: string) => {
    try {
      setMarkingReceivedId(paymentId)
      const res = await fetch("/api/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, markAsReceived: true }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(err.error || "Falha ao marcar como recebido")
      }
      toast.success("Cobrança marcada como recebida")
      fetchPayments()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao marcar como recebido")
    } finally {
      setMarkingReceivedId(null)
    }
  }

  const deletePayment = async (paymentId: string) => {
    try {
      setDeletingPaymentId(paymentId)
      const res = await fetch("/api/payments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(err.error || "Falha ao excluir cobrança")
      }
      toast.success("Cobrança excluída")
      fetchPayments()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir cobrança")
    } finally {
      setDeletingPaymentId(null)
    }
  }

  const deleteExpense = async (billId: string) => {
    try {
      setDeletingExpenseId(billId)
      const res = await fetch("/api/expenses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(err.error || "Falha ao excluir despesa")
      }
      toast.success("Despesa excluída")
      fetchExpenseOccurrences()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir despesa")
    } finally {
      setDeletingExpenseId(null)
    }
  }

  const markSubscriptionAsPaid = async (clientSubscriptionId: string, dueDate: Date) => {
    try {
      setMarkingPaidId(clientSubscriptionId)
      const res = await fetch("/api/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientSubscriptionId, paidForDate: paidForIsoFromDate(dueDate) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(err.error || "Falha ao marcar como pago")
      }
      toast.success("Assinatura marcada como paga")
      fetchSubscriptions()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao marcar como pago")
    } finally {
      setMarkingPaidId(null)
    }
  }

  const markExpenseAsPaid = async (billId: string, dueDate: Date) => {
    const key = `${billId}:${dateKey(dueDate)}`
    try {
      setMarkingExpensePaidId(key)
      const res = await fetch("/api/expenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId, dueDate: paidForIsoFromDate(dueDate) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(err.error || "Falha ao marcar despesa como paga")
      }
      toast.success("Despesa marcada como paga")
      fetchExpenseOccurrences()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao marcar despesa como paga")
    } finally {
      setMarkingExpensePaidId(null)
    }
  }

  const sendDailyEmail = async (date: Date) => {
    try {
      setSendingDailyEmail(true)
      const payload = { date: format(date, "yyyy-MM-dd") }
      const res = await fetch("/api/financial/daily-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(err.error || "Falha ao enviar e-mail")
      }
      toast.success("Resumo enviado por e-mail")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar e-mail")
    } finally {
      setSendingDailyEmail(false)
    }
  }

  const chargeEvents = useMemo(() => {
    const year = calendarDate.getFullYear()
    const monthIndex0 = calendarDate.getMonth()

    const out: FinancialChargeEvent[] = []
    for (const s of subscriptions) {
      for (const link of s.clients || []) {
        const due = chargeDueForMonth({ subscription: s, link, year, monthIndex0 })
        if (!due) continue

        const paidFor = link.lastPaidFor ? new Date(link.lastPaidFor) : null
        const paidAt = link.paidAt ? new Date(link.paidAt) : null
        const isPaid = paidFor ? dateKey(paidFor) === dateKey(due) : false
        const status: ChargeStatus = isPaid ? "PAID" : "PENDING"
        const amount = typeof s.price === "number" ? s.price : 0

        out.push({
          id: `${s.id}:${link.id}:${dateKey(due)}`,
          paymentId: null,
          clientSubscriptionId: link.id,
          financialEntryId: null,
          expenseBillId: null,
          isRecurring: false,
          recurringType: null,
          title: `${link.client?.name || "Cliente"} · ${formatBRL2(amount)}`,
          start: due,
          end: new Date(due.getTime() + 60 * 60 * 1000),
          allDay: true,
          source: "SUBSCRIPTION",
          status,
          amount,
          dueDate: due,
          clientName: link.client?.name || "Cliente",
          subscriptionName: s.name,
          groupName: s.group?.name ?? null,
          paidAt: isPaid ? paidAt : null,
          manualDescription: null,
          projectName: null,
        })
      }
    }

    for (const p of payments) {
      const d = new Date(p.paymentDate)
      const status =
        (p.status || "").toUpperCase() === "COMPLETED"
          ? ("RECEIVED" as const)
          : (p.status || "").toUpperCase() === "CANCELLED" || (p.status || "").toUpperCase() === "FAILED"
            ? null
            : ("PENDING" as const)
      if (!status) continue

      const clientName = p.client?.company || p.client?.name || "Cliente"
      const projectNames = (p.paymentProjects || []).map(pp => pp.project?.name).filter(Boolean)
      const projectsLabel = projectNames.length ? projectNames.join(", ") : null

      out.push({
        id: `payment:${p.id}`,
        paymentId: p.id,
        clientSubscriptionId: null,
        financialEntryId: null,
        expenseBillId: null,
        isRecurring: false,
        recurringType: null,
        title: `${clientName} · ${formatBRL2(p.amount)}`,
        start: d,
        end: new Date(d.getTime() + 60 * 60 * 1000),
        allDay: true,
        source: "PAYMENT",
        status,
        amount: p.amount,
        dueDate: d,
        clientName,
        subscriptionName: "Cobrança avulsa",
        groupName: projectsLabel,
        paidAt: null,
        manualDescription: p.description || null,
        projectName: projectsLabel,
      })
    }

    for (const o of expenseOccurrences) {
      const due = new Date(o.dueDate)
      out.push({
        id: `expense:${o.id}`,
        paymentId: null,
        clientSubscriptionId: null,
        financialEntryId: o.financialEntryId ?? null,
        expenseBillId: o.billId,
        isRecurring: o.isRecurring,
        recurringType: o.recurringType ?? null,
        title: `${o.category || "Despesa"} · ${formatBRL2(o.amount)}`,
        start: due,
        end: new Date(due.getTime() + 60 * 60 * 1000),
        allDay: true,
        source: "EXPENSE",
        status: o.status === "PAID" ? "PAID" : "PENDING",
        amount: o.amount,
        dueDate: due,
        clientName: o.category || "Despesa",
        subscriptionName: o.description,
        groupName: o.projectName ?? null,
        paidAt: o.paidAt ? new Date(o.paidAt) : null,
        manualDescription: null,
        projectName: o.projectName ?? null,
      })
    }

    out.sort((a, b) => a.start.getTime() - b.start.getTime())
    return out
  }, [subscriptions, payments, expenseOccurrences, calendarDate])

  const calendarEvents = useMemo(() => {
    const byDay = new Map<
      string,
      {
        receiveAmount: number
        receiveCount: number
        receivedAmount: number
        receivedCount: number
        payAmount: number
        payCount: number
        payRecurringCount: number
        paidExpenseAmount: number
        paidExpenseCount: number
        date: Date
      }
    >()

    for (const e of chargeEvents) {
      const key = dateKey(e.start)
      const existing = byDay.get(key)
      if (existing) {
        if (e.source === "EXPENSE") {
          if (e.status === "PENDING") {
            existing.payAmount += e.amount
            existing.payCount += 1
            if (e.isRecurring) existing.payRecurringCount += 1
          } else if (e.status === "PAID") {
            existing.paidExpenseAmount += e.amount
            existing.paidExpenseCount += 1
          }
        } else if (e.status === "PENDING") {
          existing.receiveAmount += e.amount
          existing.receiveCount += 1
        } else if (e.status === "PAID" || e.status === "RECEIVED") {
          existing.receivedAmount += e.amount
          existing.receivedCount += 1
        }
      } else {
        byDay.set(key, {
          receiveAmount: e.source !== "EXPENSE" && e.status === "PENDING" ? e.amount : 0,
          receiveCount: e.source !== "EXPENSE" && e.status === "PENDING" ? 1 : 0,
          receivedAmount: e.source !== "EXPENSE" && (e.status === "PAID" || e.status === "RECEIVED") ? e.amount : 0,
          receivedCount: e.source !== "EXPENSE" && (e.status === "PAID" || e.status === "RECEIVED") ? 1 : 0,
          payAmount: e.source === "EXPENSE" && e.status === "PENDING" ? e.amount : 0,
          payCount: e.source === "EXPENSE" && e.status === "PENDING" ? 1 : 0,
          payRecurringCount: e.source === "EXPENSE" && e.status === "PENDING" && e.isRecurring ? 1 : 0,
          paidExpenseAmount: e.source === "EXPENSE" && e.status === "PAID" ? e.amount : 0,
          paidExpenseCount: e.source === "EXPENSE" && e.status === "PAID" ? 1 : 0,
          date: new Date(e.start.getFullYear(), e.start.getMonth(), e.start.getDate(), 12, 0, 0, 0),
        })
      }
    }

    for (const fe of financialEntries) {
      if (fe.paymentId || fe.clientSubscriptionId || fe.expenseBillId) continue
      if (!fe.date) continue
      const d = new Date(`${fe.date}T12:00:00`)
      if (!Number.isFinite(d.getTime())) continue
      const key = dateKey(d)
      const existing = byDay.get(key)
      if (existing) {
        if (fe.type === "INCOME") {
          existing.receivedAmount += fe.amount
          existing.receivedCount += 1
        } else {
          existing.paidExpenseAmount += fe.amount
          existing.paidExpenseCount += 1
        }
      } else {
        byDay.set(key, {
          receiveAmount: 0,
          receiveCount: 0,
          receivedAmount: fe.type === "INCOME" ? fe.amount : 0,
          receivedCount: fe.type === "INCOME" ? 1 : 0,
          payAmount: 0,
          payCount: 0,
          payRecurringCount: 0,
          paidExpenseAmount: fe.type === "EXPENSE" ? fe.amount : 0,
          paidExpenseCount: fe.type === "EXPENSE" ? 1 : 0,
          date: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0),
        })
      }
    }

    const out: CalendarDayTotalEvent[] = []
    for (const [key, v] of byDay.entries()) {
      const hasPending = v.receiveCount > 0 || v.payCount > 0
      const overdue = hasPending && key < todayKey
      const status: CalendarDayTotalEvent["status"] = overdue ? "OVERDUE" : hasPending ? "ATTENTION" : "OK"

      const parts: string[] = []
      if (v.receiveCount > 0) parts.push(`Receber ${formatBRL2(v.receiveAmount)} (${v.receiveCount})`)
      if (v.payCount > 0) parts.push(`Pagar ${formatBRL2(v.payAmount)} (${v.payCount})`)
      if (!parts.length) {
        if (v.receivedCount > 0) parts.push(`${formatBRL2(v.receivedAmount)} (${v.receivedCount})`)
        else if (v.paidExpenseCount > 0) parts.push(`Pago ${formatBRL2(v.paidExpenseAmount)} (${v.paidExpenseCount})`)
        else parts.push("R$ 0,00")
      }

      out.push({
        id: `day:${key}`,
        title: parts.join(" · "),
        start: v.date,
        end: new Date(v.date.getTime() + 60 * 60 * 1000),
        allDay: true,
        status,
        receiveAmount: v.receiveAmount,
        receiveCount: v.receiveCount,
        receivedAmount: v.receivedAmount,
        receivedCount: v.receivedCount,
        payAmount: v.payAmount,
        payCount: v.payCount,
        payRecurringCount: v.payRecurringCount,
        paidExpenseAmount: v.paidExpenseAmount,
        paidExpenseCount: v.paidExpenseCount,
      })
    }
    out.sort((a, b) => a.start.getTime() - b.start.getTime())
    return out
  }, [chargeEvents, financialEntries, todayKey])

  const monthSummary = useMemo(() => {
    const income = chargeEvents.filter(e => e.source !== "EXPENSE")
    const total = income.reduce((acc, e) => acc + e.amount, 0)
    const received = income.filter(e => e.status === "PAID" || e.status === "RECEIVED").reduce((acc, e) => acc + e.amount, 0)
    const remaining = total - received
    const nextDue = income
      .filter(e => e.status === "PENDING")
      .map(e => e.dueDate)
      .sort((a, b) => a.getTime() - b.getTime())[0]

    return { total, received, remaining, nextDue }
  }, [chargeEvents])

  const selectedKey = useMemo(() => dateKey(selectedDate), [selectedDate])
  const dayCharges = useMemo(() => {
    return chargeEvents
      .filter(e => dateKey(e.start) === selectedKey)
      .sort((a, b) => a.clientName.localeCompare(b.clientName))
  }, [chargeEvents, selectedKey])

  const dayFinancialEntries = useMemo(() => {
    return financialEntries
      .filter(e => {
        if (e.paymentId || e.clientSubscriptionId || e.expenseBillId) return false
        if (!e.date) return false
        const d = new Date(`${e.date}T12:00:00`)
        if (!Number.isFinite(d.getTime())) return false
        return dateKey(d) === selectedKey
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type)
        return (a.category || "").localeCompare(b.category || "")
      })
  }, [financialEntries, selectedKey])

  const dayFinancialIncome = useMemo(
    () => dayFinancialEntries.filter(e => e.type === "INCOME").reduce((acc, e) => acc + e.amount, 0),
    [dayFinancialEntries]
  )
  const dayFinancialExpense = useMemo(
    () => dayFinancialEntries.filter(e => e.type === "EXPENSE").reduce((acc, e) => acc + e.amount, 0),
    [dayFinancialEntries]
  )

  const dayReceiveTotal = useMemo(() => dayCharges.filter(e => e.source !== "EXPENSE").reduce((acc, e) => acc + e.amount, 0), [dayCharges])
  const dayReceiveReceived = useMemo(() => dayCharges.filter(e => e.source !== "EXPENSE" && (e.status === "PAID" || e.status === "RECEIVED")).reduce((acc, e) => acc + e.amount, 0), [dayCharges])
  const dayReceivePending = useMemo(() => dayReceiveTotal - dayReceiveReceived, [dayReceiveTotal, dayReceiveReceived])
  const dayPayTotal = useMemo(() => dayCharges.filter(e => e.source === "EXPENSE" && e.status === "PENDING").reduce((acc, e) => acc + e.amount, 0), [dayCharges])

  const eventStyleGetter = (event: CalendarDayTotalEvent) => {
    const hasPay = event.payCount > 0
    const hasReceive = event.receiveCount > 0
    const overdueReceive = hasReceive && dateKey(event.start) < todayKey

    const borderColor = hasPay
      ? "rgba(239, 68, 68, 0.95)"
      : overdueReceive
        ? "rgba(239, 68, 68, 0.95)"
        : hasReceive
          ? "rgba(245, 158, 11, 0.95)"
          : "rgba(34, 197, 94, 0.95)"
    return {
      style: {
        backgroundColor: "var(--secondary)",
        borderRadius: "10px",
        border: `1px solid ${borderColor}`,
        color: "var(--secondary-foreground)",
        padding: "4px 8px",
        boxShadow: "0 1px 0 rgba(0,0,0,0.08)",
      },
    }
  }

  const dayStyleGetter = (date: Date) => {
    const key = dateKey(date)
    const dayData = calendarEvents.find(e => e.id === `day:${key}`)
    
    if (!dayData) return {}
    
    const hasPay = dayData.payCount > 0
    const hasReceive = dayData.receiveCount > 0
    const hasPaid = dayData.receivedCount > 0 || dayData.paidExpenseCount > 0
    
    if (hasPay && hasReceive) {
      return {
        style: {
          background: "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 50%, rgba(245, 158, 11, 0.2) 50%)",
        },
      }
    }
    
    if (hasPay) {
      return {
        style: {
          background: "rgba(239, 68, 68, 0.15)",
        },
      }
    }
    
    if (hasReceive) {
      return {
        style: {
          background: "rgba(245, 158, 11, 0.15)",
        },
      }
    }
    
    if (hasPaid) {
      return {
        style: {
          background: "rgba(34, 197, 94, 0.15)",
        },
      }
    }
    
    return {}
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Calendário financeiro</h1>
          <p className="text-muted-foreground">
            Visualize cobranças por dia, valores a receber e status de pagamento
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          <Button
            variant="outline"
            disabled={sendingDailyEmail}
            onClick={() => sendDailyEmail(selectedDate)}
          >
            {sendingDailyEmail ? "Enviando..." : "Enviar resumo"}
          </Button>
          <Button variant="outline" onClick={() => setAddExpenseOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Despesa
          </Button>
          <Button onClick={() => setAddChargeOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Cobrança avulsa
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Total (mês)"
          value={formatBRL2(monthSummary.total)}
          icon={Wallet}
          color="blue"
        />
        <StatsCard
          title="Recebido (mês)"
          value={formatBRL2(monthSummary.received)}
          icon={TrendingUp}
          color="green"
        />
        <StatsCard
          title="Restante (mês)"
          value={formatBRL2(monthSummary.remaining)}
          icon={TrendingDown}
          color="yellow"
        />
        <StatsCard
          title="Próximo vencimento"
          value={monthSummary.nextDue ? format(monthSummary.nextDue, "dd/MM/yyyy", { locale: ptBR }) : "—"}
          icon={CalendarIcon}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 overflow-hidden shadow-sm border-none bg-card">
          <CardContent className="p-0 h-[calc(100vh-290px)]">
            <div className="financial-calendar h-full">
              <RBCalendar
                localizer={localizer}
                events={calendarEvents}
                startAccessor="start"
                endAccessor="end"
                style={{ height: "100%" }}
                view={Views.MONTH}
                views={[Views.MONTH]}
                date={calendarDate}
                onNavigate={(d) => setCalendarDate(d)}
                culture="pt-BR"
                messages={{
                  next: "Próximo",
                  previous: "Anterior",
                  today: "Hoje",
                  month: "Mês",
                  week: "Semana",
                  day: "Dia",
                  agenda: "Agenda",
                  date: "Data",
                  time: "Hora",
                  event: "Evento",
                  noEventsInRange: loading ? "Carregando..." : "Não há cobranças neste período.",
                  allDay: "Dia todo",
                  showMore: (total) => `+${total} mais`,
                }}
                selectable
                popup
                onSelectSlot={({ start }: { start: Date }) => setSelectedDate(start)}
                onSelectEvent={(event) => setSelectedDate((event as CalendarDayTotalEvent).start)}
                eventPropGetter={(event) => eventStyleGetter(event as CalendarDayTotalEvent)}
                dayPropGetter={dayStyleGetter}
                components={{
                  dateCellWrapper: ({ children }: { children: React.ReactNode }) => {
                    return <>{children}</>
                  },
                  eventWrapper: (props: any) => {
                    const ev = props.event as CalendarDayTotalEvent
                    const key = dateKey(ev.start)
                    const dayData = calendarEvents.find(e => e.id === `day:${key}`)
                    
                    if (!dayData) return <>{props.children}</>
                    
                    return (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-pointer">{props.children}</div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <div className="space-y-2">
                              <div className="font-semibold">{format(ev.start, "dd/MM/yyyy", { locale: ptBR })}</div>
                              {dayData.receiveCount > 0 && (
                                <div className="text-amber-600">
                                  <div className="font-medium">A receber:</div>
                                  <div>{formatBRL2(dayData.receiveAmount)} ({dayData.receiveCount})</div>
                                </div>
                              )}
                              {dayData.receivedCount > 0 && (
                                <div className="text-green-600">
                                  <div className="font-medium">Recebido:</div>
                                  <div>{formatBRL2(dayData.receivedAmount)} ({dayData.receivedCount})</div>
                                </div>
                              )}
                              {dayData.payCount > 0 && (
                                <div className="text-red-600">
                                  <div className="font-medium">A pagar:</div>
                                  <div>{formatBRL2(dayData.payAmount)} ({dayData.payCount})</div>
                                </div>
                              )}
                              {dayData.paidExpenseCount > 0 && (
                                <div className="text-green-600">
                                  <div className="font-medium">Pago:</div>
                                  <div>{formatBRL2(dayData.paidExpenseAmount)} ({dayData.paidExpenseCount})</div>
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )
                  },
                  event: ({ event }: { event: any }) => {
                    const ev = event as CalendarDayTotalEvent
                    const hasPay = ev.payCount > 0
                    const hasReceive = ev.receiveCount > 0
                    const overdueReceive = hasReceive && dateKey(ev.start) < todayKey
                    const hasIn = ev.receivedAmount > 0
                    const hasOut = ev.paidExpenseAmount > 0
                    const dotClass = hasPay
                      ? "h-2 w-2 rounded-full bg-red-500 flex-shrink-0"
                      : overdueReceive
                        ? "h-2 w-2 rounded-full bg-red-500 flex-shrink-0"
                        : hasReceive
                          ? "h-2 w-2 rounded-full bg-amber-500 flex-shrink-0"
                          : "h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0"
                    return (
                      <div className="text-[11px] leading-tight">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={dotClass} />
                          <div className="font-bold truncate">
                            {hasPay && !hasReceive
                              ? `Despesa ${formatBRL2(ev.payAmount)}`
                              : hasReceive
                                ? `Receber ${formatBRL2(ev.receiveAmount)}`
                                : hasPay
                                  ? `Despesa ${formatBRL2(ev.payAmount)}`
                                  : hasIn && hasOut
                                    ? `Entradas ${formatBRL2(ev.receivedAmount)}`
                                    : hasIn
                                      ? `Entradas ${formatBRL2(ev.receivedAmount)}`
                                      : hasOut
                                        ? `Saídas ${formatBRL2(ev.paidExpenseAmount)}`
                                        : "R$ 0,00"}
                          </div>
                        </div>
                        <div className="opacity-80 truncate">
                          {hasPay && !hasReceive
                            ? `A pagar · ${ev.payCount}${ev.payRecurringCount > 0 ? " (rec.)" : ""}${hasIn ? ` · +${formatBRL2(ev.receivedAmount)}` : ""}`
                            : hasReceive && hasPay
                              ? `A receber · ${ev.receiveCount} · A pagar · ${ev.payCount}${hasIn ? ` · +${formatBRL2(ev.receivedAmount)}` : ""}${hasOut ? ` · -${formatBRL2(ev.paidExpenseAmount)}` : ""}`
                              : hasReceive
                                ? `${overdueReceive ? "Vencido" : "A receber"} · ${ev.receiveCount}${hasOut ? ` · -${formatBRL2(ev.paidExpenseAmount)}` : ""}`
                                : hasPay
                                  ? `A pagar · ${ev.payCount}${ev.payRecurringCount > 0 ? " (rec.)" : ""}${hasIn ? ` · +${formatBRL2(ev.receivedAmount)}` : ""}`
                                  : hasIn || hasOut
                                    ? `${hasIn ? `Recebido · ${ev.receivedCount}` : ""}${hasIn && hasOut ? " · " : ""}${hasOut ? `Pago · ${ev.paidExpenseCount}` : ""}`
                                    : "Recebido · 0"}
                        </div>
                      </div>
                    )
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-card">
          <CardHeader>
            <CardTitle className="text-base">
              {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">
                Receber: <span className="text-foreground font-semibold">{formatBRL2(dayReceiveTotal)}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Recebido: <span className="text-foreground font-semibold">{formatBRL2(dayReceiveReceived)}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                A receber: <span className="text-foreground font-semibold">{formatBRL2(dayReceivePending)}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                A pagar: <span className="text-foreground font-semibold">{formatBRL2(dayPayTotal)}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Entradas: <span className="text-foreground font-semibold">{formatBRL2(dayFinancialIncome)}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Saídas: <span className="text-foreground font-semibold">{formatBRL2(dayFinancialExpense)}</span>
              </div>
            </div>

            {dayCharges.length === 0 && dayFinancialEntries.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nenhum registro para este dia.
              </div>
            ) : (
              <div className="space-y-3">
                {dayCharges.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate text-foreground">
                        {c.source === "EXPENSE"
                          ? `${c.clientName} · ${c.subscriptionName}`
                          : c.source === "PAYMENT"
                            ? `${c.clientName} · Cobrança avulsa`
                            : `${c.clientName} · ${c.subscriptionName}`}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.source === "EXPENSE"
                          ? `${format(c.dueDate, "dd/MM/yyyy", { locale: ptBR })}${c.isRecurring ? ` · Recorrente (${recurringLabel(c.recurringType)})` : ""}${c.projectName ? ` · ${c.projectName}` : ""}`
                          : c.manualDescription
                            ? c.manualDescription
                            : c.groupName
                              ? c.groupName
                              : "—"}
                      </div>
                      {c.status === "PAID" && c.paidAt ? (
                        <div className="text-xs text-muted-foreground">
                          Pago em {format(c.paidAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="font-semibold text-sm text-foreground">
                        {c.source === "EXPENSE" ? `- ${formatBRL2(c.amount)}` : formatBRL2(c.amount)}
                      </div>
                      <div className="flex items-center gap-2">
                        {(() => {
                          if (c.source === "EXPENSE") {
                            if (c.status === "PAID") {
                              return <Badge className="bg-green-600 hover:bg-green-600 text-white font-semibold">Pago</Badge>
                            }
                            const overdue = dateKey(c.dueDate) < todayKey
                            return (
                              <Badge className="bg-red-600 hover:bg-red-600 text-white font-semibold">
                                {overdue ? "Vencido" : "A pagar"}
                              </Badge>
                            )
                          }

                          const isReceived = c.status === "PAID" || c.status === "RECEIVED"
                          const isPending = c.status === "PENDING"
                          const overdue = isPending && dateKey(c.dueDate) < todayKey
                          const badgeClass = isReceived
                            ? "bg-green-600 hover:bg-green-600 text-white font-semibold"
                            : overdue
                              ? "bg-red-600 hover:bg-red-600 text-white font-semibold"
                              : "bg-amber-500 hover:bg-amber-500 text-black font-semibold"

                          const label = c.source === "PAYMENT"
                            ? isReceived
                              ? "Recebido"
                              : "Pendente"
                            : c.status === "PAID"
                              ? "Pago"
                              : "Pendente"

                          return <Badge className={badgeClass}>{label}</Badge>
                        })()}
                        {c.source === "PAYMENT" && c.paymentId ? (
                          <>
                            {c.status === "PENDING" && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={markingReceivedId === c.paymentId}
                                onClick={() => markPaymentAsReceived(c.paymentId!)}
                              >
                                {markingReceivedId === c.paymentId ? "Marcando..." : "Marcar recebido"}
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    const payment = payments.find(p => p.id === c.paymentId)
                                    if (payment) {
                                      setPaymentToEdit({
                                        id: payment.id,
                                        clientId: payment.client.id,
                                        amount: payment.amount,
                                        description: payment.description,
                                        paymentDate: payment.paymentDate,
                                        method: payment.method || 'BANK_TRANSFER'
                                      })
                                      setAddChargeOpen(true)
                                    }
                                  }}
                                >
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  disabled={deletingPaymentId === c.paymentId}
                                  onClick={() => {
                                    if (confirm("Tem certeza que deseja excluir esta cobrança?")) {
                                      deletePayment(c.paymentId!)
                                    }
                                  }}
                                >
                                  {deletingPaymentId === c.paymentId ? "Excluindo..." : "Excluir"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        ) : null}
                        {c.source === "SUBSCRIPTION" && c.status === "PENDING" && c.clientSubscriptionId ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={markingPaidId === c.clientSubscriptionId}
                            onClick={() => markSubscriptionAsPaid(c.clientSubscriptionId!, c.dueDate)}
                          >
                            {markingPaidId === c.clientSubscriptionId ? "Marcando..." : "Marcar pago"}
                          </Button>
                        ) : null}
                        {c.source === "EXPENSE" && c.expenseBillId ? (
                          <>
                            {c.status === "PENDING" && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={markingExpensePaidId === `${c.expenseBillId}:${dateKey(c.dueDate)}`}
                                onClick={() => markExpenseAsPaid(c.expenseBillId!, c.dueDate)}
                              >
                                {markingExpensePaidId === `${c.expenseBillId}:${dateKey(c.dueDate)}` ? "Marcando..." : "Marcar pago"}
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    const expense = expenseOccurrences.find(e => e.billId === c.expenseBillId)
                                    if (expense) {
                                      setExpenseToEdit({
                                        id: expense.billId,
                                        category: expense.category,
                                        description: expense.description,
                                        amount: expense.amount,
                                        dueDate: expense.dueDate,
                                        isRecurring: expense.isRecurring,
                                        recurringType: expense.recurringType as any,
                                        dueDay: String(expense.dueDay).padStart(2, "0")
                                      })
                                      setAddExpenseOpen(true)
                                    }
                                  }}
                                >
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  disabled={deletingExpenseId === c.expenseBillId}
                                  onClick={() => {
                                    if (confirm("Tem certeza que deseja excluir esta despesa?")) {
                                      deleteExpense(c.expenseBillId!)
                                    }
                                  }}
                                >
                                  {deletingExpenseId === c.expenseBillId ? "Excluindo..." : "Excluir"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}

                {dayFinancialEntries.length ? (
                  <div className="pt-2 border-t border-border space-y-3">
                    {dayFinancialEntries.map((e) => (
                      <div key={e.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate text-foreground">
                            {e.category || "Entrada"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {e.description || "—"}{e.projectName ? ` · ${e.projectName}` : ""}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <div className="font-semibold text-sm text-foreground">
                            {e.type === "EXPENSE" ? `- ${formatBRL2(e.amount)}` : formatBRL2(e.amount)}
                          </div>
                          <Badge className={e.type === "EXPENSE" ? "bg-red-600 hover:bg-red-600 text-white font-semibold" : "bg-green-600 hover:bg-green-600 text-white font-semibold"}>
                            {e.type === "EXPENSE" ? "Saída" : "Entrada"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={addExpenseOpen} onOpenChange={(open) => {
        setAddExpenseOpen(open)
        if (!open) setExpenseToEdit(undefined)
      }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{expenseToEdit ? "Editar despesa" : "Cadastrar despesa"}</DialogTitle>
            <DialogDescription>
              {expenseToEdit ? "Atualize os dados da despesa." : "Crie uma despesa para aparecer no calendário e poder marcar como paga depois."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="Ex: Infraestrutura"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  value={expenseForm.amount}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "")
                    setExpenseForm(prev => ({ ...prev, amount: formatCurrencyBRFromDigits(digits) }))
                  }}
                  placeholder="R$ 0,00"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={expenseForm.description}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Ex: Conta do servidor"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="expenseRecurring"
                checked={expenseForm.isRecurring}
                onCheckedChange={(v) => setExpenseForm(prev => ({ ...prev, isRecurring: Boolean(v) }))}
              />
              <Label htmlFor="expenseRecurring">Recorrente</Label>
            </div>

            {expenseForm.isRecurring ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequência</Label>
                  <Select
                    value={expenseForm.recurringType}
                    onValueChange={(v) => setExpenseForm(prev => ({ ...prev, recurringType: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">Mensal</SelectItem>
                      <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                      <SelectItem value="YEARLY">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Dia de vencimento</Label>
                  <Select
                    value={expenseForm.dueDay}
                    onValueChange={(v) => setExpenseForm(prev => ({ ...prev, dueDay: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Dia" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }).map((_, i) => {
                        const d = String(i + 1).padStart(2, "0")
                        return (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={expenseForm.dueDate}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddExpenseOpen(false)
              setExpenseToEdit(undefined)
            }} disabled={creatingExpense}>
              Cancelar
            </Button>
            <Button onClick={createExpenseBill} disabled={creatingExpense}>
              {creatingExpense ? "Salvando..." : expenseToEdit ? "Salvar alterações" : "Salvar despesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddPaymentDialog
        open={addChargeOpen}
        onOpenChange={(open) => {
          setAddChargeOpen(open)
          if (!open) setPaymentToEdit(undefined)
        }}
        onPaymentAdded={() => {
          setAddChargeOpen(false)
          setPaymentToEdit(undefined)
          fetchPayments()
        }}
        mode="CHARGE"
        defaultDate={format(selectedDate, "yyyy-MM-dd")}
        paymentToEdit={paymentToEdit}
      />

      <style jsx global>{`
        .financial-calendar .rbc-calendar {
          color: var(--foreground);
        }

        .financial-calendar .rbc-toolbar {
          margin: 0;
          padding: 12px;
          background: var(--card);
          border-bottom: 1px solid var(--border);
          display: flex;
          gap: 10px;
        }

        .financial-calendar .rbc-toolbar-label {
          font-weight: 700;
          color: var(--card-foreground);
        }

        .financial-calendar .rbc-btn-group {
          display: inline-flex;
          gap: 8px;
        }

        .financial-calendar .rbc-btn-group button {
          background: var(--secondary);
          color: var(--secondary-foreground);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 6px 10px;
          font-size: 12px;
          line-height: 16px;
          font-weight: 600;
          cursor: pointer;
        }

        .financial-calendar .rbc-btn-group button:hover {
          background: var(--accent);
          color: var(--accent-foreground);
        }

        .financial-calendar .rbc-btn-group button:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35);
        }

        .financial-calendar .rbc-btn-group button.rbc-active {
          background: var(--primary);
          color: var(--primary-foreground);
          border-color: transparent;
        }

        .financial-calendar .rbc-month-view {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
        }

        .financial-calendar .rbc-header {
          background: var(--muted);
          color: var(--muted-foreground);
          border-bottom: 1px solid var(--border);
          padding: 10px 6px;
          font-weight: 700;
          text-transform: capitalize;
        }

        .financial-calendar .rbc-month-row + .rbc-month-row {
          border-top: 1px solid var(--border);
        }

        .financial-calendar .rbc-day-bg + .rbc-day-bg {
          border-left: 1px solid var(--border);
        }

        .financial-calendar .rbc-date-cell {
          padding: 6px 8px;
          color: var(--muted-foreground);
          font-weight: 600;
        }

        .financial-calendar .rbc-date-cell.rbc-now {
          color: var(--foreground);
        }

        .financial-calendar .rbc-off-range-bg {
          background: var(--muted);
        }

        .financial-calendar .rbc-off-range {
          color: var(--muted-foreground);
          opacity: 0.7;
        }

        .financial-calendar .rbc-today {
          background: var(--accent);
        }

        .financial-calendar .rbc-event,
        .financial-calendar .rbc-day-slot .rbc-event {
          border: none;
        }

        .financial-calendar .rbc-show-more {
          color: var(--primary);
          font-weight: 700;
        }

        .financial-calendar .rbc-overlay {
          background: var(--popover);
          color: var(--popover-foreground);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
        }

        .financial-calendar .rbc-overlay-header {
          background: var(--muted);
          border-bottom: 1px solid var(--border);
          padding: 10px 12px;
          font-weight: 800;
        }
      `}</style>
    </div>
  )
}

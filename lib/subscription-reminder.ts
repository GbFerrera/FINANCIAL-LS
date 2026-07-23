import {
  dateKey,
  unpaidDueDateForClientSubscription,
  yearMonthKey,
  type BillingCycle,
} from "./subscription-billing"

export type ReminderTemplateVars = {
  nome: string
  cliente: string
  preco: string
  vencimento: string
  plano: string
  empresa: string
  grupo: string
  dias_antes: string
}

export const REMINDER_VARIABLE_HINTS: { key: keyof ReminderTemplateVars; label: string }[] = [
  { key: "nome", label: "Nome do cliente" },
  { key: "cliente", label: "Nome do cliente (alias)" },
  { key: "preco", label: "Valor da assinatura" },
  { key: "vencimento", label: "Data de vencimento" },
  { key: "plano", label: "Nome do plano" },
  { key: "empresa", label: "Empresa do cliente" },
  { key: "grupo", label: "Grupo de assinatura" },
  { key: "dias_antes", label: "Dias restantes até o vencimento (no envio)" },
]

export function renderReminderTemplate(text: string, vars: ReminderTemplateVars) {
  let out = text
  for (const [key, value] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi")
    out = out.replace(re, value ?? "")
  }
  return out
}

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export function formatDateBR(d: Date) {
  return d.toLocaleDateString("pt-BR")
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)
}

export function daysUntilDue(today: Date, due: Date) {
  const a = startOfLocalDay(today).getTime()
  const b = startOfLocalDay(due).getTime()
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
}

/** HH:mm (24h, horário local) — true se já passou o horário de início no dia de `now`. */
export function isReminderSendTimeReached(sendTime: string, now: Date) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(sendTime.trim())
  if (!match) return true
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return true
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0)
  return now.getTime() >= start.getTime()
}

export function normalizeSendTime(input: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(input.trim())
  if (!match) return "09:00"
  const hour = Math.min(23, Math.max(0, Number(match[1])))
  const minute = Math.min(59, Math.max(0, Number(match[2])))
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

export function isCyclePaid(lastPaidFor: Date | null, due: Date) {
  if (!lastPaidFor) return false
  return yearMonthKey(lastPaidFor) === yearMonthKey(due)
}

export type ReminderCandidate = {
  templateId: string
  clientSubscriptionId: string
  clientEmail: string
  clientPhone: string | null
  clientName: string
  due: Date
  dueDateKey: string
  daysUntilDue: number
  vars: ReminderTemplateVars
}

export function collectReminderCandidates(input: {
  referenceDate: Date
  templates: {
    id: string
    groupId: string
    subject: string
    body: string
    daysBeforeDue: number
    isActive: boolean
    sendEmail?: boolean
    sendWhatsApp?: boolean
    group: { name: string }
    recipientClientSubscriptionIds?: string[]
  }[]
  links: {
    id: string
    dueDay: number
    status: string
    startedAt: Date
    lastPaidFor: Date | null
    client: { name: string; email: string; company: string | null; phone?: string | null }
    subscription: {
      name: string
      price: number
      billingCycle: BillingCycle
      isActive: boolean
      groupId: string
    }
  }[]
  alreadySentKeys?: Set<string>
}) {
  const out: ReminderCandidate[] = []
  const today = input.referenceDate

  for (const template of input.templates) {
    if (!template.isActive) continue

    for (const link of input.links) {
      if (link.subscription.groupId !== template.groupId) continue
      if (!link.subscription.isActive) continue
      if ((link.status || "").toUpperCase() !== "ACTIVE") continue

      const allowed = template.recipientClientSubscriptionIds
      if (allowed && allowed.length > 0 && !allowed.includes(link.id)) continue

      const due = unpaidDueDateForClientSubscription({
        dueDay: link.dueDay,
        billingCycle: link.subscription.billingCycle,
        startedAt: link.startedAt,
        lastPaidFor: link.lastPaidFor,
        referenceDate: today,
      })

      if (!due) continue
      if (isCyclePaid(link.lastPaidFor, due)) continue

      const remaining = daysUntilDue(today, due)
      if (remaining < 0 || remaining > template.daysBeforeDue) continue

      const dueDateKey = dateKey(due)
      const dedupeKey = `${template.id}:${link.id}:${dueDateKey}:${remaining}`
      if (input.alreadySentKeys?.has(dedupeKey)) continue

      const vars: ReminderTemplateVars = {
        nome: link.client.name,
        cliente: link.client.name,
        preco: formatBRL(Number(link.subscription.price || 0)),
        vencimento: formatDateBR(due),
        plano: link.subscription.name,
        empresa: link.client.company || "",
        grupo: template.group.name,
        dias_antes: String(remaining),
      }

      out.push({
        templateId: template.id,
        clientSubscriptionId: link.id,
        clientEmail: link.client.email,
        clientPhone: link.client.phone ?? null,
        clientName: link.client.name,
        due,
        dueDateKey,
        daysUntilDue: remaining,
        vars,
      })
    }
  }

  return out
}

export function plainTextToHtml(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
  return escaped.replace(/\n/g, "<br/>")
}

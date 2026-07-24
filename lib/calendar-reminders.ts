import { addDays, endOfDay, startOfDay } from "date-fns"
import { dateKey } from "./subscription-billing"
import { collectReminderCandidates, type ReminderCandidate } from "./subscription-reminder"
import { collectPaymentReminderCandidates, type PaymentWithReminderConfig } from "./payment-reminder"

export type CalendarReminderItem = {
  sendDateKey: string
  dueDateKey: string
  daysUntilDue: number
  channels: Array<"EMAIL" | "WHATSAPP">
  clientName: string
  label: string
  amountLabel: string
  status: "scheduled" | "sent" | "partial"
  source: "SUBSCRIPTION" | "PAYMENT"
  sourceId: string
  templateId?: string
  templateName?: string
  /** true se algum canal habilitado ainda não foi enviado (mostra botão reenviar). */
  canResend: boolean
}

function parseLocalDate(s: string) {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0)
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

type RawReminderRow = Omit<CalendarReminderItem, "channels" | "status" | "canResend"> & {
  channel: "EMAIL" | "WHATSAPP"
  sent: boolean
}

function mergeRawRows(rows: RawReminderRow[]): CalendarReminderItem[] {
  const map = new Map<string, RawReminderRow[]>()
  for (const row of rows) {
    const key = [
      row.source,
      row.sourceId,
      row.sendDateKey,
      row.dueDateKey,
      row.daysUntilDue,
      row.templateId || "",
    ].join(":")
    const list = map.get(key) || []
    list.push(row)
    map.set(key, list)
  }

  const merged: CalendarReminderItem[] = []
  for (const group of map.values()) {
    const first = group[0]
    const channels = group.map((g) => g.channel)
    const sentCount = group.filter((g) => g.sent).length
    const status =
      sentCount === 0 ? "scheduled" : sentCount === group.length ? "sent" : "partial"

    merged.push({
      sendDateKey: first.sendDateKey,
      dueDateKey: first.dueDateKey,
      daysUntilDue: first.daysUntilDue,
      channels,
      clientName: first.clientName,
      label: first.label,
      amountLabel: first.amountLabel,
      status,
      source: first.source,
      sourceId: first.sourceId,
      templateId: first.templateId,
      templateName: first.templateName,
      canResend: status !== "sent",
    })
  }

  return merged.sort((a, b) => a.clientName.localeCompare(b.clientName, "pt-BR"))
}

export function buildCalendarReminderItems(input: {
  startDate: string
  endDate: string
  templates: Parameters<typeof collectReminderCandidates>[0]["templates"]
  links: Parameters<typeof collectReminderCandidates>[0]["links"]
  payments: PaymentWithReminderConfig[]
  subscriptionSentKeys: Set<string>
  paymentSentKeys: Set<string>
  templateNamesById: Map<string, string>
}) {
  const start = startOfDay(parseLocalDate(input.startDate))
  const end = endOfDay(parseLocalDate(input.endDate))
  const raw: RawReminderRow[] = []

  for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    const referenceDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)
    const sendDateKey = dateKey(referenceDate)

    const subCandidates: ReminderCandidate[] = collectReminderCandidates({
      referenceDate,
      templates: input.templates,
      links: input.links,
    })

    for (const c of subCandidates) {
      const template = input.templates.find((t) => t.id === c.templateId)
      if (!template) continue

      for (const channel of ["EMAIL", "WHATSAPP"] as const) {
        if (channel === "EMAIL" && !template.sendEmail) continue
        if (channel === "WHATSAPP" && !template.sendWhatsApp) continue

        const dedupe = `${c.templateId}:${c.clientSubscriptionId}:${c.dueDateKey}:${channel}:${c.daysUntilDue}`
        raw.push({
          sendDateKey,
          dueDateKey: c.dueDateKey,
          daysUntilDue: c.daysUntilDue,
          channel,
          clientName: c.clientName,
          label: c.vars.plano,
          amountLabel: c.vars.preco,
          sent: input.subscriptionSentKeys.has(dedupe),
          source: "SUBSCRIPTION",
          sourceId: c.clientSubscriptionId,
          templateId: c.templateId,
          templateName: input.templateNamesById.get(c.templateId) || "Assinatura",
        })
      }
    }

    const payCandidates = collectPaymentReminderCandidates({
      referenceDate,
      payments: input.payments,
    })

    for (const c of payCandidates) {
      const payment = input.payments.find((p) => p.id === c.paymentId)
      const label = payment?.description?.trim() || "Cobrança avulsa"

      if (c.reminderSendEmail) {
        const dedupe = `${c.paymentId}:${c.dueDateKey}:EMAIL:${c.daysUntilDue}`
        raw.push({
          sendDateKey,
          dueDateKey: c.dueDateKey,
          daysUntilDue: c.daysUntilDue,
          channel: "EMAIL",
          clientName: c.clientName,
          label,
          amountLabel: formatBRL(c.amount),
          sent: input.paymentSentKeys.has(dedupe),
          source: "PAYMENT",
          sourceId: c.paymentId,
        })
      }
      if (c.reminderSendWhatsApp) {
        const dedupe = `${c.paymentId}:${c.dueDateKey}:WHATSAPP:${c.daysUntilDue}`
        raw.push({
          sendDateKey,
          dueDateKey: c.dueDateKey,
          daysUntilDue: c.daysUntilDue,
          channel: "WHATSAPP",
          clientName: c.clientName,
          label,
          amountLabel: formatBRL(c.amount),
          sent: input.paymentSentKeys.has(dedupe),
          source: "PAYMENT",
          sourceId: c.paymentId,
        })
      }
    }
  }

  return mergeRawRows(raw)
}

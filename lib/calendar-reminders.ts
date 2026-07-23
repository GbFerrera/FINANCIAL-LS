import { addDays, endOfDay, startOfDay } from "date-fns"
import { dateKey } from "./subscription-billing"
import { collectReminderCandidates, type ReminderCandidate } from "./subscription-reminder"
import { collectPaymentReminderCandidates, type PaymentWithReminderConfig } from "./payment-reminder"

export type CalendarReminderItem = {
  sendDateKey: string
  dueDateKey: string
  daysUntilDue: number
  channel: "EMAIL" | "WHATSAPP"
  clientName: string
  label: string
  amountLabel: string
  status: "scheduled" | "sent"
  source: "SUBSCRIPTION" | "PAYMENT"
  sourceId: string
  templateName?: string
}

function parseLocalDate(s: string) {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0)
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
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
  const items: CalendarReminderItem[] = []

  for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    const referenceDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)
    const sendDateKey = dateKey(referenceDate)

    const subCandidates: ReminderCandidate[] = collectReminderCandidates({
      referenceDate,
      templates: input.templates,
      links: input.links,
    })

    for (const c of subCandidates) {
      for (const channel of ["EMAIL", "WHATSAPP"] as const) {
        const template = input.templates.find((t) => t.id === c.templateId)
        if (!template) continue
        if (channel === "EMAIL" && !template.sendEmail) continue
        if (channel === "WHATSAPP" && !template.sendWhatsApp) continue

        const dedupe = `${c.templateId}:${c.clientSubscriptionId}:${c.dueDateKey}:${channel}:${c.daysUntilDue}`
        items.push({
          sendDateKey,
          dueDateKey: c.dueDateKey,
          daysUntilDue: c.daysUntilDue,
          channel,
          clientName: c.clientName,
          label: c.vars.plano,
          amountLabel: c.vars.preco,
          status: input.subscriptionSentKeys.has(dedupe) ? "sent" : "scheduled",
          source: "SUBSCRIPTION",
          sourceId: c.clientSubscriptionId,
          templateName: input.templateNamesById.get(c.templateId) || "Assinatura",
        })
      }
    }

    const payCandidates = collectPaymentReminderCandidates({
      referenceDate,
      payments: input.payments,
    })

    for (const c of payCandidates) {
      if (c.reminderSendEmail) {
        const dedupe = `${c.paymentId}:${c.dueDateKey}:EMAIL:${c.daysUntilDue}`
        items.push({
          sendDateKey,
          dueDateKey: c.dueDateKey,
          daysUntilDue: c.daysUntilDue,
          channel: "EMAIL",
          clientName: c.clientName,
          label: "Cobrança avulsa",
          amountLabel: formatBRL(c.amount),
          status: input.paymentSentKeys.has(dedupe) ? "sent" : "scheduled",
          source: "PAYMENT",
          sourceId: c.paymentId,
        })
      }
      if (c.reminderSendWhatsApp) {
        const dedupe = `${c.paymentId}:${c.dueDateKey}:WHATSAPP:${c.daysUntilDue}`
        items.push({
          sendDateKey,
          dueDateKey: c.dueDateKey,
          daysUntilDue: c.daysUntilDue,
          channel: "WHATSAPP",
          clientName: c.clientName,
          label: "Cobrança avulsa",
          amountLabel: formatBRL(c.amount),
          status: input.paymentSentKeys.has(dedupe) ? "sent" : "scheduled",
          source: "PAYMENT",
          sourceId: c.paymentId,
        })
      }
    }
  }

  return items
}

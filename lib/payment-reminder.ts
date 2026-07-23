import { dateKey } from "./subscription-billing"
import { daysUntilDue, formatBRL, formatDateBR, renderReminderTemplate } from "./subscription-reminder"

export type PaymentReminderVars = {
  nome: string
  cliente: string
  preco: string
  vencimento: string
  descricao: string
  dias_antes: string
}

export const DEFAULT_PAYMENT_REMINDER_SUBJECT =
  "Lembrete: cobrança de {{preco}} vence em {{vencimento}}"

export const DEFAULT_PAYMENT_REMINDER_BODY = `Olá {{nome}},

Lembramos que você tem uma cobrança de {{preco}} com vencimento em {{vencimento}}.

{{descricao}}

Qualquer dúvida, responda este e-mail.`

export type PaymentReminderCandidate = {
  paymentId: string
  clientEmail: string
  clientPhone: string | null
  clientName: string
  due: Date
  dueDateKey: string
  daysUntilDue: number
  vars: PaymentReminderVars
  reminderSendEmail: boolean
  reminderSendWhatsApp: boolean
  reminderSendTime: string
  reminderSubject: string
  reminderBody: string
  whatsAppInstanceId: string | null
  amount: number
}

export type PaymentWithReminderConfig = {
  id: string
  amount: number
  description: string | null
  paymentDate: Date
  status: string
  reminderSendEmail: boolean
  reminderSendWhatsApp: boolean
  reminderDaysBefore: number
  reminderSendTime: string
  reminderSubject: string | null
  reminderBody: string | null
  whatsAppInstanceId: string | null
  client: {
    name: string
    email: string
    phone?: string | null
    company?: string | null
  }
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)
}

export function buildPaymentReminderVars(payment: PaymentWithReminderConfig, daysUntil: number): PaymentReminderVars {
  const due = startOfLocalDay(payment.paymentDate)
  return {
    nome: payment.client.name,
    cliente: payment.client.name,
    preco: formatBRL(Number(payment.amount || 0)),
    vencimento: formatDateBR(due),
    descricao: payment.description?.trim() || "Cobrança avulsa",
    dias_antes: String(Math.max(0, daysUntil)),
  }
}

export function collectPaymentReminderCandidates(input: {
  referenceDate: Date
  payments: PaymentWithReminderConfig[]
}) {
  const out: PaymentReminderCandidate[] = []
  const today = input.referenceDate

  for (const payment of input.payments) {
    if ((payment.status || "").toUpperCase() !== "PENDING") continue
    if (!payment.reminderSendEmail && !payment.reminderSendWhatsApp) continue

    const due = startOfLocalDay(payment.paymentDate)
    const remaining = daysUntilDue(today, due)
    if (remaining < 0 || remaining > payment.reminderDaysBefore) continue

    const dueDateKey = dateKey(due)
    const vars = buildPaymentReminderVars(payment, remaining)
    const subjectTemplate = payment.reminderSubject?.trim() || DEFAULT_PAYMENT_REMINDER_SUBJECT
    const bodyTemplate = payment.reminderBody?.trim() || DEFAULT_PAYMENT_REMINDER_BODY

    out.push({
      paymentId: payment.id,
      clientEmail: payment.client.email,
      clientPhone: payment.client.phone ?? null,
      clientName: payment.client.name,
      due,
      dueDateKey,
      daysUntilDue: remaining,
      vars,
      reminderSendEmail: payment.reminderSendEmail,
      reminderSendWhatsApp: payment.reminderSendWhatsApp,
      reminderSendTime: payment.reminderSendTime || "09:00",
      reminderSubject: renderReminderTemplate(subjectTemplate, vars as never),
      reminderBody: renderReminderTemplate(bodyTemplate, vars as never),
      whatsAppInstanceId: payment.whatsAppInstanceId,
      amount: payment.amount,
    })
  }

  return out
}

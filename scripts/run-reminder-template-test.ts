import { config } from "dotenv"
config({ path: ".env.local" })
config()

import { prisma } from "../lib/prisma"
import {
  renderReminderTemplate,
  formatBRL,
  formatDateBR,
  daysUntilDue,
} from "../lib/subscription-reminder"
import { buildReminderEmailHtml } from "../lib/subscription-reminder-email"
import {
  appendPixToPlainEmailText,
  buildReminderPixPayload,
  parseAmountBrlFromReminderVars,
} from "../lib/pix-copia-cola"
import { unpaidDueDateForClientSubscription } from "../lib/subscription-billing"
import { sendMail } from "../lib/mail"
import { evolutionSendText, normalizeWhatsAppNumber } from "../lib/evolution-api"
import {
  normalizePixKeyType,
  sendSubscriptionReminderWhatsApp,
} from "../lib/subscription-reminder-whatsapp"

const TEMPLATE_ID = process.argv[2] || "cmrxqqe2a00010n4d7wiv9qqi"

async function main() {
  const template = await prisma.subscriptionGroupReminderTemplate.findUnique({
    where: { id: TEMPLATE_ID },
    include: {
      group: { select: { name: true } },
      recipients: true,
      whatsAppInstance: true,
    },
  })
  if (!template) throw new Error("Template não encontrado")

  const recipientIds = template.recipients.map((r) => r.clientSubscriptionId)
  if (recipientIds.length === 0) throw new Error("Template sem destinatários")

  const links = await prisma.clientSubscription.findMany({
    where: { id: { in: recipientIds }, status: "ACTIVE" },
    include: {
      client: { select: { name: true, email: true, company: true, phone: true } },
      subscription: {
        select: { name: true, price: true, billingCycle: true, isActive: true, groupId: true },
      },
    },
  })

  const today = new Date()
  const referenceDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0)
  const results: { channel: string; to: string; ok: boolean; error?: string }[] = []

  let waCount = 0
  for (const link of links) {
    if (link.subscription.groupId !== template.groupId) continue

    const due = unpaidDueDateForClientSubscription({
      dueDay: link.dueDay,
      billingCycle: link.subscription.billingCycle,
      startedAt: link.startedAt,
      lastPaidFor: link.lastPaidFor,
      referenceDate,
    })
    const remaining = due ? daysUntilDue(referenceDate, due) : template.daysBeforeDue

    const vars = {
      nome: link.client.name,
      cliente: link.client.name,
      preco: formatBRL(Number(link.subscription.price || 0)),
      vencimento: due ? formatDateBR(due) : `dia ${link.dueDay}`,
      plano: link.subscription.name,
      empresa: link.client.company || "",
      grupo: template.group.name,
      dias_antes: String(Math.max(0, remaining)),
    }

    const subject = renderReminderTemplate(template.subject, vars)
    const textBody = renderReminderTemplate(template.body, vars)

    const pixPayload =
      template.whatsAppPixButton && template.pixKey
        ? buildReminderPixPayload({
            key: template.pixKey,
            keyType: template.pixKeyType,
            receiverName: template.pixReceiverName || template.group.name,
            amountBrl: parseAmountBrlFromReminderVars(vars.preco, Number(link.subscription.price || 0)),
            amountLabel: vars.preco,
            merchantCity: template.pixCity ?? undefined,
            pixDescription: template.pixDescription,
            pixTxid: template.pixTxid,
          })
        : null

    const text = pixPayload ? appendPixToPlainEmailText(textBody, pixPayload) : textBody
    const html = buildReminderEmailHtml({
      bodyText: textBody,
      vars,
      daysUntilDue: Math.max(0, remaining),
      pix: pixPayload,
    })

    if (template.sendEmail) {
      const to = link.client.email?.trim()
      if (!to) {
        results.push({ channel: "EMAIL", to: "", ok: false, error: "sem e-mail" })
      } else {
        try {
          await sendMail({ to, subject, text, html })
          results.push({ channel: "EMAIL", to, ok: true })
        } catch (e) {
          results.push({
            channel: "EMAIL",
            to,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          })
        }
      }
    }

    if (template.sendWhatsApp && template.whatsAppInstance) {
      const inst = template.whatsAppInstance
      const phone = normalizeWhatsAppNumber(link.client.phone)
      if (inst.status !== "CONNECTED") {
        results.push({ channel: "WHATSAPP", to: phone || "", ok: false, error: "WhatsApp desconectado" })
      } else if (!phone) {
        results.push({ channel: "WHATSAPP", to: "", ok: false, error: "sem telefone" })
      } else {
        if (waCount > 0) {
          const pause = Math.min(45, Math.max(0, template.whatsAppPauseSeconds ?? 10))
          if (pause > 0) await new Promise((r) => setTimeout(r, pause * 1000))
        }
        try {
          const wa = await sendSubscriptionReminderWhatsApp({
            instanceName: inst.instanceName,
            phone,
            subject,
            body: textBody,
            footer: template.pixReceiverName || template.group.name,
            pix:
              template.whatsAppPixButton && template.pixKey
                ? {
                    enabled: true,
                    key: template.pixKey,
                    keyType: normalizePixKeyType(template.pixKeyType),
                    receiverName: template.pixReceiverName || template.group.name,
                    buttonLabel: template.pixButtonLabel || "Copiar Pix",
                    amountLabel: vars.preco,
                    amountBrl: parseAmountBrlFromReminderVars(vars.preco, Number(link.subscription.price || 0)),
                    merchantCity: template.pixCity ?? undefined,
                    pixDescription: template.pixDescription,
                    pixTxid: template.pixTxid,
                  }
                : null,
            pauseSeconds: template.whatsAppPauseSeconds ?? 2,
          })
          results.push({ channel: "WHATSAPP", to: phone, ok: true, mode: wa.mode })
          waCount++
        } catch (e) {
          results.push({
            channel: "WHATSAPP",
            to: phone,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          })
        }
      }
    }
  }

  console.log(JSON.stringify({ template: template.name, results }, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

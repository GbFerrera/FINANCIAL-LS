import { prisma } from "@/lib/prisma"
import {
  collectReminderCandidates,
  isReminderSendTimeReached,
  plainTextToHtml,
  renderReminderTemplate,
} from "@/lib/subscription-reminder"
import { buildReminderEmailHtml } from "@/lib/subscription-reminder-email"
import { sendMail } from "@/lib/mail"
import { normalizeWhatsAppNumber } from "@/lib/evolution-api"
import {
  normalizePixKeyType,
  sendSubscriptionReminderWhatsApp,
} from "@/lib/subscription-reminder-whatsapp"
import {
  appendPixToPlainEmailText,
  buildReminderPixPayload,
  parseAmountBrlFromReminderVars,
} from "@/lib/pix-copia-cola"
import { collectPaymentReminderCandidates } from "@/lib/payment-reminder"

export type ReminderDispatchResultRow = {
  client: string
  channel: "EMAIL" | "WHATSAPP"
  destination: string
  dueDateKey: string
  daysUntilDue: number
  template: string
  status: "sent" | "preview" | "error" | "skipped"
  error?: string
}

export type RunReminderDispatchInput = {
  date?: string
  dryRun?: boolean
  /** Ignora horário do template (simulação ou data fixa). */
  skipSendTimeCheck?: boolean
  /** Só processa destinatários com este e-mail (testes). */
  onlyClientEmail?: string
}

export type RunReminderDispatchOutput = {
  ok: true
  referenceDate: string
  dryRun: boolean
  candidates: number
  sent: number
  errors: number
  skipped: number
  results: ReminderDispatchResultRow[]
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function matchesClientEmail(email: string | null | undefined, filter: string) {
  if (!email) return false
  return email.trim().toLowerCase() === filter.trim().toLowerCase()
}

export async function runReminderDispatch(
  input: RunReminderDispatchInput = {}
): Promise<RunReminderDispatchOutput> {
  const now = new Date()
  const referenceDate = input.date
    ? new Date(`${input.date}T12:00:00`)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0)

  const dryRun = input.dryRun ?? false
  const skipSendTimeCheck = input.skipSendTimeCheck ?? (dryRun || Boolean(input.date))
  const onlyClientEmail = input.onlyClientEmail?.trim()

  const templatesRaw = await prisma.subscriptionGroupReminderTemplate.findMany({
    where: { isActive: true },
    include: {
      group: { select: { name: true } },
      whatsAppInstance: true,
      recipients: { select: { clientSubscriptionId: true } },
    },
  })

  const templates = templatesRaw
    .map((t) => ({
      ...t,
      recipientClientSubscriptionIds: t.recipients.map((r) => r.clientSubscriptionId),
    }))
    .filter((t) => skipSendTimeCheck || isReminderSendTimeReached(t.sendTime, now))

  const links = await prisma.clientSubscription.findMany({
    where: { status: "ACTIVE" },
    include: {
      client: { select: { name: true, email: true, company: true, phone: true } },
      subscription: {
        select: {
          name: true,
          price: true,
          billingCycle: true,
          isActive: true,
          groupId: true,
        },
      },
    },
  })

  const logs = await prisma.subscriptionReminderSendLog.findMany({
    select: {
      templateId: true,
      clientSubscriptionId: true,
      dueDateKey: true,
      channel: true,
      daysUntilDue: true,
    },
  })
  const sentChannelKeys = new Set(
    logs.map(
      (l) =>
        `${l.templateId}:${l.clientSubscriptionId}:${l.dueDateKey}:${l.channel}:${l.daysUntilDue}`
    )
  )

  const candidates = collectReminderCandidates({
    referenceDate,
    templates,
    links: links.map((l) => ({
      ...l,
      subscription: {
        ...l.subscription,
        billingCycle: l.subscription.billingCycle as "MONTHLY" | "YEARLY",
      },
    })),
  }).filter((c) => !onlyClientEmail || matchesClientEmail(c.clientEmail, onlyClientEmail))

  const templateById = new Map(templates.map((t) => [t.id, t]))
  const results: ReminderDispatchResultRow[] = []
  let whatsAppSentThisRun = 0

  for (const c of candidates) {
    const template = templateById.get(c.templateId)
    if (!template) continue

    const subject = renderReminderTemplate(template.subject, c.vars)
    const textBody = renderReminderTemplate(template.body, c.vars)

    const pixPayload =
      template.whatsAppPixButton && template.pixKey
        ? buildReminderPixPayload({
            key: template.pixKey,
            keyType: template.pixKeyType,
            receiverName: template.pixReceiverName || template.group.name,
            amountBrl: parseAmountBrlFromReminderVars(c.vars.preco),
            amountLabel: c.vars.preco,
            merchantCity: template.pixCity ?? undefined,
            pixDescription: template.pixDescription,
            pixTxid: template.pixTxid,
          })
        : null

    const text = pixPayload ? appendPixToPlainEmailText(textBody, pixPayload) : textBody
    const html = buildReminderEmailHtml({
      bodyText: textBody,
      vars: c.vars,
      daysUntilDue: c.daysUntilDue,
      pix: pixPayload,
    })

    const waPixConfig =
      template.whatsAppPixButton && template.pixKey
        ? {
            enabled: true as const,
            key: template.pixKey,
            keyType: normalizePixKeyType(template.pixKeyType),
            receiverName: template.pixReceiverName || template.group.name,
            buttonLabel: template.pixButtonLabel || "Copiar Pix",
            amountLabel: c.vars.preco,
            amountBrl: parseAmountBrlFromReminderVars(c.vars.preco),
            merchantCity: template.pixCity ?? undefined,
            pixDescription: template.pixDescription ?? undefined,
            pixTxid: template.pixTxid ?? undefined,
          }
        : null

    const channels: { channel: "EMAIL" | "WHATSAPP"; enabled: boolean }[] = [
      { channel: "EMAIL", enabled: template.sendEmail },
      { channel: "WHATSAPP", enabled: template.sendWhatsApp },
    ]

    for (const { channel, enabled } of channels) {
      if (!enabled) continue

      const dedupeKey = `${c.templateId}:${c.clientSubscriptionId}:${c.dueDateKey}:${channel}:${c.daysUntilDue}`
      if (sentChannelKeys.has(dedupeKey)) continue

      if (channel === "EMAIL") {
        const destination = c.clientEmail?.trim()
        if (!destination) {
          results.push({
            client: c.clientName,
            channel,
            destination: "",
            dueDateKey: c.dueDateKey,
            daysUntilDue: c.daysUntilDue,
            template: template.name,
            status: "skipped",
            error: "Cliente sem e-mail",
          })
          continue
        }

        if (dryRun) {
          results.push({
            client: c.clientName,
            channel,
            destination,
            dueDateKey: c.dueDateKey,
            daysUntilDue: c.daysUntilDue,
            template: template.name,
            status: "preview",
          })
          continue
        }

        try {
          await sendMail({ to: destination, subject, text, html })
          await prisma.subscriptionReminderSendLog.create({
            data: {
              templateId: c.templateId,
              clientSubscriptionId: c.clientSubscriptionId,
              dueDateKey: c.dueDateKey,
              daysUntilDue: c.daysUntilDue,
              channel: "EMAIL",
              recipientEmail: destination,
            },
          })
          sentChannelKeys.add(dedupeKey)
          results.push({
            client: c.clientName,
            channel,
            destination,
            dueDateKey: c.dueDateKey,
            daysUntilDue: c.daysUntilDue,
            template: template.name,
            status: "sent",
          })
        } catch (err) {
          results.push({
            client: c.clientName,
            channel,
            destination,
            dueDateKey: c.dueDateKey,
            daysUntilDue: c.daysUntilDue,
            template: template.name,
            status: "error",
            error: err instanceof Error ? err.message : "Erro ao enviar e-mail",
          })
        }
        continue
      }

      const inst = template.whatsAppInstance
      const phone = normalizeWhatsAppNumber(c.clientPhone)
      if (!inst) {
        results.push({
          client: c.clientName,
          channel,
          destination: phone || "",
          dueDateKey: c.dueDateKey,
          template: template.name,
          status: "skipped",
          error: "Template sem instância WhatsApp",
        })
        continue
      }
      if (inst.status !== "CONNECTED") {
        results.push({
          client: c.clientName,
          channel,
          destination: phone || "",
          dueDateKey: c.dueDateKey,
          template: template.name,
          status: "skipped",
          error: "WhatsApp desconectado",
        })
        continue
      }
      if (!phone) {
        results.push({
          client: c.clientName,
          channel,
          destination: "",
          dueDateKey: c.dueDateKey,
          template: template.name,
          status: "skipped",
          error: "Cliente sem telefone válido",
        })
        continue
      }

      if (dryRun) {
        results.push({
          client: c.clientName,
          channel,
          destination: phone,
          dueDateKey: c.dueDateKey,
          daysUntilDue: c.daysUntilDue,
          template: template.name,
          status: "preview",
        })
        continue
      }

      try {
        if (whatsAppSentThisRun > 0) {
          const pauseSec = Math.min(45, Math.max(0, template.whatsAppPauseSeconds ?? 10))
          if (pauseSec > 0) await sleep(pauseSec * 1000)
        }
        await sendSubscriptionReminderWhatsApp({
          instanceName: inst.instanceName,
          phone,
          subject,
          body: textBody,
          footer: template.pixReceiverName || template.group.name,
          pix: waPixConfig,
          pauseSeconds: template.whatsAppPauseSeconds ?? 2,
        })
        await prisma.subscriptionReminderSendLog.create({
          data: {
            templateId: c.templateId,
            clientSubscriptionId: c.clientSubscriptionId,
            dueDateKey: c.dueDateKey,
            daysUntilDue: c.daysUntilDue,
            channel: "WHATSAPP",
            recipientPhone: phone,
          },
        })
        sentChannelKeys.add(dedupeKey)
        whatsAppSentThisRun += 1
        results.push({
          client: c.clientName,
          channel,
          destination: phone,
          dueDateKey: c.dueDateKey,
          template: template.name,
          status: "sent",
        })
      } catch (err) {
        results.push({
          client: c.clientName,
          channel,
          destination: phone,
          dueDateKey: c.dueDateKey,
          template: template.name,
          status: "error",
          error: err instanceof Error ? err.message : "Erro ao enviar WhatsApp",
        })
      }
    }
  }

  const paymentsPending = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      OR: [{ reminderSendEmail: true }, { reminderSendWhatsApp: true }],
    },
    include: {
      client: { select: { name: true, email: true, phone: true, company: true } },
      whatsAppInstance: true,
    },
  })

  const paymentLogs = await prisma.paymentReminderSendLog.findMany({
    select: { paymentId: true, dueDateKey: true, channel: true, daysUntilDue: true },
  })
  const paymentSentKeys = new Set(
    paymentLogs.map((l) => `${l.paymentId}:${l.dueDateKey}:${l.channel}:${l.daysUntilDue}`)
  )

  const defaultWaInst = await prisma.whatsAppInstance.findFirst({
    where: { status: "CONNECTED" },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  })

  const paymentCandidates = collectPaymentReminderCandidates({
    referenceDate,
    payments: paymentsPending,
  }).filter((c) => !onlyClientEmail || matchesClientEmail(c.clientEmail, onlyClientEmail))

  for (const c of paymentCandidates) {
    if (!skipSendTimeCheck && !isReminderSendTimeReached(c.reminderSendTime, now)) continue

    const channels: { channel: "EMAIL" | "WHATSAPP"; enabled: boolean }[] = [
      { channel: "EMAIL", enabled: c.reminderSendEmail },
      { channel: "WHATSAPP", enabled: c.reminderSendWhatsApp },
    ]

    for (const { channel, enabled } of channels) {
      if (!enabled) continue
      const dedupeKey = `${c.paymentId}:${c.dueDateKey}:${channel}:${c.daysUntilDue}`
      if (paymentSentKeys.has(dedupeKey)) continue

      const label = "Cobrança avulsa"

      if (channel === "EMAIL") {
        const to = c.clientEmail?.trim()
        if (!to) {
          results.push({
            client: c.clientName,
            channel,
            destination: "",
            dueDateKey: c.dueDateKey,
            daysUntilDue: c.daysUntilDue,
            template: label,
            status: "skipped",
            error: "Cliente sem e-mail",
          })
          continue
        }
        if (dryRun) {
          results.push({
            client: c.clientName,
            channel,
            destination: to,
            dueDateKey: c.dueDateKey,
            daysUntilDue: c.daysUntilDue,
            template: label,
            status: "preview",
          })
          continue
        }
        try {
          await sendMail({
            to,
            subject: c.reminderSubject,
            text: c.reminderBody,
            html: `<div style="font-family:sans-serif;line-height:1.6">${plainTextToHtml(c.reminderBody)}</div>`,
          })
          await prisma.paymentReminderSendLog.create({
            data: {
              paymentId: c.paymentId,
              dueDateKey: c.dueDateKey,
              daysUntilDue: c.daysUntilDue,
              channel: "EMAIL",
              recipientEmail: to,
            },
          })
          paymentSentKeys.add(dedupeKey)
          results.push({
            client: c.clientName,
            channel,
            destination: to,
            dueDateKey: c.dueDateKey,
            daysUntilDue: c.daysUntilDue,
            template: label,
            status: "sent",
          })
        } catch (err) {
          results.push({
            client: c.clientName,
            channel,
            destination: to,
            dueDateKey: c.dueDateKey,
            template: label,
            status: "error",
            error: err instanceof Error ? err.message : "Erro ao enviar e-mail",
          })
        }
        continue
      }

      const inst =
        paymentsPending.find((p) => p.id === c.paymentId)?.whatsAppInstance ||
        (c.whatsAppInstanceId
          ? await prisma.whatsAppInstance.findUnique({ where: { id: c.whatsAppInstanceId } })
          : defaultWaInst)
      const phone = normalizeWhatsAppNumber(c.clientPhone)
      if (!inst) {
        results.push({
          client: c.clientName,
          channel,
          destination: phone || "",
          dueDateKey: c.dueDateKey,
          template: label,
          status: "skipped",
          error: "Nenhuma instância WhatsApp conectada",
        })
        continue
      }
      if (inst.status !== "CONNECTED") {
        results.push({
          client: c.clientName,
          channel,
          destination: phone || "",
          dueDateKey: c.dueDateKey,
          template: label,
          status: "skipped",
          error: "WhatsApp desconectado",
        })
        continue
      }
      if (!phone) {
        results.push({
          client: c.clientName,
          channel,
          destination: "",
          dueDateKey: c.dueDateKey,
          template: label,
          status: "skipped",
          error: "Cliente sem telefone",
        })
        continue
      }
      if (dryRun) {
        results.push({
          client: c.clientName,
          channel,
          destination: phone,
          dueDateKey: c.dueDateKey,
          daysUntilDue: c.daysUntilDue,
          template: label,
          status: "preview",
        })
        continue
      }
      try {
        if (whatsAppSentThisRun > 0) {
          await sleep(2000)
        }
        await sendSubscriptionReminderWhatsApp({
          instanceName: inst.instanceName,
          phone,
          subject: c.reminderSubject,
          body: c.reminderBody,
          pix: null,
          pauseSeconds: 2,
        })
        await prisma.paymentReminderSendLog.create({
          data: {
            paymentId: c.paymentId,
            dueDateKey: c.dueDateKey,
            daysUntilDue: c.daysUntilDue,
            channel: "WHATSAPP",
            recipientPhone: phone,
          },
        })
        paymentSentKeys.add(dedupeKey)
        whatsAppSentThisRun += 1
        results.push({
          client: c.clientName,
          channel,
          destination: phone,
          dueDateKey: c.dueDateKey,
          template: label,
          status: "sent",
        })
      } catch (err) {
        results.push({
          client: c.clientName,
          channel,
          destination: phone,
          dueDateKey: c.dueDateKey,
          template: label,
          status: "error",
          error: err instanceof Error ? err.message : "Erro WhatsApp",
        })
      }
    }
  }

  return {
    ok: true,
    referenceDate: referenceDate.toISOString().slice(0, 10),
    dryRun,
    candidates: candidates.length + paymentCandidates.length,
    sent: results.filter((r) => r.status === "sent").length,
    errors: results.filter((r) => r.status === "error").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    results,
  }
}

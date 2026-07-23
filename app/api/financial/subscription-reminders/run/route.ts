import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { UserRole } from "@prisma/client"
import {
  collectReminderCandidates,
  isReminderSendTimeReached,
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

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dryRun: z.boolean().optional(),
  cronSecret: z.string().min(1).optional(),
})

async function authorize(req: NextRequest, body: z.infer<typeof bodySchema>) {
  const url = new URL(req.url)
  const xCronSecret = req.headers.get("x-cron-secret")
  const authorization = req.headers.get("authorization")
  const querySecret = url.searchParams.get("cronSecret")
  const headerSecret =
    xCronSecret || authorization?.replace(/^Bearer\s+/i, "") || querySecret || null
  const providedSecret = headerSecret || body.cronSecret || null

  if (providedSecret) {
    const secret = process.env.CRON_SECRET
    if (!secret) {
      return {
        error: NextResponse.json(
          { error: "CRON_SECRET não está configurado no ambiente do servidor" },
          { status: 500 }
        ),
      }
    }
    if (providedSecret !== secret) {
      return { error: NextResponse.json({ error: "x-cron-secret inválido" }, { status: 401 }) }
    }
    return { ok: true as const }
  }

  const session = await getServerSession(authOptions)
  if (!session) {
    return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) }
  }
  if (session.user.role !== UserRole.ADMIN) {
    return { error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) }
  }
  return { ok: true as const }
}

type ResultRow = {
  client: string
  channel: "EMAIL" | "WHATSAPP"
  destination: string
  dueDateKey: string
  daysUntilDue: number
  template: string
  status: "sent" | "preview" | "error" | "skipped"
  error?: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => ({}))
    const body = bodySchema.parse(json)
    const auth = await authorize(req, body)
    if ("error" in auth) return auth.error

    const now = new Date()
    const referenceDate = body.date
      ? new Date(`${body.date}T12:00:00`)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0)

    const dryRun = body.dryRun ?? false
    const skipSendTimeCheck = dryRun || Boolean(body.date)

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
    })

    const templateById = new Map(templates.map((t) => [t.id, t]))
    const results: ResultRow[] = []
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

    return NextResponse.json({
      ok: true,
      referenceDate: referenceDate.toISOString().slice(0, 10),
      dryRun,
      candidates: candidates.length,
      sent: results.filter((r) => r.status === "sent").length,
      errors: results.filter((r) => r.status === "error").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      results,
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: e.issues }, { status: 400 })
    }
    console.error(e)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { UserRole } from "@prisma/client"
import {
  syncTemplateRecipients,
  validateRecipientIdsForGroup,
} from "@/lib/subscription-reminder-recipients"
import { normalizeSendTime } from "@/lib/subscription-reminder"

const sendTimeSchema = z
  .string()
  .regex(/^\d{1,2}:\d{2}$/, "Horário inválido (use HH:mm)")

const scheduleFields = {
  sendTime: sendTimeSchema.optional(),
  whatsAppPauseSeconds: z.number().int().min(0).max(45).optional(),
}

const pixFields = {
  whatsAppPixButton: z.boolean().optional(),
  pixKey: z.string().min(1).optional(),
  pixKeyType: z.enum(["email", "phone", "cpf", "cnpj", "random"]).optional(),
  pixReceiverName: z.string().min(1).optional(),
  pixButtonLabel: z.string().min(1).max(40).optional(),
  pixCity: z.string().min(1).max(15).optional(),
  pixDescription: z.string().min(1).max(72).optional(),
  pixTxid: z.string().min(1).max(25).optional(),
}

const channelFields = {
  sendEmail: z.boolean().optional(),
  sendWhatsApp: z.boolean().optional(),
  whatsAppInstanceId: z.string().nullable().optional(),
  clientSubscriptionIds: z.array(z.string().min(1)).min(1),
  ...scheduleFields,
  ...pixFields,
}

const createSchema = z
  .object({
    groupId: z.string().min(1),
    name: z.string().min(1).optional(),
    subject: z.string().min(1),
    body: z.string().min(1),
    daysBeforeDue: z.number().int().min(0).max(60),
    isActive: z.boolean().optional(),
    ...channelFields,
  })
  .superRefine((data, ctx) => {
    const email = data.sendEmail ?? true
    const wa = data.sendWhatsApp ?? false
    if (!email && !wa) {
      ctx.addIssue({ code: "custom", message: "Ative e-mail ou WhatsApp", path: ["sendEmail"] })
    }
    if (wa && !data.whatsAppInstanceId) {
      ctx.addIssue({
        code: "custom",
        message: "Selecione um número WhatsApp",
        path: ["whatsAppInstanceId"],
      })
    }
    if (data.whatsAppPixButton && !data.pixKey?.trim()) {
      ctx.addIssue({ code: "custom", message: "Informe a chave Pix", path: ["pixKey"] })
    }
  })

async function validateWhatsAppInstance(id: string | null | undefined) {
  if (!id) return null
  const inst = await prisma.whatsAppInstance.findUnique({ where: { id } })
  if (!inst) throw new Error("Instância WhatsApp não encontrada")
  return inst
}

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session) return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) }
  if (session.user.role !== UserRole.ADMIN) {
    return { error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) }
  }
  return { session }
}

export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  const templates = await prisma.subscriptionGroupReminderTemplate.findMany({
    orderBy: [{ groupId: "asc" }, { daysBeforeDue: "desc" }],
    include: {
      group: { select: { id: true, name: true } },
      whatsAppInstance: { select: { id: true, label: true, phone: true, status: true } },
      recipients: { select: { clientSubscriptionId: true } },
      _count: { select: { sendLogs: true } },
    },
  })

  const withIds = templates.map((t) => ({
    ...t,
    clientSubscriptionIds: t.recipients.map((r) => r.clientSubscriptionId),
  }))

  return NextResponse.json({ templates: withIds })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  try {
    const body = createSchema.parse(await req.json())
    const group = await prisma.subscriptionGroup.findUnique({ where: { id: body.groupId } })
    if (!group) return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 })

    if (body.whatsAppInstanceId) await validateWhatsAppInstance(body.whatsAppInstanceId)
    const recipientIds = await validateRecipientIdsForGroup(body.groupId, body.clientSubscriptionIds)

    const { clientSubscriptionIds, sendTime, whatsAppPauseSeconds, ...rest } = body

    const created = await prisma.subscriptionGroupReminderTemplate.create({
      data: {
        groupId: rest.groupId,
        name: rest.name ?? "Lembrete",
        subject: rest.subject,
        body: rest.body,
        daysBeforeDue: rest.daysBeforeDue,
        sendTime: normalizeSendTime(sendTime ?? "09:00"),
        whatsAppPauseSeconds: whatsAppPauseSeconds ?? 10,
        isActive: rest.isActive ?? true,
        sendEmail: rest.sendEmail ?? true,
        sendWhatsApp: rest.sendWhatsApp ?? false,
        whatsAppInstanceId: rest.sendWhatsApp ? rest.whatsAppInstanceId ?? null : null,
        whatsAppPixButton: rest.sendWhatsApp && rest.whatsAppPixButton ? true : false,
        pixKey: rest.sendWhatsApp && rest.whatsAppPixButton ? rest.pixKey?.trim() ?? null : null,
        pixKeyType:
          rest.sendWhatsApp && rest.whatsAppPixButton
            ? rest.pixKeyType ?? "email"
            : null,
        pixReceiverName:
          rest.sendWhatsApp && rest.whatsAppPixButton
            ? rest.pixReceiverName?.trim() ?? null
            : null,
        pixButtonLabel: rest.pixButtonLabel?.trim() || "Pagar com Pix",
        pixCity: rest.pixCity?.trim() || null,
        pixDescription: rest.pixDescription?.trim() || null,
        pixTxid: rest.pixTxid?.trim() || null,
      },
      include: {
        group: { select: { id: true, name: true } },
        whatsAppInstance: { select: { id: true, label: true, phone: true, status: true } },
        recipients: { select: { clientSubscriptionId: true } },
      },
    })

    await syncTemplateRecipients(created.id, recipientIds)

    return NextResponse.json(
      {
        ...created,
        clientSubscriptionIds: recipientIds,
      },
      { status: 201 }
    )
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: e.issues }, { status: 400 })
    }
    if (e instanceof Error && (e.message.includes("destinat") || e.message.includes("Selecione"))) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    console.error(e)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

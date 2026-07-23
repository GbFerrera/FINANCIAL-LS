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

const updateSchema = z.object({
  groupId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  daysBeforeDue: z.number().int().min(0).max(60).optional(),
  isActive: z.boolean().optional(),
  sendEmail: z.boolean().optional(),
  sendWhatsApp: z.boolean().optional(),
  whatsAppInstanceId: z.string().nullable().optional(),
  clientSubscriptionIds: z.array(z.string().min(1)).min(1).optional(),
  sendTime: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  pixButtonLabel: z.string().min(1).max(40).optional(),
  whatsAppPixButton: z.boolean().optional(),
  pixKey: z.string().min(1).optional(),
  pixKeyType: z.enum(["email", "phone", "cpf", "cnpj", "random"]).optional(),
  pixReceiverName: z.string().min(1).optional(),
  pixCity: z.string().min(1).max(15).optional(),
  pixDescription: z.string().min(1).max(72).optional(),
  pixTxid: z.string().min(1).max(25).optional(),
})

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session) return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) }
  if (session.user.role !== UserRole.ADMIN) {
    return { error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) }
  }
  return { session }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  try {
    const { id } = await params
    const body = updateSchema.parse(await req.json())
    if (body.groupId) {
      const group = await prisma.subscriptionGroup.findUnique({ where: { id: body.groupId } })
      if (!group) return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 })
    }

    const existing = await prisma.subscriptionGroupReminderTemplate.findUnique({
      where: { id },
    })
    if (!existing) return NextResponse.json({ error: "Template não encontrado" }, { status: 404 })

    const groupId = body.groupId ?? existing.groupId
    const sendEmail = body.sendEmail ?? existing.sendEmail
    const sendWhatsApp = body.sendWhatsApp ?? existing.sendWhatsApp
    let whatsAppInstanceId =
      body.whatsAppInstanceId !== undefined ? body.whatsAppInstanceId : existing.whatsAppInstanceId

    if (!sendEmail && !sendWhatsApp) {
      return NextResponse.json({ error: "Ative e-mail ou WhatsApp" }, { status: 400 })
    }
    if (sendWhatsApp) {
      if (!whatsAppInstanceId) {
        return NextResponse.json({ error: "Selecione um número WhatsApp" }, { status: 400 })
      }
      const inst = await prisma.whatsAppInstance.findUnique({ where: { id: whatsAppInstanceId } })
      if (!inst) return NextResponse.json({ error: "Instância WhatsApp não encontrada" }, { status: 404 })
    } else {
      whatsAppInstanceId = null
    }

    if (body.clientSubscriptionIds) {
      await validateRecipientIdsForGroup(groupId, body.clientSubscriptionIds)
    }

    if (sendWhatsApp && body.whatsAppPixButton && !body.pixKey?.trim()) {
      return NextResponse.json({ error: "Informe a chave Pix" }, { status: 400 })
    }

    const { clientSubscriptionIds, sendTime, whatsAppPauseSeconds, ...templateFields } = body

    const pixOn =
      sendWhatsApp &&
      (body.whatsAppPixButton ?? existing.whatsAppPixButton) &&
      (body.pixKey ?? existing.pixKey)

    const updated = await prisma.subscriptionGroupReminderTemplate.update({
      where: { id },
      data: {
        ...templateFields,
        sendEmail,
        sendWhatsApp,
        whatsAppInstanceId,
        ...(sendTime !== undefined ? { sendTime: normalizeSendTime(sendTime) } : {}),
        ...(whatsAppPauseSeconds !== undefined ? { whatsAppPauseSeconds } : {}),
        ...(body.whatsAppPixButton !== undefined || body.pixKey !== undefined
          ? {
              whatsAppPixButton: Boolean(sendWhatsApp && pixOn),
              pixKey: sendWhatsApp && pixOn ? (body.pixKey ?? existing.pixKey)?.trim() ?? null : null,
              pixKeyType:
                sendWhatsApp && pixOn
                  ? body.pixKeyType ?? existing.pixKeyType ?? "email"
                  : null,
              pixReceiverName:
                sendWhatsApp && pixOn
                  ? (body.pixReceiverName ?? existing.pixReceiverName)?.trim() ?? null
                  : null,
            }
          : {}),
        ...(body.pixButtonLabel !== undefined
          ? { pixButtonLabel: body.pixButtonLabel.trim() || "Pagar com Pix" }
          : {}),
      },
      include: {
        group: { select: { id: true, name: true } },
        whatsAppInstance: { select: { id: true, label: true, phone: true, status: true } },
        recipients: { select: { clientSubscriptionId: true } },
      },
    })

    if (clientSubscriptionIds) {
      await syncTemplateRecipients(id, clientSubscriptionIds)
    }

    return NextResponse.json({
      ...updated,
      clientSubscriptionIds:
        clientSubscriptionIds ?? updated.recipients.map((r) => r.clientSubscriptionId),
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: e.issues }, { status: 400 })
    }
    if (e instanceof Error && e.message.includes("destinat")) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    console.error(e)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  try {
    const { id } = await params
    await prisma.subscriptionGroupReminderTemplate.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

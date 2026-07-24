import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { z } from "zod"
import { runReminderDispatch } from "@/lib/run-reminder-dispatch"

const bodySchema = z.object({
  source: z.enum(["SUBSCRIPTION", "PAYMENT"]),
  sourceId: z.string().min(1),
  dueDateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  daysUntilDue: z.number().int().min(0),
  sendDateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  templateId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  if (session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  try {
    const body = bodySchema.parse(await req.json())

    if (body.source === "PAYMENT") {
      await prisma.paymentReminderSendLog.deleteMany({
        where: {
          paymentId: body.sourceId,
          dueDateKey: body.dueDateKey,
          daysUntilDue: body.daysUntilDue,
        },
      })
    } else {
      if (!body.templateId) {
        return NextResponse.json({ error: "templateId obrigatório para assinatura" }, { status: 400 })
      }
      await prisma.subscriptionReminderSendLog.deleteMany({
        where: {
          templateId: body.templateId,
          clientSubscriptionId: body.sourceId,
          dueDateKey: body.dueDateKey,
          daysUntilDue: body.daysUntilDue,
        },
      })
    }

    const result = await runReminderDispatch({
      date: body.sendDateKey,
      skipSendTimeCheck: true,
      forceResend: true,
      onlyPaymentId: body.source === "PAYMENT" ? body.sourceId : undefined,
      onlyTemplateId: body.source === "SUBSCRIPTION" ? body.templateId : undefined,
      onlyClientSubscriptionId: body.source === "SUBSCRIPTION" ? body.sourceId : undefined,
    })

    return NextResponse.json({
      ok: true,
      sent: result.sent,
      errors: result.errors,
      results: result.results,
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: e.issues }, { status: 400 })
    }
    console.error(e)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

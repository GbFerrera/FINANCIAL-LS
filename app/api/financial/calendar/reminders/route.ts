import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildCalendarReminderItems } from "@/lib/calendar-reminders"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  if (!startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return NextResponse.json({ error: "Informe startDate e endDate (yyyy-MM-dd)" }, { status: 400 })
  }

  try {
    const templatesRaw = await prisma.subscriptionGroupReminderTemplate.findMany({
      where: { isActive: true },
      include: {
        group: { select: { name: true } },
        recipients: { select: { clientSubscriptionId: true } },
      },
    })

    const templates = templatesRaw.map((t) => ({
      id: t.id,
      name: t.name,
      groupId: t.groupId,
      subject: t.subject,
      body: t.body,
      daysBeforeDue: t.daysBeforeDue,
      isActive: t.isActive,
      sendEmail: t.sendEmail,
      sendWhatsApp: t.sendWhatsApp,
      group: t.group,
      recipientClientSubscriptionIds: t.recipients.map((r) => r.clientSubscriptionId),
    }))

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

    const payments = await prisma.payment.findMany({
      where: {
        status: "PENDING",
        OR: [{ reminderSendEmail: true }, { reminderSendWhatsApp: true }],
      },
      include: {
        client: { select: { name: true, email: true, phone: true, company: true } },
      },
    })

    const subLogs = await prisma.subscriptionReminderSendLog.findMany({
      select: {
        templateId: true,
        clientSubscriptionId: true,
        dueDateKey: true,
        channel: true,
        daysUntilDue: true,
      },
    })
    const subscriptionSentKeys = new Set(
      subLogs.map(
        (l) =>
          `${l.templateId}:${l.clientSubscriptionId}:${l.dueDateKey}:${l.channel}:${l.daysUntilDue}`
      )
    )

    const payLogs = await prisma.paymentReminderSendLog.findMany({
      select: { paymentId: true, dueDateKey: true, channel: true, daysUntilDue: true },
    })
    const paymentSentKeys = new Set(
      payLogs.map((l) => `${l.paymentId}:${l.dueDateKey}:${l.channel}:${l.daysUntilDue}`)
    )

    const items = buildCalendarReminderItems({
      startDate,
      endDate,
      templates,
      links: links.map((l) => ({
        ...l,
        subscription: {
          ...l.subscription,
          billingCycle: l.subscription.billingCycle as "MONTHLY" | "YEARLY",
        },
      })),
      payments: payments.map((p) => ({
        ...p,
        description: p.description,
        paymentDate: p.paymentDate,
      })),
      subscriptionSentKeys,
      paymentSentKeys,
      templateNamesById: new Map(templatesRaw.map((t) => [t.id, t.name])),
    })

    return NextResponse.json({ items })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { UserRole } from "@prisma/client"

const createSubscriptionSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  price: z.number().finite().nonnegative().optional(),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).optional(),
  clientIds: z.array(z.string()).optional(),
  dueDay: z.number().int().min(1).max(31),
})

const markPaidSchema = z.object({
  clientSubscriptionId: z.string().min(1),
  paidForDate: z.string().datetime(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    if (session.user.role !== UserRole.ADMIN) return NextResponse.json({ error: "Sem permissão" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const groupId = searchParams.get("groupId") || undefined

    const db = prisma as any
    const subscriptions = await db.subscription.findMany({
      where: groupId ? { groupId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        group: true,
        clients: {
          include: {
            client: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })

    return NextResponse.json({ subscriptions })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    if (session.user.role !== UserRole.ADMIN) return NextResponse.json({ error: "Sem permissão" }, { status: 403 })

    const json = await req.json()
    const body = createSubscriptionSchema.parse(json)

    const db = prisma as any
    const created = await db.subscription.create({
      data: {
        groupId: body.groupId,
        name: body.name,
        description: body.description ?? undefined,
        price: typeof body.price === "number" ? body.price : undefined,
        billingCycle: (body.billingCycle ?? undefined) as any,
        clients: body.clientIds?.length
          ? {
              createMany: {
                data: body.clientIds.map((clientId) => ({
                  clientId,
                  dueDay: body.dueDay,
                })),
                skipDuplicates: true,
              },
            }
          : undefined,
      },
      include: {
        group: true,
        clients: {
          include: {
            client: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    if (session.user.role !== UserRole.ADMIN) return NextResponse.json({ error: "Sem permissão" }, { status: 403 })

    const json = await req.json()
    const body = markPaidSchema.parse(json)

    const paidFor = new Date(body.paidForDate)
    const paidAt = new Date()
    const dayStart = new Date(paidAt.getFullYear(), paidAt.getMonth(), paidAt.getDate(), 0, 0, 0, 0)
    const dayEnd = new Date(paidAt.getFullYear(), paidAt.getMonth(), paidAt.getDate(), 23, 59, 59, 999)

    const db = prisma as any
    const updated = await db.$transaction(async (tx: any) => {
      const link = await tx.clientSubscription.update({
        where: { id: body.clientSubscriptionId },
        data: { lastPaidFor: paidFor, paidAt },
        include: {
          client: { select: { id: true, name: true, email: true } },
          subscription: { include: { group: true } },
        },
      })

      const existing = await tx.financialEntry.findFirst({
        where: {
          type: "INCOME",
          clientSubscriptionId: body.clientSubscriptionId,
          date: { gte: dayStart, lte: dayEnd },
        },
        select: { id: true },
      })

      if (!existing) {
        const amount = typeof link.subscription?.price === "number" ? link.subscription.price : 0
        await tx.financialEntry.create({
          data: {
            type: "INCOME",
            category: "Assinaturas",
            description: `${link.client?.name || "Cliente"} • ${link.subscription?.name || "Assinatura"}`,
            amount,
            date: paidAt,
            isRecurring: false,
            recurringType: null,
            clientSubscriptionId: body.clientSubscriptionId,
          },
          select: { id: true },
        })
      }

      return link
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

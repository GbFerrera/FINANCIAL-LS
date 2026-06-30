import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { UserRole } from "@prisma/client"

const createGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    if (session.user.role !== UserRole.ADMIN) return NextResponse.json({ error: "Sem permissão" }, { status: 403 })

    const db = prisma as any
    const groups = await db.subscriptionGroup.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { subscriptions: true } },
      },
    })

    const totals = await db.subscription.groupBy({
      by: ["groupId"],
      _sum: { price: true },
    })

    const totalByGroupId = new Map<string, number>()
    for (const row of totals) {
      totalByGroupId.set(row.groupId, row._sum?.price ?? 0)
    }

    const result = groups.map((g: any) => ({
      ...g,
      totalPrice: totalByGroupId.get(g.id) ?? 0,
    }))

    return NextResponse.json({ groups: result })
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
    const body = createGroupSchema.parse(json)

    const db = prisma as any
    const created = await db.subscriptionGroup.create({
      data: {
        name: body.name,
        description: body.description ?? undefined,
      },
      include: {
        _count: { select: { subscriptions: true } },
      },
    })

    return NextResponse.json({ ...created, totalPrice: 0 }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

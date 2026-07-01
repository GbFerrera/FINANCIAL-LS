import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function daysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate()
}

function dueDateForMonth(year: number, monthIndex0: number, dueDay: number) {
  const dim = daysInMonth(year, monthIndex0)
  const day = Math.min(Math.max(1, dueDay), dim)
  return new Date(year, monthIndex0, day, 12, 0, 0, 0)
}

function dateKey(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

const createExpenseBillSchema = z.object({
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  projectId: z.string().min(1).optional().nullable(),
  isRecurring: z.boolean().optional().default(false),
  recurringType: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).optional().nullable(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
})

const markExpensePaidSchema = z.object({
  billId: z.string().min(1),
  dueDate: z.string().datetime(),
})

const updateExpenseBillSchema = z.object({
  billId: z.string().min(1),
  category: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  projectId: z.string().min(1).optional().nullable(),
  isRecurring: z.boolean().optional(),
  recurringType: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).optional().nullable(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
})

const deleteExpenseBillSchema = z.object({
  billId: z.string().min(1),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const year = Number(searchParams.get("year") || "")
    const month = Number(searchParams.get("month") || "")

    const now = new Date()
    const y = Number.isFinite(year) && year > 0 ? year : now.getFullYear()
    const mIndex0 = Number.isFinite(month) && month >= 1 && month <= 12 ? month - 1 : now.getMonth()

    const monthStart = new Date(y, mIndex0, 1, 0, 0, 0, 0)
    const monthEnd = new Date(y, mIndex0 + 1, 0, 23, 59, 59, 999)

    const db = prisma as any
    if (!db.expenseBill) {
      return NextResponse.json(
        { error: "Modelo ExpenseBill não está disponível no Prisma Client. Rode `yarn prisma generate` e aplique as migrations." },
        { status: 500 }
      )
    }

    const bills = await db.expenseBill.findMany({
      where: {
        isActive: true,
        OR: [
          { isRecurring: true },
          { isRecurring: false, dueDate: { gte: monthStart, lte: monthEnd } },
        ],
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    })

    const billIds = bills.map((b: any) => b.id)
    const entries = billIds.length
      ? await db.financialEntry.findMany({
          where: {
            expenseBillId: { in: billIds },
            type: "EXPENSE",
            date: { gte: monthStart, lte: monthEnd },
          },
          select: { id: true, expenseBillId: true, date: true, createdAt: true },
        })
      : []

    const paidMap = new Map<string, { id: string; paidAt: Date }>()
    for (const e of entries) {
      const key = `${e.expenseBillId}:${dateKey(new Date(e.date))}`
      paidMap.set(key, { id: e.id, paidAt: new Date(e.createdAt) })
    }

    const occurrences: Array<any> = []
    for (const b of bills) {
      if (b.isRecurring) {
        const start = b.startDate ? new Date(b.startDate) : null
        if (!start) continue

        const startYM = start.getFullYear() * 12 + start.getMonth()
        const ym = y * 12 + mIndex0
        if (ym < startYM) continue

        const rt = String(b.recurringType || "MONTHLY").toUpperCase()
        if (rt === "YEARLY" && start.getMonth() !== mIndex0) continue
        if (rt === "QUARTERLY") {
          const diff = ym - startYM
          if (diff % 3 !== 0) continue
        }

        const dueDay = typeof b.dueDay === "number" ? b.dueDay : start.getDate()
        const due = dueDateForMonth(y, mIndex0, dueDay)
        const k = `${b.id}:${dateKey(due)}`
        const paid = paidMap.get(k) || null

        occurrences.push({
          id: `bill:${b.id}:${dateKey(due)}`,
          billId: b.id,
          category: b.category,
          description: b.description,
          amount: b.amount,
          projectName: b.project?.name ?? null,
          isRecurring: true,
          recurringType: b.recurringType ?? "MONTHLY",
          dueDay,
          dueDate: due.toISOString(),
          status: paid ? "PAID" : "PENDING",
          financialEntryId: paid?.id ?? null,
          paidAt: paid?.paidAt ? paid.paidAt.toISOString() : null,
        })
        continue
      }

      const due = b.dueDate ? new Date(b.dueDate) : null
      if (!due) continue
      if (due.getTime() < monthStart.getTime() || due.getTime() > monthEnd.getTime()) continue

      const k = `${b.id}:${dateKey(due)}`
      const paid = paidMap.get(k) || null
      occurrences.push({
        id: `bill:${b.id}:${dateKey(due)}`,
        billId: b.id,
        category: b.category,
        description: b.description,
        amount: b.amount,
        projectName: b.project?.name ?? null,
        isRecurring: false,
        recurringType: null,
        dueDay: due.getDate(),
        dueDate: due.toISOString(),
        status: paid ? "PAID" : "PENDING",
        financialEntryId: paid?.id ?? null,
        paidAt: paid?.paidAt ? paid.paidAt.toISOString() : null,
      })
    }

    occurrences.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    return NextResponse.json({ occurrences })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const json = await req.json()
    const body = createExpenseBillSchema.parse(json)

    const db = prisma as any
    if (!db.expenseBill) {
      return NextResponse.json(
        { error: "Modelo ExpenseBill não está disponível no Prisma Client. Rode `yarn prisma generate` e aplique as migrations." },
        { status: 500 }
      )
    }
    if (body.isRecurring) {
      if (!body.startDate) return NextResponse.json({ error: "startDate é obrigatório" }, { status: 400 })
      if (typeof body.dueDay !== "number") return NextResponse.json({ error: "dueDay é obrigatório" }, { status: 400 })

      const created = await db.expenseBill.create({
        data: {
          category: body.category,
          description: body.description,
          amount: body.amount,
          isRecurring: true,
          recurringType: body.recurringType ?? "MONTHLY",
          dueDay: body.dueDay,
          startDate: new Date(body.startDate),
          projectId: body.projectId ?? undefined,
          isActive: true,
        },
      })
      return NextResponse.json(created, { status: 201 })
    }

    if (!body.dueDate) return NextResponse.json({ error: "dueDate é obrigatório" }, { status: 400 })
    const created = await db.expenseBill.create({
      data: {
        category: body.category,
        description: body.description,
        amount: body.amount,
        isRecurring: false,
        dueDate: new Date(body.dueDate),
        projectId: body.projectId ?? undefined,
        isActive: true,
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

    const json = await req.json()
    const body = markExpensePaidSchema.parse(json)

    const due = new Date(body.dueDate)
    const dayStart = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 0, 0, 0, 0)
    const dayEnd = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59, 999)

    const db = prisma as any
    if (!db.expenseBill) {
      return NextResponse.json(
        { error: "Modelo ExpenseBill não está disponível no Prisma Client. Rode `yarn prisma generate` e aplique as migrations." },
        { status: 500 }
      )
    }
    const bill = await db.expenseBill.findUnique({ where: { id: body.billId } })
    if (!bill) return NextResponse.json({ error: "Despesa não encontrada" }, { status: 404 })

    const existing = await db.financialEntry.findFirst({
      where: {
        expenseBillId: body.billId,
        type: "EXPENSE",
        date: { gte: dayStart, lte: dayEnd },
      },
      select: { id: true },
    })
    if (existing) return NextResponse.json({ ok: true, financialEntryId: existing.id })

    const created = await db.financialEntry.create({
      data: {
        type: "EXPENSE",
        category: bill.category,
        description: bill.description,
        amount: bill.amount,
        date: due,
        isRecurring: false,
        recurringType: null,
        expenseBillId: bill.id,
        projectId: bill.projectId ?? undefined,
      },
      select: { id: true },
    })

    return NextResponse.json({ ok: true, financialEntryId: created.id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const json = await req.json()
    const body = updateExpenseBillSchema.parse(json)

    const db = prisma as any
    if (!db.expenseBill) {
      return NextResponse.json(
        { error: "Modelo ExpenseBill não está disponível no Prisma Client. Rode `yarn prisma generate` e aplique as migrations." },
        { status: 500 }
      )
    }

    const bill = await db.expenseBill.findUnique({ where: { id: body.billId } })
    if (!bill) return NextResponse.json({ error: "Despesa não encontrada" }, { status: 404 })

    const updateData: any = {}
    if (body.category !== undefined) updateData.category = body.category
    if (body.description !== undefined) updateData.description = body.description
    if (body.amount !== undefined) updateData.amount = body.amount
    if (body.projectId !== undefined) updateData.projectId = body.projectId
    if (body.isRecurring !== undefined) updateData.isRecurring = body.isRecurring
    if (body.recurringType !== undefined) updateData.recurringType = body.recurringType
    if (body.dueDay !== undefined) updateData.dueDay = body.dueDay
    if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null

    const updated = await db.expenseBill.update({
      where: { id: body.billId },
      data: updateData,
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

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const json = await req.json()
    const body = deleteExpenseBillSchema.parse(json)

    const db = prisma as any
    if (!db.expenseBill) {
      return NextResponse.json(
        { error: "Modelo ExpenseBill não está disponível no Prisma Client. Rode `yarn prisma generate` e aplique as migrations." },
        { status: 500 }
      )
    }

    await db.$transaction(async (tx: any) => {
      await tx.financialEntry.deleteMany({ where: { expenseBillId: body.billId } })
      await tx.expenseBill.delete({ where: { id: body.billId } })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

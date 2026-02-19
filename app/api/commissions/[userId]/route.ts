import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { getServerSession } from "next-auth"

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { userId } = await params
    const url = new URL(request.url)
    const fromParam = url.searchParams.get("from")
    const toParam = url.searchParams.get("to")
    let fromDate: Date | undefined
    let toDate: Date | undefined
    if (fromParam && toParam) {
      fromDate = new Date(fromParam)
      fromDate.setHours(0, 0, 0, 0)
      toDate = new Date(toParam)
      toDate.setHours(23, 59, 59, 999)
    }
    const rows = await prisma.$queryRaw`
      SELECT 
        "userId",
        "hasFixedSalary",
        "fixedSalary",
        "hourRate",
        "effectiveFrom"
      FROM compensation_profiles
      WHERE "userId" = ${userId}
      LIMIT 1
    ` as any[]

    const profile = rows[0] || {
      userId,
      hasFixedSalary: false,
      fixedSalary: null,
      hourRate: 0
    }

    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: userId,
        status: "COMPLETED",
        ...(fromDate && toDate
          ? {
              OR: [
                { completedAt: { gte: fromDate, lte: toDate } },
                { endTime: { gte: fromDate, lte: toDate } },
                { updatedAt: { gte: fromDate, lte: toDate } },
                { startDate: { gte: fromDate, lte: toDate } }
              ]
            }
          : {})
      },
      select: {
        id: true,
        title: true,
        completedAt: true,
        endTime: true,
        updatedAt: true,
        startDate: true,
        actualMinutes: true,
        estimatedMinutes: true,
        project: { select: { name: true } }
      },
      orderBy: { completedAt: "desc" }
    })

    const totalMinutes = tasks.reduce((sum, t) => {
      const m = t.actualMinutes ?? t.estimatedMinutes ?? 0
      return sum + m
    }, 0)
    const variablePay = (totalMinutes / 60) * (profile.hourRate || 0)
    const fixed = profile.hasFixedSalary ? (profile.fixedSalary || 0) : 0
    const totalPay = fixed + variablePay

    return NextResponse.json({
      profile,
      summary: {
        minutesCompleted: totalMinutes,
        variablePay,
        fixedSalary: profile.fixedSalary ?? null,
        hasFixedSalary: !!profile.hasFixedSalary,
        hourRate: profile.hourRate || 0,
        totalPay
      },
      tasks: tasks.map(t => ({
        id: t.id,
        title: t.title,
        projectName: t.project?.name || null,
        minutes: t.actualMinutes ?? t.estimatedMinutes ?? 0,
        completedAt: t.completedAt,
        date: t.completedAt ?? t.endTime ?? t.updatedAt ?? t.startDate ?? null
      }))
    })
  } catch (error) {
    console.error("[commissions:user] GET error", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { userId } = await params
    const body = await request.json()
    const { hasFixedSalary, fixedSalary, hourRate } = body

    await prisma.$executeRaw`
      INSERT INTO compensation_profiles ("id","userId","hasFixedSalary","fixedSalary","hourRate","effectiveFrom","createdAt","updatedAt")
      VALUES (${userId}, ${userId}, ${!!hasFixedSalary}, ${fixedSalary ?? null}, ${hourRate ?? 0}, NOW(), NOW(), NOW())
      ON CONFLICT ("userId") DO UPDATE SET 
        "hasFixedSalary" = EXCLUDED."hasFixedSalary",
        "fixedSalary" = EXCLUDED."fixedSalary",
        "hourRate" = EXCLUDED."hourRate",
        "updatedAt" = NOW()
    `

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[commissions:user] PUT error", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

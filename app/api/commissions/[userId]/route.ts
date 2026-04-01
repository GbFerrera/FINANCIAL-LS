import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function normalizeAccess(input: string | undefined, role?: string): "OWN_READ" | "OWN_EDIT" | "ALL_EDIT" {
  if (!input) return role === "ADMIN" ? "ALL_EDIT" : "OWN_READ"
  switch (input) {
    case "OWN_READ":
    case "OWN_EDIT":
    case "ALL_EDIT":
      return input
    case "OWN":
      return "OWN_READ"
    case "ALL":
    case "EDIT":
      return "ALL_EDIT"
    default:
      return role === "ADMIN" ? "ALL_EDIT" : "OWN_READ"
  }
}

async function getCommissionsAccess(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, skillsInterests: true } } as any)
  if (!u) return "OWN_READ" as const
  const stored = (u.skillsInterests as any) || {}
  return normalizeAccess(stored.commissionsAccess, u.role)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { userId } = await params
    const access = await getCommissionsAccess(session.user.id)
    const canView =
      session.user.role === "ADMIN" ||
      session.user.id === userId ||
      access === "ALL_EDIT"
    if (!canView) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 })
    }
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
    let rows: any[] = []
    try {
      rows = await prisma.$queryRaw`
        SELECT 
          "userId",
          "hasFixedSalary",
          "fixedSalary",
          "hourRate",
          "bonusPerTask",
          "effectiveFrom"
        FROM compensation_profiles
        WHERE "userId" = ${userId}
        LIMIT 1
      ` as any[]
    } catch {
      const raw = await prisma.$queryRaw`
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
      rows = raw.map((r: any) => ({ ...r, bonusPerTask: 0 }))
    }

    let profile = rows[0] || {
      userId,
      hasFixedSalary: false,
      fixedSalary: null,
      hourRate: 0,
      bonusPerTask: 0
    }

    // Fallback: se bonusPerTask não estiver disponível via compensation_profiles,
    // buscar no JSON skillsInterests do próprio usuário (chave: commissionsBonusPerTask)
    if (profile.bonusPerTask == null || Number.isNaN(profile.bonusPerTask)) {
      try {
        const u = await prisma.user.findUnique({
          where: { id: userId },
          select: { skillsInterests: true }
        })
        const fallback = ((u?.skillsInterests as any) || {}).commissionsBonusPerTask
        if (typeof fallback === 'number') {
          profile.bonusPerTask = fallback
        }
      } catch {
        // ignore
      }
    }

    let tasks: any[] = []
    try {
      tasks = await prisma.task.findMany({
        where: {
          assigneeId: userId,
          status: "COMPLETED",
          ...(fromDate && toDate
            ? {
                OR: [
                  { completedAt: { gte: fromDate, lte: toDate } as any },
                  { AND: [{ completedAt: null }, { endTime: { gte: fromDate, lte: toDate } as any }] as any },
                  { AND: [{ completedAt: null }, { endTime: null }, { updatedAt: { gte: fromDate, lte: toDate } as any }] as any }
                ]
              }
            : {})
        },
        // cast as any to accommodate schema addition before regenerated types
        select: ({
          id: true,
          title: true,
          completedAt: true,
          endTime: true,
          actualMinutes: true,
          estimatedMinutes: true,
          hasBonus: true,
          project: { select: { name: true } }
        } as any),
        orderBy: { completedAt: "desc" }
      }) as any[]
    } catch {
      const rowsTasks = await prisma.task.findMany({
        where: {
          assigneeId: userId,
          status: "COMPLETED",
          ...(fromDate && toDate
            ? {
                OR: [
                  { completedAt: { gte: fromDate, lte: toDate } as any },
                  { AND: [{ completedAt: null }, { endTime: { gte: fromDate, lte: toDate } as any }] as any },
                  { AND: [{ completedAt: null }, { endTime: null }, { updatedAt: { gte: fromDate, lte: toDate } as any }] as any }
                ]
              }
            : {})
        },
        select: {
          id: true,
          title: true,
          completedAt: true,
          endTime: true,
          actualMinutes: true,
          estimatedMinutes: true,
          project: { select: { name: true } }
        },
        orderBy: { completedAt: "desc" }
      })
      tasks = rowsTasks.map((t: any) => ({ ...t, hasBonus: false }))
    }

    const totalMinutes = tasks.reduce((sum: number, t: any) => sum + (t.actualMinutes ?? t.estimatedMinutes ?? 0), 0)
    const variablePay = tasks.reduce((sum: number, t: any) => {
      const minutes = (t.actualMinutes ?? t.estimatedMinutes ?? 0)
      const rate = t.hasBonus ? (profile.bonusPerTask ?? 0) : (profile.hourRate || 0)
      return sum + (minutes / 60) * rate
    }, 0)
    const bonusCount = tasks.filter((t: any) => t.hasBonus).length
    const bonusTotal = tasks.reduce((sum: number, t: any) => {
      const minutes = (t.actualMinutes ?? t.estimatedMinutes ?? 0)
      return sum + (t.hasBonus ? (minutes / 60) * (profile.bonusPerTask ?? 0) : 0)
    }, 0)
    const fixed = profile.hasFixedSalary ? (profile.fixedSalary || 0) : 0
    const totalPay = Number(fixed) + Number(variablePay)

    return NextResponse.json({
      profile,
      summary: {
        minutesCompleted: totalMinutes,
        variablePay,
        fixedSalary: profile.fixedSalary ?? null,
        hasFixedSalary: !!profile.hasFixedSalary,
        hourRate: profile.hourRate || 0,
        bonusPerTask: profile.bonusPerTask || 0,
        bonusCount,
        bonusTotal,
        totalPay
      },
      tasks: tasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        projectName: t.project?.name || null,
        minutes: (t.actualMinutes ?? t.estimatedMinutes) ?? 0,
        hasBonus: !!t.hasBonus,
        completedAt: t.completedAt,
        date: t.completedAt ?? t.endTime ?? null
      }))
    })
  } catch (error) {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { userId } = await params
    const access = await getCommissionsAccess(session.user.id)
    const canEdit =
      session.user.role === "ADMIN" ||
      access === "ALL_EDIT" ||
      (session.user.id === userId && access === "OWN_EDIT")
    if (!canEdit) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 })
    }
    const body = await request.json()
    const { hasFixedSalary, fixedSalary, hourRate, bonusPerTask } = body

    try {
      await prisma.$executeRaw`
        INSERT INTO compensation_profiles ("id","userId","hasFixedSalary","fixedSalary","hourRate","effectiveFrom","createdAt","updatedAt")
        VALUES (${userId}, ${userId}, ${!!hasFixedSalary}, ${fixedSalary ?? null}, ${hourRate ?? 0}, NOW(), NOW(), NOW())
        ON CONFLICT ("userId") DO UPDATE SET 
          "hasFixedSalary" = EXCLUDED."hasFixedSalary",
          "fixedSalary" = EXCLUDED."fixedSalary",
          "hourRate" = EXCLUDED."hourRate",
          "bonusPerTask" = ${bonusPerTask ?? 0},
          "updatedAt" = NOW()
      `
    } catch {
      // Persistir fallback do bonusPerTask no JSON do usuário
      try {
        const existing = await prisma.user.findUnique({
          where: { id: userId },
          select: { skillsInterests: true }
        })
        const merged = {
          ...(existing?.skillsInterests as any || {}),
          commissionsBonusPerTask: bonusPerTask ?? 0
        }
        await prisma.user.update({
          where: { id: userId },
          data: { skillsInterests: merged as any }
        })
      } catch {
        // ignore
      }
      // Fallback sem a coluna bonusPerTask
      await prisma.$executeRaw`
        INSERT INTO compensation_profiles ("id","userId","hasFixedSalary","fixedSalary","hourRate","effectiveFrom","createdAt","updatedAt")
        VALUES (${userId}, ${userId}, ${!!hasFixedSalary}, ${fixedSalary ?? null}, ${hourRate ?? 0}, NOW(), NOW(), NOW())
        ON CONFLICT ("userId") DO UPDATE SET 
          "hasFixedSalary" = EXCLUDED."hasFixedSalary",
          "fixedSalary" = EXCLUDED."fixedSalary",
          "hourRate" = EXCLUDED."hourRate",
          "updatedAt" = NOW()
      `
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

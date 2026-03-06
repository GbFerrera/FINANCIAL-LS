import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const prisma = new PrismaClient()

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

async function getCommissionsAccess(userId: string, prisma: PrismaClient) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, skillsInterests: true } } as any)
  if (!u) return "OWN_READ" as const
  const stored = (u.skillsInterests as any) || {}
  return normalizeAccess(stored.commissionsAccess, u.role)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const url = new URL(request.url)
    const fromParam = url.searchParams.get("from")
    const toParam = url.searchParams.get("to")
    let fromDate: Date | undefined
    let toDate: Date | undefined
    if (fromParam && toParam) {
      // Interpretar datas como locais para evitar off-by-one de fuso
      const [fy, fm, fd] = fromParam.split("-").map((v) => parseInt(v, 10))
      const [ty, tm, td] = toParam.split("-").map((v) => parseInt(v, 10))
      fromDate = new Date(fy, (fm - 1), fd, 0, 0, 0, 0)
      toDate = new Date(ty, (tm - 1), td, 23, 59, 59, 999)
    }

    const access = await getCommissionsAccess(session.user.id, prisma)
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, avatar: true, role: true, skillsInterests: true }
    })
    const filteredUsers = access === "ALL_EDIT" ? users : users.filter(u => u.id === session.user.id)

    let profiles: { userId: string; hasFixedSalary: boolean; fixedSalary: number | null; hourRate: number; bonusPerTask?: number }[] = []
    try {
      profiles = await prisma.$queryRaw`
        SELECT 
          "userId",
          "hasFixedSalary",
          "fixedSalary",
          "hourRate",
          "bonusPerTask"
        FROM compensation_profiles
      ` as any
    } catch {
      // Fallback para ambientes sem a coluna bonusPerTask aplicada ainda
      const rows = await prisma.$queryRaw`
        SELECT 
          "userId",
          "hasFixedSalary",
          "fixedSalary",
          "hourRate"
        FROM compensation_profiles
      ` as any
      profiles = rows.map((r: any) => ({ ...r, bonusPerTask: 0 }))
    }
    const profileByUser: Record<string, { userId: string; hasFixedSalary: boolean; fixedSalary: number | null; hourRate: number; bonusPerTask: number }> = {}
    for (const p of profiles) {
      // Fallback: se não veio bonusPerTask, tentar do JSON do usuário
      let bp = p.bonusPerTask
      if (bp == null) {
        const u = users.find(u => u.id === p.userId)
        const fallback = ((u?.skillsInterests as any) || {}).commissionsBonusPerTask
        if (typeof fallback === 'number') {
          bp = fallback
        }
      }
      profileByUser[p.userId] = {
        userId: p.userId,
        hasFixedSalary: !!p.hasFixedSalary,
        fixedSalary: p.fixedSalary ?? null,
        hourRate: p.hourRate || 0,
        bonusPerTask: bp ?? 0
      }
    }

    const result = []
    for (const u of filteredUsers) {
      const profile = profileByUser[u.id] || {
        userId: u.id,
        hasFixedSalary: false,
        fixedSalary: null,
        hourRate: 0
      }

      // Buscar tarefas com tolerância a ambientes sem a coluna hasBonus
      let tasks: Array<{ estimatedMinutes: number | null; actualMinutes?: number | null; hasBonus?: boolean; completedAt?: Date | null; endTime?: Date | null; updatedAt?: Date }> = []
      try {
        tasks = await prisma.task.findMany({
          where: {
            assigneeId: u.id,
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
          // cast as any to accommodate recent schema additions before typegen
          select: ({ estimatedMinutes: true, actualMinutes: true, hasBonus: true, completedAt: true, endTime: true, updatedAt: true } as any)
        }) as any
      } catch {
        // Fallback sem hasBonus
        const rows = await prisma.task.findMany({
          where: {
            assigneeId: u.id,
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
          select: { estimatedMinutes: true, actualMinutes: true, completedAt: true, endTime: true, updatedAt: true } as any
        })
        tasks = rows.map((r: any) => ({ estimatedMinutes: r.estimatedMinutes ?? 0, actualMinutes: r.actualMinutes ?? null, hasBonus: false, completedAt: r.completedAt, endTime: r.endTime, updatedAt: r.updatedAt }))
      }

      const variablePay = tasks.reduce((sum, t) => {
        const minutes = (t.actualMinutes ?? t.estimatedMinutes ?? 0)
        const rate = t.hasBonus ? (profile.bonusPerTask ?? 0) : (profile.hourRate || 0)
        return sum + (minutes / 60) * rate
      }, 0)
      const bonusCount = tasks.filter((t) => !!t.hasBonus).length
      const bonusTotal = tasks.reduce((sum, t) => {
        const minutes = (t.actualMinutes ?? t.estimatedMinutes ?? 0)
        return sum + (t.hasBonus ? (minutes / 60) * (profile.bonusPerTask ?? 0) : 0)
      }, 0)
      const fixed = profile.hasFixedSalary ? (profile.fixedSalary || 0) : 0
      const totalPay = fixed + variablePay

      result.push({
        userId: u.id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        role: u.role,
        hasFixedSalary: !!profile.hasFixedSalary,
        fixedSalary: profile.fixedSalary ?? null,
        hourRate: profile.hourRate || 0,
        bonusPerTask: profile.bonusPerTask || 0,
        minutesCompleted: tasks.reduce((s, t) => s + (t.actualMinutes ?? t.estimatedMinutes ?? 0), 0),
        variablePay,
        bonusCount,
        bonusTotal,
        totalPay
      })
    }

    return NextResponse.json({ profiles: result, access })
  } catch (error) {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

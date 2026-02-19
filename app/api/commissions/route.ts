import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { getServerSession } from "next-auth"

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
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

    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, avatar: true, role: true }
    })

    const profiles = await prisma.$queryRaw`
      SELECT 
        "userId",
        "hasFixedSalary",
        "fixedSalary",
        "hourRate"
      FROM compensation_profiles
    ` as { userId: string; hasFixedSalary: boolean; fixedSalary: number | null; hourRate: number }[]
    const profileByUser: Record<string, { userId: string; hasFixedSalary: boolean; fixedSalary: number | null; hourRate: number }> = {}
    for (const p of profiles) {
      profileByUser[p.userId] = {
        userId: p.userId,
        hasFixedSalary: !!p.hasFixedSalary,
        fixedSalary: p.fixedSalary ?? null,
        hourRate: p.hourRate || 0
      }
    }

    const result = []
    for (const u of users) {
      const profile = profileByUser[u.id] || {
        userId: u.id,
        hasFixedSalary: false,
        fixedSalary: null,
        hourRate: 0
      }

      const tasks = await prisma.task.findMany({
        where: {
          assigneeId: u.id,
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
        select: { actualMinutes: true, estimatedMinutes: true }
      })

      const totalMinutes = tasks.reduce((sum, t) => {
        const m = t.actualMinutes ?? t.estimatedMinutes ?? 0
        return sum + m
      }, 0)
      const variablePay = (totalMinutes / 60) * (profile.hourRate || 0)
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
        minutesCompleted: totalMinutes,
        variablePay,
        totalPay
      })
    }

    return NextResponse.json({ profiles: result })
  } catch (error) {
    console.error("[commissions] GET error", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

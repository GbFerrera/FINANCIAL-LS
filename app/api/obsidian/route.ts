import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim() || ""

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, name: true, email: true },
    })

    if (!currentUser) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    const isAdmin = currentUser.role === "ADMIN"
    const now = new Date()
    const nextSevenDays = new Date()
    nextSevenDays.setDate(nextSevenDays.getDate() + 7)

    const visibleProjectsWhere: any = isAdmin ? {} : { team: { some: { userId: session.user.id } } }
    const visibleTasksWhere: any = isAdmin ? {} : { project: { team: { some: { userId: session.user.id } } } }
    const visibleNotesWhere: any = isAdmin
      ? {}
      : {
          OR: [
            { createdById: session.user.id },
            { access: { some: { userId: session.user.id } } },
          ],
        }

    const searchProjectsWhere: any = q
      ? {
          AND: [
            visibleProjectsWhere,
            {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { client: { name: { contains: q, mode: "insensitive" } } },
              ],
            },
          ],
        }
      : visibleProjectsWhere

    const searchTasksWhere: any = q
      ? {
          AND: [
            { ...visibleTasksWhere, isArchived: false },
            {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { project: { name: { contains: q, mode: "insensitive" } } },
              ],
            },
          ],
        }
      : { ...visibleTasksWhere, isArchived: false }

    const searchNotesWhere: any = q
      ? {
          AND: [
            visibleNotesWhere,
            {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { content: { contains: q, mode: "insensitive" } },
                { project: { name: { contains: q, mode: "insensitive" } } },
              ],
            },
          ],
        }
      : visibleNotesWhere

    const [
      totalProjects,
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasksCount,
      upcomingTasksCount,
      notesCount,
      teamCount,
      projects,
      recentTasks,
      notes,
      overdueTasks,
      upcomingTasks,
    ] = await Promise.all([
      prisma.project.count({ where: visibleProjectsWhere }),
      prisma.task.count({ where: { ...visibleTasksWhere, isArchived: false } as any }),
      prisma.task.count({
        where: {
          ...visibleTasksWhere,
          isArchived: false,
          status: "COMPLETED",
        } as any,
      }),
      prisma.task.count({
        where: {
          ...visibleTasksWhere,
          isArchived: false,
          status: { not: "COMPLETED" },
        } as any,
      }),
      prisma.task.count({
        where: {
          ...visibleTasksWhere,
          isArchived: false,
          status: { not: "COMPLETED" },
          dueDate: { lt: now },
        } as any,
      }),
      prisma.task.count({
        where: {
          ...visibleTasksWhere,
          isArchived: false,
          status: { not: "COMPLETED" },
          dueDate: { gte: now, lte: nextSevenDays },
        } as any,
      }),
      prisma.note.count({ where: visibleNotesWhere }),
      isAdmin ? prisma.user.count() : Promise.resolve(1),
      prisma.project.findMany({
        where: searchProjectsWhere,
        take: q ? 12 : 6,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          updatedAt: true,
          client: { select: { name: true } },
          _count: { select: { tasks: true, milestones: true } },
        },
      }),
      prisma.task.findMany({
        where: searchTasksWhere,
        take: q ? 20 : 8,
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          updatedAt: true,
          completedAt: true,
          projectId: true,
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
        },
      }),
      prisma.note.findMany({
        where: searchNotesWhere,
        take: q ? 20 : 8,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          content: true,
          updatedAt: true,
          project: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      prisma.task.findMany({
        where: {
          ...visibleTasksWhere,
          isArchived: false,
          status: { not: "COMPLETED" },
          dueDate: { lt: now },
        } as any,
        take: 8,
        orderBy: { dueDate: "asc" },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          projectId: true,
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
        },
      }),
      prisma.task.findMany({
        where: {
          ...visibleTasksWhere,
          isArchived: false,
          status: { not: "COMPLETED" },
          dueDate: { gte: now, lte: nextSevenDays },
        } as any,
        take: 8,
        orderBy: { dueDate: "asc" },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          projectId: true,
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
        },
      }),
    ])

    let finance = null
    if (isAdmin) {
      const lastThirtyDays = new Date()
      lastThirtyDays.setDate(lastThirtyDays.getDate() - 30)

      const financeEntries = await prisma.financialEntry.findMany({
        where: {
          date: { gte: lastThirtyDays },
        },
        select: {
          type: true,
          amount: true,
        },
      })

      const income = financeEntries
        .filter((entry) => entry.type === "INCOME")
        .reduce((sum, entry) => sum + entry.amount, 0)

      const expenses = financeEntries
        .filter((entry) => entry.type === "EXPENSE")
        .reduce((sum, entry) => sum + entry.amount, 0)

      finance = {
        income,
        expenses,
        balance: income - expenses,
        entries: financeEntries.length,
      }
    }

    return NextResponse.json({
      viewer: {
        id: session.user.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
      },
      summary: {
        totalProjects,
        totalTasks,
        completedTasks,
        pendingTasks,
        overdueTasks: overdueTasksCount,
        upcomingTasks: upcomingTasksCount,
        notesCount,
        teamCount,
      },
      finance,
      projects,
      recentTasks,
      notes,
      overdueTasks,
      upcomingTasks,
      search: q,
    })
  } catch (error) {
    console.error("Erro ao carregar hub Obsidian:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

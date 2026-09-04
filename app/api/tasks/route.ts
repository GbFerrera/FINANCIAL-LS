import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { STATE_GROUP_OPTIONS, UNASSIGNED_ASSIGNEE } from "@/lib/task-filters"
import { z } from "zod"

const querySchema = z.object({
  projectId: z.string().min(1).optional(),
  projectIds: z.string().min(1).optional(),
  search: z.string().optional(),
  mention: z.string().optional(),
  statuses: z.string().min(1).optional(),
  stateGroups: z.string().min(1).optional(),
  assigneeIds: z.string().min(1).optional(),
  priorities: z.string().min(1).optional(),
  milestoneIds: z.string().min(1).optional(),
  sprintIds: z.string().min(1).optional(),
  startDateFrom: z.string().optional(),
  startDateTo: z.string().optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
  updatedFrom: z.string().optional(),
  updatedTo: z.string().optional(),
  includeArchived: z.enum(["true", "false"]).optional(),
  archivedOnly: z.enum(["true", "false"]).optional(),
})

function splitCsv(value?: string) {
  if (!value) return []
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function dayStart(value: string) {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

function dayEnd(value: string) {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999)
}

function dateRange(field: string, from?: string, to?: string) {
  if (!from && !to) return null
  const range: { gte?: Date; lte?: Date } = {}
  if (from) range.gte = dayStart(from)
  if (to) range.lte = dayEnd(to)
  return { [field]: range }
}

function statusesFromGroups(groups: string[]) {
  const set = new Set<string>()
  for (const g of groups) {
    const opt = STATE_GROUP_OPTIONS.find((o) => o.value === g)
    opt?.statuses.forEach((s) => set.add(s))
  }
  return [...set]
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      projectId: searchParams.get("projectId") || undefined,
      projectIds: searchParams.get("projectIds") || undefined,
      search: searchParams.get("search") || undefined,
      mention: searchParams.get("mention") || undefined,
      statuses: searchParams.get("statuses") || undefined,
      stateGroups: searchParams.get("stateGroups") || undefined,
      assigneeIds: searchParams.get("assigneeIds") || undefined,
      priorities: searchParams.get("priorities") || undefined,
      milestoneIds: searchParams.get("milestoneIds") || undefined,
      sprintIds: searchParams.get("sprintIds") || undefined,
      startDateFrom: searchParams.get("startDateFrom") || undefined,
      startDateTo: searchParams.get("startDateTo") || undefined,
      dueDateFrom: searchParams.get("dueDateFrom") || undefined,
      dueDateTo: searchParams.get("dueDateTo") || undefined,
      createdFrom: searchParams.get("createdFrom") || undefined,
      createdTo: searchParams.get("createdTo") || undefined,
      updatedFrom: searchParams.get("updatedFrom") || undefined,
      updatedTo: searchParams.get("updatedTo") || undefined,
      includeArchived: searchParams.get("includeArchived") || undefined,
      archivedOnly: searchParams.get("archivedOnly") || undefined,
    })

    if (!parsed.success) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 })
    }

    const projectIds =
      parsed.data.projectIds && parsed.data.projectIds !== "all"
        ? splitCsv(parsed.data.projectIds)
        : parsed.data.projectId && parsed.data.projectId !== "all"
          ? [parsed.data.projectId]
          : []

    const statuses = splitCsv(parsed.data.statuses)
    const groupStatuses = statusesFromGroups(splitCsv(parsed.data.stateGroups))
    const mergedStatuses = [...new Set([...statuses, ...groupStatuses])]

    const priorities = splitCsv(parsed.data.priorities)
    const assigneeIds = splitCsv(parsed.data.assigneeIds)
    const milestoneIds = splitCsv(parsed.data.milestoneIds)
    const sprintIds = splitCsv(parsed.data.sprintIds)

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    const isAdmin = user?.role === "ADMIN"

    const where: any = {}
    if (projectIds.length > 0) where.projectId = { in: projectIds }
    if (mergedStatuses.length > 0) where.status = { in: mergedStatuses }
    if (priorities.length > 0) where.priority = { in: priorities }
    if (milestoneIds.length > 0) where.milestoneId = { in: milestoneIds }
    if (sprintIds.length > 0) where.sprintId = { in: sprintIds }

    if (assigneeIds.length > 0) {
      const assigned = assigneeIds.filter((id) => id !== UNASSIGNED_ASSIGNEE)
      const wantsUnassigned = assigneeIds.includes(UNASSIGNED_ASSIGNEE)
      if (wantsUnassigned && assigned.length > 0) {
        where.OR = [{ assigneeId: null }, { assigneeId: { in: assigned } }]
      } else if (wantsUnassigned) {
        where.assigneeId = null
      } else {
        where.assigneeId = { in: assigned }
      }
    }

    const search = parsed.data.search?.trim()
    const mention = parsed.data.mention?.trim()
    const textQuery = mention || search
    if (textQuery) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { title: { contains: textQuery, mode: "insensitive" } },
            { description: { contains: textQuery, mode: "insensitive" } },
          ],
        },
      ]
    }

    for (const clause of [
      dateRange("startDate", parsed.data.startDateFrom, parsed.data.startDateTo),
      dateRange("dueDate", parsed.data.dueDateFrom, parsed.data.dueDateTo),
      dateRange("createdAt", parsed.data.createdFrom, parsed.data.createdTo),
      dateRange("updatedAt", parsed.data.updatedFrom, parsed.data.updatedTo),
    ]) {
      if (clause) Object.assign(where, clause)
    }

    const includeArchived = parsed.data.includeArchived === "true"
    const archivedOnly = parsed.data.archivedOnly === "true"
    if (archivedOnly) {
      where.isArchived = true
    } else if (!includeArchived) {
      where.isArchived = false
    }

    if (!isAdmin) {
      where.project = {
        ...(where.project || {}),
        team: { some: { userId: session.user.id } },
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        milestone: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        sprint: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ order: 'asc' }, { updatedAt: 'desc' }],
    })

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error("Erro ao buscar tarefas:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

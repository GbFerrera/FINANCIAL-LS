import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const querySchema = z.object({
  projectId: z.string().min(1).optional(),
  projectIds: z.string().min(1).optional(),
})

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
    })

    if (!parsed.success) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 })
    }

    const projectIds =
      parsed.data.projectIds && parsed.data.projectIds !== "all"
        ? parsed.data.projectIds
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : parsed.data.projectId && parsed.data.projectId !== "all"
          ? [parsed.data.projectId]
          : []

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    const isAdmin = user?.role === "ADMIN"

    const where: any = {}
    if (projectIds.length > 0) where.projectId = { in: projectIds }
    if (!isAdmin) {
      where.project = { team: { some: { userId: session.user.id } } }
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
      },
      orderBy: { updatedAt: "desc" },
    })

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error("Erro ao buscar tarefas:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

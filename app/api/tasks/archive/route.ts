import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { broadcastTaskEvent } from "@/lib/task-socket-server"

const bodySchema = z.object({
  taskIds: z.array(z.string().min(1)).optional(),
  projectIds: z.array(z.string().min(1)).optional(),
  scope: z.enum(["selected", "completed"]).default("selected"),
  archived: z.boolean().default(true),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const json = await request.json()
    const parsed = bodySchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.issues }, { status: 400 })
    }

    const { taskIds = [], projectIds = [], scope, archived } = parsed.data

    if (scope === "selected" && taskIds.length === 0) {
      return NextResponse.json({ error: "Nenhuma tarefa selecionada" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    const isAdmin = user?.role === "ADMIN"

    const where: any = {}
    if (!isAdmin) {
      where.project = { team: { some: { userId: session.user.id } } }
    }

    if (scope === "selected") {
      where.id = { in: taskIds }
    } else {
      where.status = "COMPLETED"
      if (projectIds.length > 0) {
        where.projectId = { in: projectIds }
      }
    }

    const tasks = (await prisma.task.findMany({
      where,
      select: {
        id: true,
        status: true,
        isArchived: true,
        projectId: true,
      } as any,
    })) as unknown as Array<{ id: string; status: string; isArchived: boolean; projectId: string }>

    const eligibleTaskIds = tasks
      .filter((task) => {
        if (archived) {
          return task.status === "COMPLETED" && !task.isArchived
        }
        return task.isArchived
      })
      .map((task) => task.id)

    if (eligibleTaskIds.length === 0) {
      return NextResponse.json({
        updatedCount: 0,
        skippedCount: tasks.length,
        message: archived
          ? "Nenhuma tarefa concluída disponível para arquivar"
          : "Nenhuma tarefa arquivada disponível para restaurar",
      })
    }

    await prisma.task.updateMany({
      where: { id: { in: eligibleTaskIds } },
      data: {
        isArchived: archived,
        archivedAt: archived ? new Date() : null,
        updatedAt: new Date(),
      } as any,
    })

    const affectedProjectIds = [...new Set(tasks.filter((t) => eligibleTaskIds.includes(t.id)).map((t) => t.projectId))]
    for (const projectId of affectedProjectIds) {
      const idsForProject = tasks
        .filter((t) => t.projectId === projectId && eligibleTaskIds.includes(t.id))
        .map((t) => t.id)

      broadcastTaskEvent({
        action: archived ? 'archived' : 'restored',
        taskId: idsForProject[0],
        taskIds: idsForProject,
        projectId,
        userId: session.user.id,
        userName: session.user.name || undefined,
      }).catch(console.error)
    }

    return NextResponse.json({
      updatedCount: eligibleTaskIds.length,
      skippedCount: Math.max(tasks.length - eligibleTaskIds.length, 0),
      message: archived
        ? "Tarefas arquivadas com sucesso"
        : "Tarefas restauradas com sucesso",
    })
  } catch (error) {
    console.error("Erro ao arquivar tarefas:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

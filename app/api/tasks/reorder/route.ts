import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { kanbanColumnStatus } from '@/lib/pipeline/task-utils'
import { z } from 'zod'

const schema = z.object({
  taskId: z.string().min(1),
  status: z.string().min(1),
  orderedTaskIds: z.array(z.string().min(1)).min(1),
  sourceOrderedTaskIds: z.array(z.string().min(1)).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = schema.parse(await request.json())
    const newStatus = kanbanColumnStatus(body.status)

    const movedTask = await prisma.task.findUnique({
      where: { id: body.taskId },
      include: {
        project: {
          include: {
            team: { select: { userId: true } },
          },
        },
      },
    })

    if (!movedTask) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    const isAdmin = user?.role === 'ADMIN'
    const isProjectMember = movedTask.project.team.some((m) => m.userId === session.user.id)

    if (!isAdmin && !isProjectMember) {
      return NextResponse.json({ error: 'Sem permissão para editar esta tarefa' }, { status: 403 })
    }

    if (
      !isAdmin &&
      newStatus === 'COMPLETED' &&
      movedTask.status !== 'COMPLETED' &&
      movedTask.status !== 'DONE'
    ) {
      return NextResponse.json(
        { error: 'Apenas administradores podem marcar tarefas como concluídas' },
        { status: 403 }
      )
    }

    const allIds = [
      ...body.orderedTaskIds,
      ...(body.sourceOrderedTaskIds ?? []),
    ]

    const tasks = await prisma.task.findMany({
      where: { id: { in: allIds } },
      select: { id: true, projectId: true },
    })

    if (tasks.length !== allIds.length) {
      return NextResponse.json({ error: 'Uma ou mais tarefas não foram encontradas' }, { status: 400 })
    }

    if (!isAdmin) {
      const allowedProjectIds = new Set(
        (
          await prisma.projectTeam.findMany({
            where: { userId: session.user.id },
            select: { projectId: true },
          })
        ).map((m) => m.projectId)
      )

      for (const task of tasks) {
        if (!allowedProjectIds.has(task.projectId)) {
          return NextResponse.json({ error: 'Sem permissão para reordenar estas tarefas' }, { status: 403 })
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      if (movedTask.status !== newStatus) {
        await tx.task.update({
          where: { id: body.taskId },
          data: {
            status: newStatus as never,
            ...(newStatus === 'COMPLETED' && !movedTask.completedAt
              ? { completedAt: new Date() }
              : {}),
            ...(newStatus !== 'COMPLETED' && movedTask.completedAt ? { completedAt: null } : {}),
          },
        })
      }

      for (let i = 0; i < body.orderedTaskIds.length; i++) {
        await tx.task.update({
          where: { id: body.orderedTaskIds[i] },
          data: { order: i },
        })
      }

      if (body.sourceOrderedTaskIds?.length) {
        for (let i = 0; i < body.sourceOrderedTaskIds.length; i++) {
          await tx.task.update({
            where: { id: body.sourceOrderedTaskIds[i] },
            data: { order: i },
          })
        }
      }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados inválidos', details: error.issues }, { status: 400 })
    }
    console.error('Erro ao reordenar tarefas:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

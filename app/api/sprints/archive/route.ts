import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSprintArchivable } from '@/lib/sprint-archive'

const bodySchema = z.object({
  sprintIds: z.array(z.string().min(1)).min(1),
  archived: z.boolean().default(true),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.issues }, { status: 400 })
    }

    const { sprintIds, archived } = parsed.data

    const sprints = await prisma.sprint.findMany({
      where: { id: { in: sprintIds } },
      select: { id: true, status: true, isArchived: true, endDate: true },
    })

    const eligibleIds = sprints
      .filter((sprint) => {
        if (archived) {
          return isSprintArchivable(sprint)
        }
        return sprint.isArchived
      })
      .map((sprint) => sprint.id)

    if (eligibleIds.length === 0) {
      return NextResponse.json({
        updatedCount: 0,
        skippedCount: sprints.length,
        message: archived
          ? 'Nenhuma sprint elegível para arquivar (planejamento, concluída, cancelada ou ativa já encerrada)'
          : 'Nenhuma sprint arquivada disponível para restaurar',
      })
    }

    await prisma.sprint.updateMany({
      where: { id: { in: eligibleIds } },
      data: {
        isArchived: archived,
        archivedAt: archived ? new Date() : null,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      updatedCount: eligibleIds.length,
      skippedCount: Math.max(sprints.length - eligibleIds.length, 0),
      message: archived ? 'Sprints arquivadas com sucesso' : 'Sprints restauradas com sucesso',
    })
  } catch (error) {
    console.error('Erro ao arquivar sprints:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

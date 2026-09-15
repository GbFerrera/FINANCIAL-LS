import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  buildTaskLabelsWhere,
  serializeTaskLabel,
  TASK_LABEL_COLORS,
  type TaskLabelScope,
} from '@/lib/task-labels'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const workspaceId = request.nextUrl.searchParams.get('workspaceId') || undefined

    const labels = await prisma.taskLabel.findMany({
      where: buildTaskLabelsWhere(session.user.id, workspaceId),
      orderBy: [{ scope: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ labels: labels.map(serializeTaskLabel) })
  } catch (error) {
    console.error('Erro ao listar etiquetas:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const scope = body.scope === 'GLOBAL' ? 'GLOBAL' : 'PERSONAL'
    const workspaceId =
      typeof body.workspaceId === 'string' && body.workspaceId.trim()
        ? body.workspaceId.trim()
        : null
    const color =
      typeof body.color === 'string' && TASK_LABEL_COLORS.includes(body.color as (typeof TASK_LABEL_COLORS)[number])
        ? body.color
        : TASK_LABEL_COLORS[0]

    if (!name) {
      return NextResponse.json({ error: 'Nome da etiqueta é obrigatório' }, { status: 400 })
    }

    if (workspaceId) {
      const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } })
      if (!workspace) {
        return NextResponse.json({ error: 'Espaço de trabalho não encontrado' }, { status: 404 })
      }
    }

    const userId = scope === 'PERSONAL' ? session.user.id : session.user.id

    const existing = await prisma.taskLabel.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        scope: scope as TaskLabelScope,
        userId: scope === 'PERSONAL' ? session.user.id : userId,
        workspaceId,
      },
    })

    if (existing) {
      return NextResponse.json(serializeTaskLabel(existing))
    }

    const label = await prisma.taskLabel.create({
      data: {
        name,
        color,
        scope: scope as TaskLabelScope,
        userId,
        workspaceId,
      },
    })

    return NextResponse.json(serializeTaskLabel(label), { status: 201 })
  } catch (error) {
    console.error('Erro ao criar etiqueta:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serializeTaskLabel, TASK_LABEL_COLORS } from '@/lib/task-labels'

async function canManageLabel(labelId: string, userId: string, isAdmin: boolean) {
  const label = await prisma.taskLabel.findUnique({ where: { id: labelId } })
  if (!label) return { label: null, allowed: false }

  const allowed =
    isAdmin ||
    label.userId === userId ||
    (label.scope === 'PERSONAL' && label.userId === userId)

  return { label, allowed }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    const isAdmin = user?.role === 'ADMIN'

    const { label, allowed } = await canManageLabel(params.id, session.user.id, isAdmin)
    if (!label) {
      return NextResponse.json({ error: 'Etiqueta não encontrada' }, { status: 404 })
    }
    if (!allowed) {
      return NextResponse.json({ error: 'Sem permissão para editar esta etiqueta' }, { status: 403 })
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : undefined
    const color =
      typeof body.color === 'string' && TASK_LABEL_COLORS.includes(body.color as (typeof TASK_LABEL_COLORS)[number])
        ? body.color
        : undefined

    if (name !== undefined && !name) {
      return NextResponse.json({ error: 'Nome da etiqueta é obrigatório' }, { status: 400 })
    }

    const updated = await prisma.taskLabel.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(color !== undefined ? { color } : {}),
      },
    })

    return NextResponse.json(serializeTaskLabel(updated))
  } catch (error) {
    console.error('Erro ao atualizar etiqueta:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    const isAdmin = user?.role === 'ADMIN'

    const { label, allowed } = await canManageLabel(params.id, session.user.id, isAdmin)
    if (!label) {
      return NextResponse.json({ error: 'Etiqueta não encontrada' }, { status: 404 })
    }
    if (!allowed) {
      return NextResponse.json({ error: 'Sem permissão para excluir esta etiqueta' }, { status: 403 })
    }

    await prisma.taskLabel.delete({ where: { id: params.id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao excluir etiqueta:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

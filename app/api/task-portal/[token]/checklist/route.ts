import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { findSharedTask } from '@/lib/task-share'

async function getSharedTaskId(token: string) {
  const task = await findSharedTask(token)
  return task?.id || null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const taskId = await getSharedTaskId(token)
    if (!taskId) {
      return NextResponse.json({ error: 'Link inválido ou desativado' }, { status: 404 })
    }

    const groups = await prisma.taskChecklistGroup.findMany({
      where: { taskId },
      orderBy: { order: 'asc' },
      include: { items: { orderBy: { order: 'asc' } } },
    })

    return NextResponse.json({ groups })
  } catch (error) {
    console.error('Erro task-portal checklist GET:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const taskId = await getSharedTaskId(token)
    if (!taskId) {
      return NextResponse.json({ error: 'Link inválido ou desativado' }, { status: 404 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'toggle_item') {
      const { itemId, done } = body
      const item = await prisma.taskChecklistItem.findFirst({
        where: { id: itemId, taskId },
      })
      if (!item) {
        return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })
      }

      const updated = await prisma.taskChecklistItem.update({
        where: { id: itemId },
        data: { done: Boolean(done) },
      })
      return NextResponse.json({ item: updated })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (error) {
    console.error('Erro task-portal checklist PATCH:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

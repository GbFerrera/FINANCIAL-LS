import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string; taskId: string } }
) {
  try {
    const { token, taskId } = params

    const user = await prisma.user.findUnique({
      where: { accessToken: token },
      select: { id: true, role: true }
    })
    if (!user || user.role !== 'TEAM') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, assigneeId: user.id },
      select: { id: true }
    })
    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    const groups = await prisma.taskChecklistGroup.findMany({
      where: { taskId },
      orderBy: { order: 'asc' },
      include: {
        items: { orderBy: { order: 'asc' } }
      }
    })

    return NextResponse.json({ groups })
  } catch (error) {
    console.error('Erro ao buscar checklist:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string; taskId: string } }
) {
  try {
    const { token, taskId } = params
    const body = await request.json()
    const { action } = body

    const user = await prisma.user.findUnique({
      where: { accessToken: token },
      select: { id: true, role: true }
    })
    if (!user || user.role !== 'TEAM') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, assigneeId: user.id },
      select: { id: true }
    })
    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    if (action === 'create_group') {
      const { title } = body
      const count = await prisma.taskChecklistGroup.count({ where: { taskId } })
      const group = await prisma.taskChecklistGroup.create({
        data: { title, taskId, order: count }
      })
      return NextResponse.json({ group }, { status: 201 })
    }

    if (action === 'create_item') {
      const { groupId, title, description } = body
      const group = await prisma.taskChecklistGroup.findFirst({
        where: { id: groupId, taskId }
      })
      if (!group) {
        return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })
      }
      const count = await prisma.taskChecklistItem.count({ where: { groupId } })
      const item = await prisma.taskChecklistItem.create({
        data: { title, description, groupId, taskId, order: count }
      })
      return NextResponse.json({ item }, { status: 201 })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (error) {
    console.error('Erro ao criar checklist:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { token: string; taskId: string } }
) {
  try {
    const { token, taskId } = params
    const body = await request.json()
    const { action } = body

    const user = await prisma.user.findUnique({
      where: { accessToken: token },
      select: { id: true, role: true }
    })
    if (!user || user.role !== 'TEAM') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, assigneeId: user.id },
      select: { id: true }
    })
    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    if (action === 'toggle_item') {
      const { itemId, done } = body
      const item = await prisma.taskChecklistItem.update({
        where: { id: itemId },
        data: { done }
      })
      return NextResponse.json({ item })
    }

    if (action === 'update_item') {
      const { itemId, title, description } = body
      const item = await prisma.taskChecklistItem.update({
        where: { id: itemId },
        data: { title, description }
      })
      return NextResponse.json({ item })
    }

    if (action === 'update_group') {
      const { groupId, title } = body
      const group = await prisma.taskChecklistGroup.update({
        where: { id: groupId },
        data: { title }
      })
      return NextResponse.json({ group })
    }

    if (action === 'reorder') {
      const { groupsOrder, itemsOrder } = body
      if (Array.isArray(groupsOrder)) {
        await Promise.all(
          groupsOrder.map((id: string, index: number) =>
            prisma.taskChecklistGroup.update({ where: { id }, data: { order: index } })
          )
        )
      }
      if (Array.isArray(itemsOrder)) {
        await Promise.all(
          itemsOrder.map((payload: { id: string; order: number }) =>
            prisma.taskChecklistItem.update({ where: { id: payload.id }, data: { order: payload.order } })
          )
        )
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (error) {
    console.error('Erro ao atualizar checklist:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { token: string; taskId: string } }
) {
  try {
    const { token, taskId } = params
    const { action, groupId, itemId } = await request.json()

    const user = await prisma.user.findUnique({
      where: { accessToken: token },
      select: { id: true, role: true }
    })
    if (!user || user.role !== 'TEAM') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, assigneeId: user.id },
      select: { id: true }
    })
    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    if (action === 'delete_group' && groupId) {
      await prisma.taskChecklistItem.deleteMany({ where: { groupId } })
      await prisma.taskChecklistGroup.delete({ where: { id: groupId } })
      return NextResponse.json({ ok: true })
    }

    if (action === 'delete_item' && itemId) {
      await prisma.taskChecklistItem.delete({ where: { id: itemId } })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (error) {
    console.error('Erro ao remover checklist:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

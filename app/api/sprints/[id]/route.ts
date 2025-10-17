import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { notifySprintStatusChange } from '@/lib/notifications'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const sprint = await prisma.sprint.findUnique({
      where: { id: params.id },
      include: {
        tasks: {
          include: {
            assignee: {
              select: { id: true, name: true, email: true, avatar: true }
            }
          },
          orderBy: { order: 'asc' }
        },
        project: {
          select: { id: true, name: true }
        }
      }
    })

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint não encontrada' }, { status: 404 })
    }

    return NextResponse.json(sprint)
  } catch (error) {
    console.error('Erro ao buscar sprint:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, status, startDate, endDate, goal, capacity } = body

    // Buscar sprint atual para comparar status
    const currentSprint = await prisma.sprint.findUnique({
      where: { id: params.id }
    })

    if (!currentSprint) {
      return NextResponse.json({ error: 'Sprint não encontrada' }, { status: 404 })
    }

    const oldStatus = currentSprint.status

    const sprint = await prisma.sprint.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(goal !== undefined && { goal }),
        ...(capacity !== undefined && { capacity })
      },
      include: {
        tasks: {
          include: {
            assignee: {
              select: { id: true, name: true, email: true, avatar: true }
            }
          }
        },
        project: {
          select: { id: true, name: true }
        }
      }
    })

    // Enviar notificação se o status mudou
    if (status && status !== oldStatus) {
      notifySprintStatusChange(params.id, oldStatus, status).catch(console.error)
    }

    return NextResponse.json(sprint)
  } catch (error) {
    console.error('Erro ao atualizar sprint:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Primeiro, remove todas as tarefas da sprint (move para backlog)
    await prisma.task.updateMany({
      where: { sprintId: params.id },
      data: { sprintId: null }
    })

    // Depois deleta a sprint
    await prisma.sprint.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Sprint deletada com sucesso' })
  } catch (error) {
    console.error('Erro ao deletar sprint:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

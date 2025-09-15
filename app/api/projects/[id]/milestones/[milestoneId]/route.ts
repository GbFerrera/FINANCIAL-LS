import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: {
    id: string
    milestoneId: string
  }
}

// PUT - Atualizar milestone
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se o usuário tem permissão (apenas ADMIN)
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { name, dueDate, status } = await request.json()

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    // Verificar se o milestone existe e pertence ao projeto
    const existingMilestone = await prisma.milestone.findFirst({
      where: {
        id: params.milestoneId,
        projectId: params.id
      }
    })

    if (!existingMilestone) {
      return NextResponse.json({ error: 'Milestone não encontrado' }, { status: 404 })
    }

    // Atualizar o milestone
    const updatedMilestone = await prisma.milestone.update({
      where: { id: params.milestoneId },
      data: {
        name: name.trim(),
        status: status || existingMilestone.status,
        dueDate: dueDate ? new Date(dueDate) : null,
        completedAt: status === 'COMPLETED' ? new Date() : status === 'PENDING' || status === 'IN_PROGRESS' ? null : existingMilestone.completedAt
      }
    })

    return NextResponse.json(updatedMilestone)
  } catch (error) {
    console.error('Erro ao atualizar milestone:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// DELETE - Excluir milestone
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se o usuário tem permissão (apenas ADMIN)
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Verificar se o milestone existe e pertence ao projeto
    const existingMilestone = await prisma.milestone.findFirst({
      where: {
        id: params.milestoneId,
        projectId: params.id
      }
    })

    if (!existingMilestone) {
      return NextResponse.json({ error: 'Milestone não encontrado' }, { status: 404 })
    }

    // Excluir o milestone
    await prisma.milestone.delete({
      where: { id: params.milestoneId }
    })

    return NextResponse.json({ message: 'Milestone excluído com sucesso' })
  } catch (error) {
    console.error('Erro ao excluir milestone:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// GET - Buscar milestone específico
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar milestone específico
    const milestone = await prisma.milestone.findFirst({
      where: {
        id: params.milestoneId,
        projectId: params.id
      }
    })

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone não encontrado' }, { status: 404 })
    }

    return NextResponse.json(milestone)
  } catch (error) {
    console.error('Erro ao buscar milestone:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
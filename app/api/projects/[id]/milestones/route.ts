import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: {
    id: string
  }
}

// POST - Criar novo milestone
export async function POST(
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

    // Verificar se o projeto existe
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    // Obter o próximo número de ordem
    const lastMilestone = await prisma.milestone.findFirst({
      where: { projectId: params.id },
      orderBy: { order: 'desc' },
      select: { order: true }
    })

    const nextOrder = (lastMilestone?.order || 0) + 1

    // Criar o milestone
    const milestone = await prisma.milestone.create({
      data: {
        name: name.trim(),
        status: status || 'PENDING',
        dueDate: dueDate ? new Date(dueDate) : null,
        order: nextOrder,
        projectId: params.id
      }
    })

    return NextResponse.json(milestone, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar milestone:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// GET - Listar milestones do projeto
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se o projeto existe
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    // Buscar milestones do projeto
    const milestones = await prisma.milestone.findMany({
      where: { projectId: params.id },
      orderBy: { order: 'asc' }
    })

    return NextResponse.json(milestones)
  } catch (error) {
    console.error('Erro ao buscar milestones:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
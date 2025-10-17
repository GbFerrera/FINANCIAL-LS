import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      title, 
      description, 
      projectId, 
      sprintId, 
      priority, 
      storyPoints, 
      assigneeId, 
      dueDate,
      startDate,
      startTime,
      estimatedMinutes
    } = body

    if (!title || !projectId) {
      return NextResponse.json({ 
        error: 'Título e ID do projeto são obrigatórios' 
      }, { status: 400 })
    }

    // Verificar se o projeto existe
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    // Calcular a próxima ordem
    const lastTask = await prisma.task.findFirst({
      where: { 
        projectId,
        sprintId: sprintId || null
      },
      orderBy: { order: 'desc' }
    })

    const nextOrder = (lastTask?.order || 0) + 1

    const task = await prisma.task.create({
      data: {
        title,
        description,
        projectId,
        sprintId: sprintId || null,
        priority: priority || 'MEDIUM',
        storyPoints,
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        startDate: startDate ? new Date(startDate) : null,
        startTime: startTime || null,
        estimatedMinutes: estimatedMinutes || null,
        order: nextOrder,
        status: 'TODO'
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true }
        },
        project: {
          select: { id: true, name: true }
        },
        sprint: {
          select: { id: true, name: true, status: true }
        }
      }
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar tarefa:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

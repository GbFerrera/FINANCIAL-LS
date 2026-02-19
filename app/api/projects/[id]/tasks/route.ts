import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

interface RouteParams {
  params: {
    id: string
  }
}

const taskSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED']).default('TODO'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  dueDate: z.string().optional().nullable(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable().transform(val => val === '' ? null : val),
  milestoneId: z.string().optional().nullable().transform(val => val === '' ? null : val),
  estimatedMinutes: z.number().optional(),
})

// POST - Criar nova tarefa
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

    const body = await request.json()
    const validatedData = taskSchema.parse(body)

    // Verificar se o projeto existe
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    // Verificar se o assignee existe (se fornecido)
    if (validatedData.assigneeId) {
      const assignee = await prisma.user.findUnique({
        where: { id: validatedData.assigneeId },
        select: { id: true }
      })

      if (!assignee) {
        return NextResponse.json({ error: 'Usuário responsável não encontrado' }, { status: 404 })
      }
    }

    // Verificar se o milestone existe (se fornecido)
    if (validatedData.milestoneId) {
      const milestone = await prisma.milestone.findFirst({
        where: { 
          id: validatedData.milestoneId,
          projectId: params.id
        },
        select: { id: true }
      })

      if (!milestone) {
        return NextResponse.json({ error: 'Milestone não encontrado neste projeto' }, { status: 404 })
      }
    }

    // Criar a tarefa
    const task = await prisma.task.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        status: validatedData.status,
        priority: validatedData.priority,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        startTime: validatedData.startTime,
        endTime: validatedData.endTime ? new Date(validatedData.endTime) : null,
        assigneeId: validatedData.assigneeId,
        milestoneId: validatedData.milestoneId,
        estimatedMinutes: validatedData.estimatedMinutes,
        projectId: params.id
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Erro ao criar tarefa:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// GET - Listar tarefas do projeto
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

    const tasks = await prisma.task.findMany({
      where: { projectId: params.id },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Erro ao buscar tarefas:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
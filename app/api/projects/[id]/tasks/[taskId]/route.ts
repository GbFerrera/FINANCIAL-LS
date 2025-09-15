import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

interface RouteParams {
  params: {
    id: string
    taskId: string
  }
}

const taskUpdateSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').optional(),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
  estimatedHours: z.number().optional(),
  actualHours: z.number().optional(),
})

// PUT - Atualizar tarefa
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

    const body = await request.json()
    const validatedData = taskUpdateSchema.parse(body)

    // Verificar se a tarefa existe e pertence ao projeto
    const existingTask = await prisma.task.findFirst({
      where: {
        id: params.taskId,
        projectId: params.id
      }
    })

    if (!existingTask) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
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

    // Preparar dados para atualização
    const updateData: any = {}
    
    if (validatedData.title !== undefined) updateData.title = validatedData.title
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status
      // Se a tarefa foi marcada como concluída, definir completedAt
      if (validatedData.status === 'COMPLETED' && !existingTask.completedAt) {
        updateData.completedAt = new Date()
      } else if (validatedData.status !== 'COMPLETED') {
        updateData.completedAt = null
      }
    }
    if (validatedData.priority !== undefined) updateData.priority = validatedData.priority
    if (validatedData.dueDate !== undefined) {
      updateData.dueDate = validatedData.dueDate ? new Date(validatedData.dueDate) : null
    }
    if (validatedData.assigneeId !== undefined) updateData.assigneeId = validatedData.assigneeId
    if (validatedData.estimatedHours !== undefined) updateData.estimatedHours = validatedData.estimatedHours
    if (validatedData.actualHours !== undefined) updateData.actualHours = validatedData.actualHours

    // Atualizar a tarefa
    const task = await prisma.task.update({
      where: { id: params.taskId },
      data: updateData,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json(task)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Erro ao atualizar tarefa:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// DELETE - Excluir tarefa
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

    // Verificar se a tarefa existe e pertence ao projeto
    const existingTask = await prisma.task.findFirst({
      where: {
        id: params.taskId,
        projectId: params.id
      }
    })

    if (!existingTask) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    // Excluir a tarefa
    await prisma.task.delete({
      where: { id: params.taskId }
    })

    return NextResponse.json({ message: 'Tarefa excluída com sucesso' })
  } catch (error) {
    console.error('Erro ao excluir tarefa:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// GET - Buscar tarefa específica
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se a tarefa existe e pertence ao projeto
    const task = await prisma.task.findFirst({
      where: {
        id: params.taskId,
        projectId: params.id
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Erro ao buscar tarefa:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
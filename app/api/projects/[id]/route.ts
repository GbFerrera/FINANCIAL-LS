import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { ProjectStatus } from '@prisma/client'

// Schema de validação para atualização de projeto
const updateProjectSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').optional(),
  description: z.string().optional(),
  clientId: z.string().min(1, 'Cliente é obrigatório').optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  startDate: z.string().transform((str) => new Date(str)).optional(),
  endDate: z.string().transform((str) => new Date(str)).optional(),
  budget: z.number().positive('Orçamento deve ser positivo').optional(),
  isPaused: z.boolean().optional(),
  pauseReason: z.string().optional(),
})

interface RouteParams {
  params: {
    id: string
  }
}

// GET - Buscar projeto por ID
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
          }
        },
        milestones: {
          select: {
            id: true,
            name: true,
            status: true,
            dueDate: true,
            completedAt: true,
            order: true,
          },
          orderBy: { order: 'asc' }
        },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            assignee: {
               select: {
                 id: true,
                 name: true,
                 email: true,
               }
             }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        team: {
          select: {
            id: true,
            role: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              }
            }
          }
        },
        _count: {
          select: {
            tasks: true,
            milestones: true,
            team: true,
            comments: true,
            files: true,
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Projeto não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('Erro ao buscar projeto:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar projeto
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateProjectSchema.parse(body)

    // Verificar se o projeto existe
    const existingProject = await prisma.project.findUnique({
      where: { id: params.id }
    })

    if (!existingProject) {
      return NextResponse.json(
        { error: 'Projeto não encontrado' },
        { status: 404 }
      )
    }

    // Se está atualizando o cliente, verificar se existe
    if (validatedData.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: validatedData.clientId }
      })

      if (!client) {
        return NextResponse.json(
          { error: 'Cliente não encontrado' },
          { status: 400 }
        )
      }
    }

    // Validar datas se ambas estão sendo fornecidas
    const startDate = validatedData.startDate || existingProject.startDate
    const endDate = validatedData.endDate || existingProject.endDate
    
    if (endDate && endDate <= startDate) {
      return NextResponse.json(
        { error: 'Data de fim deve ser posterior à data de início' },
        { status: 400 }
      )
    }

    // Se está pausando o projeto, definir pausedAt
    const updateData: any = { ...validatedData }
    if (validatedData.isPaused === true && !existingProject.isPaused) {
      updateData.pausedAt = new Date()
    } else if (validatedData.isPaused === false && existingProject.isPaused) {
      updateData.pausedAt = null
      updateData.pauseReason = null
    }

    const updatedProject = await prisma.project.update({
      where: { id: params.id },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
          }
        },
        _count: {
          select: {
            tasks: true,
            milestones: true,
            team: true,
            comments: true,
            files: true,
          }
        }
      }
    })

    return NextResponse.json(updatedProject)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Erro ao atualizar projeto:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// DELETE - Excluir projeto
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se o projeto existe
    const existingProject = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            tasks: true,
            milestones: true,
            team: true,
            files: true,
          }
        }
      }
    })

    if (!existingProject) {
      return NextResponse.json(
        { error: 'Projeto não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se há dados relacionados (opcional - pode permitir exclusão em cascata)
    const hasRelatedData = 
      existingProject._count.tasks > 0 ||
      existingProject._count.milestones > 0 ||
      existingProject._count.team > 0 ||
      existingProject._count.files > 0

    if (hasRelatedData) {
      return NextResponse.json(
        { 
          error: 'Não é possível excluir projeto com dados relacionados',
          details: {
            tasks: existingProject._count.tasks,
            milestones: existingProject._count.milestones,
            team: existingProject._count.team,
            files: existingProject._count.files,
          }
        },
        { status: 400 }
      )
    }

    await prisma.project.delete({
      where: { id: params.id }
    })

    return NextResponse.json(
      { message: 'Projeto excluído com sucesso' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Erro ao excluir projeto:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
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
  additionalClientIds: z.array(z.string().min(1)).optional()
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
        clients: {
          include: {
            client: {
              select: { id: true, name: true, email: true, company: true }
            }
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
            description: true,
            status: true,
            priority: true,
            dueDate: true,
            storyPoints: true,
            estimatedMinutes: true,
            startDate: true,
            startTime: true,
            endTime: true,
            milestone: {
              select: {
                id: true,
                name: true,
              }
            },
            assignee: {
               select: {
                 id: true,
                 name: true,
                 email: true,
                 avatar: true,
               }
             }
          },
          orderBy: [
            { status: 'asc' }, // TODO primeiro, depois IN_PROGRESS, depois DONE
            { createdAt: 'desc' }
          ]
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

    const { additionalClientIds, ...dataToUpdate } = updateData
    const updatedProject = await prisma.project.update({
      where: { id: params.id },
      data: dataToUpdate,
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

    if (additionalClientIds) {
      const ids = Array.from(new Set([updatedProject.clientId, ...additionalClientIds]))
      await prisma.$transaction(async (tx) => {
        await tx.projectClient.deleteMany({ where: { projectId: updatedProject.id, NOT: { clientId: { in: ids } } } })
        await Promise.all(
          ids.map((cid) =>
            tx.projectClient.upsert({
              where: { projectId_clientId: { projectId: updatedProject.id, clientId: cid } },
              update: {},
              create: { projectId: updatedProject.id, clientId: cid }
            })
          )
        )
      })
    }

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

    // Excluir todos os dados relacionados em cascata
    await prisma.$transaction(async (tx) => {
      // Excluir comentários das tarefas do projeto
      await tx.comment.deleteMany({
        where: {
          task: {
            projectId: params.id
          }
        }
      })

      // Excluir tarefas do projeto
      await tx.task.deleteMany({
        where: { projectId: params.id }
      })

      // Excluir milestones do projeto
      await tx.milestone.deleteMany({
        where: { projectId: params.id }
      })

      // Excluir membros da equipe do projeto
      await tx.projectTeam.deleteMany({
        where: { projectId: params.id }
      })

      // Excluir arquivos do projeto
      await tx.projectFile.deleteMany({
        where: { projectId: params.id }
      })

      // Atualizar entradas financeiras (remover associação com o projeto)
      await tx.financialEntry.updateMany({
        where: { projectId: params.id },
        data: { projectId: null }
      })

      // Excluir notificações relacionadas ao projeto
      await tx.notification.deleteMany({
        where: {
          OR: [
            { title: { contains: existingProject.name } },
            { message: { contains: existingProject.name } }
          ]
        }
      })

      // Finalmente, excluir o projeto
      await tx.project.delete({
        where: { id: params.id }
      })
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

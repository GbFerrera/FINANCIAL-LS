import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'ID do projeto é obrigatório' }, { status: 400 })
    }

    const sprints = await prisma.sprint.findMany({
      where: {
        projects: {
          some: {
            projectId: projectId
          }
        }
      },
      include: {
        tasks: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            dueDate: true,
            startDate: true,
            startTime: true,
            estimatedMinutes: true,
            actualMinutes: true,
            storyPoints: true,
            order: true,
            createdAt: true,
            updatedAt: true,
            assignee: {
              select: { id: true, name: true, email: true, avatar: true }
            },
            project: {
              select: { id: true, name: true }
            }
          }
        },
        projects: {
          include: {
            project: {
              select: { 
                id: true, 
                name: true,
                client: {
                  select: { name: true }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(sprints)
  } catch (error) {
    console.error('Erro ao buscar sprints:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, projectIds, startDate, endDate, goal, capacity } = body

    if (!name || !projectIds || !Array.isArray(projectIds) || projectIds.length === 0 || !startDate || !endDate) {
      return NextResponse.json({ 
        error: 'Nome, projetos, data de início e fim são obrigatórios' 
      }, { status: 400 })
    }

    // Criar sprint e relacionamentos com projetos em uma transação
    const sprint = await prisma.$transaction(async (tx) => {
      // Criar a sprint
      const newSprint = await tx.sprint.create({
        data: {
          name,
          description,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          goal,
          capacity
        }
      })

      // Criar relacionamentos com os projetos
      await tx.sprintProject.createMany({
        data: projectIds.map((projectId: string) => ({
          sprintId: newSprint.id,
          projectId
        }))
      })

      return newSprint
    })

    // Buscar sprint completa com relacionamentos
    const fullSprint = await prisma.sprint.findUnique({
      where: { id: sprint.id },
      include: {
        tasks: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            dueDate: true,
            startDate: true,
            startTime: true,
            estimatedMinutes: true,
            actualMinutes: true,
            storyPoints: true,
            order: true,
            createdAt: true,
            updatedAt: true,
            assignee: {
              select: { id: true, name: true, email: true, avatar: true }
            },
            project: {
              select: { id: true, name: true }
            }
          }
        },
        projects: {
          include: {
            project: {
              select: { 
                id: true, 
                name: true,
                client: {
                  select: { name: true }
                }
              }
            }
          }
        }
      }
    })

    return NextResponse.json(sprint, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar sprint:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

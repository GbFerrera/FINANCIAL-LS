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
      where: { projectId },
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
            }
          }
        },
        project: {
          select: { id: true, name: true }
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
    const { name, description, projectId, startDate, endDate, goal, capacity } = body

    if (!name || !projectId || !startDate || !endDate) {
      return NextResponse.json({ 
        error: 'Nome, projeto, data de início e fim são obrigatórios' 
      }, { status: 400 })
    }

    const sprint = await prisma.sprint.create({
      data: {
        name,
        description,
        projectId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        goal,
        capacity
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
            }
          }
        },
        project: {
          select: { id: true, name: true }
        }
      }
    })

    return NextResponse.json(sprint, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar sprint:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

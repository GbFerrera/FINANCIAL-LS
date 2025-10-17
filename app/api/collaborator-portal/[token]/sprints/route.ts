import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: {
    token: string
  }
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Buscar o usuário pelo accessToken
    const user = await prisma.user.findUnique({
      where: { accessToken: params.token },
      select: { 
        id: true, 
        name: true, 
        email: true,
        role: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
    }

    // Buscar sprints onde o usuário tem tarefas atribuídas
    const sprints = await prisma.sprint.findMany({
      where: {
        tasks: {
          some: {
            assigneeId: user.id
          }
        },
        status: {
          in: ['PLANNING', 'ACTIVE']
        }
      },
      include: {
        tasks: {
          where: {
            assigneeId: user.id
          },
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
            project: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { order: 'asc' }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { status: 'asc' }, // ACTIVE primeiro
        { startDate: 'desc' }
      ]
    })

    return NextResponse.json({
      collaborator: {
        id: user.id,
        userId: user.id,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      },
      sprints
    })
  } catch (error) {
    console.error('Erro ao buscar sprints do colaborador:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

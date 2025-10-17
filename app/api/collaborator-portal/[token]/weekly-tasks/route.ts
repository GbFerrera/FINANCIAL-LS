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
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate e endDate são obrigatórios' },
        { status: 400 }
      )
    }

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

    // Buscar tarefas do usuário na semana especificada
    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: user.id,
        OR: [
          // Tarefas com data de início na semana
          {
            startDate: {
              gte: new Date(startDate + 'T00:00:00.000Z'),
              lte: new Date(endDate + 'T23:59:59.999Z')
            }
          },
          // Tarefas com data de vencimento na semana
          {
            dueDate: {
              gte: new Date(startDate + 'T00:00:00.000Z'),
              lte: new Date(endDate + 'T23:59:59.999Z')
            }
          },
          // Tarefas em progresso sem data específica
          {
            status: 'IN_PROGRESS',
            startDate: null,
            dueDate: null
          },
          // Tarefas com sprint ativa
          {
            sprint: {
              status: 'ACTIVE',
              startDate: {
                lte: new Date(endDate + 'T23:59:59.999Z')
              },
              endDate: {
                gte: new Date(startDate + 'T00:00:00.000Z')
              }
            }
          }
        ]
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
        },
        sprint: {
          select: {
            id: true,
            name: true,
            status: true
          }
        }
      },
      orderBy: [
        { startDate: 'asc' },
        { dueDate: 'asc' },
        { priority: 'desc' }
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
      tasks,
      period: {
        startDate,
        endDate
      }
    })
  } catch (error) {
    console.error('Erro ao buscar tarefas semanais:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

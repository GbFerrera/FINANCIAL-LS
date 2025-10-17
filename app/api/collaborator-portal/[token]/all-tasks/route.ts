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

    // Buscar todas as tarefas do usuário
    const tasks = await prisma.task.findMany({
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
        createdAt: true,
        updatedAt: true,
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
        { sprint: { status: 'asc' } }, // Sprints ativas primeiro
        { priority: 'desc' }, // Prioridade alta primeiro
        { dueDate: 'asc' }, // Vencimento mais próximo primeiro
        { createdAt: 'desc' } // Mais recentes primeiro
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
      summary: {
        total: tasks.length,
        todo: tasks.filter(t => t.status === 'TODO').length,
        inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
        completed: tasks.filter(t => t.status === 'COMPLETED').length,
        withSprint: tasks.filter(t => t.sprint).length,
        withoutSprint: tasks.filter(t => !t.sprint).length
      }
    })
  } catch (error) {
    console.error('Erro ao buscar todas as tarefas:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

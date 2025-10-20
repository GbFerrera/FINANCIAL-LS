import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    // Buscar colaborador pelo token
    const collaborator = await prisma.user.findUnique({
      where: { accessToken: token },
      select: {
        id: true,
        name: true,
        email: true,
      }
    })

    if (!collaborator) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 404 }
      )
    }

    console.log('=== DEBUG TASKS ===')
    console.log('Colaborador:', collaborator)

    // Buscar TODAS as tarefas do colaborador
    const allTasks = await prisma.task.findMany({
      where: {
        assigneeId: collaborator.id
      },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log('Total de tarefas encontradas:', allTasks.length)

    // Estatísticas por status
    const statusCount = {
      TODO: allTasks.filter(t => t.status === 'TODO').length,
      IN_PROGRESS: allTasks.filter(t => t.status === 'IN_PROGRESS').length,
      COMPLETED: allTasks.filter(t => t.status === 'COMPLETED').length,
    }

    console.log('Contagem por status:', statusCount)

    return NextResponse.json({
      collaborator,
      totalTasks: allTasks.length,
      statusCount,
      tasks: allTasks.map(task => ({
        id: task.id,
        title: task.title,
        status: task.status,
        dueDate: task.dueDate,
        startDate: task.startDate,
        project: task.project?.name,
        createdAt: task.createdAt
      })),
      message: 'Debug: Todas as tarefas do colaborador'
    })

  } catch (error) {
    console.error('Erro no debug:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

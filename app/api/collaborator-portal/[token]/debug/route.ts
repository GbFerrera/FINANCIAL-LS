import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    console.log('Debug - Token recebido:', token)

    // Buscar colaborador pelo token
    const collaborator = await prisma.user.findUnique({
      where: { accessToken: token },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      }
    })

    console.log('Debug - Colaborador encontrado:', collaborator)

    if (!collaborator) {
      return NextResponse.json({
        error: 'Token inválido',
        token: token
      }, { status: 404 })
    }

    // Buscar TODAS as tarefas do colaborador (sem filtros)
    const allTasks = await prisma.task.findMany({
      where: {
        assigneeId: collaborator.id
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        startDate: true,
        createdAt: true,
        project: {
          select: {
            id: true,
            name: true
          }
        },
        sprint: {
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

    console.log('Debug - Total de tarefas encontradas:', allTasks.length)
    
    // Contar por status
    const statusCount = allTasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log('Debug - Tarefas por status:', statusCount)

    return NextResponse.json({
      collaborator,
      totalTasks: allTasks.length,
      statusCount,
      tasks: allTasks.slice(0, 10), // Mostrar apenas as 10 mais recentes
      message: 'Debug info - todas as tarefas do colaborador'
    })

  } catch (error) {
    console.error('Erro no debug:', error)
    return NextResponse.json({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}

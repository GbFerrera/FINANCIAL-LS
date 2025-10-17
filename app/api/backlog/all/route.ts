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

    // Buscar todas as tarefas que não estão em nenhuma sprint (backlog global)
    const backlogTasks = await prisma.task.findMany({
      where: { 
        sprintId: null
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true }
        },
        project: {
          include: {
            client: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: [
        { priority: 'desc' }, // Prioridade alta primeiro
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json(backlogTasks)
  } catch (error) {
    console.error('Erro ao buscar backlog geral:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

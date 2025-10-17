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

    // Busca todas as tarefas que não estão em nenhuma sprint (backlog)
    const backlogTasks = await prisma.task.findMany({
      where: { 
        projectId,
        sprintId: null
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true }
        },
        project: {
          select: { id: true, name: true }
        }
      },
      orderBy: { order: 'asc' }
    })

    return NextResponse.json(backlogTasks)
  } catch (error) {
    console.error('Erro ao buscar backlog:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

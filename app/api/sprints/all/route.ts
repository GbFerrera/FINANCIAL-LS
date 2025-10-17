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

    const sprints = await prisma.sprint.findMany({
      include: {
        project: {
          include: {
            client: {
              select: { id: true, name: true }
            }
          }
        },
        tasks: {
          select: {
            id: true,
            storyPoints: true,
            status: true
          }
        }
      },
      orderBy: [
        { status: 'asc' }, // Ativas primeiro
        { startDate: 'desc' }
      ]
    })

    return NextResponse.json(sprints)
  } catch (error) {
    console.error('Erro ao buscar todas as sprints:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

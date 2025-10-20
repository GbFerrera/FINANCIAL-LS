import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: {
    id: string
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const sprintId = params.id
    const { status } = await request.json()

    if (!status || !['PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return NextResponse.json({ 
        error: 'Status inválido. Use: PLANNING, ACTIVE, COMPLETED ou CANCELLED' 
      }, { status: 400 })
    }

    // Usar raw SQL para atualizar o status
    await prisma.$executeRaw`
      UPDATE sprints 
      SET status = ${status}::"SprintStatus", "updatedAt" = NOW()
      WHERE id = ${sprintId}
    `

    // Buscar a sprint atualizada
    const updatedSprint = await prisma.$queryRaw`
      SELECT 
        id,
        name,
        description,
        status,
        "startDate",
        "endDate",
        goal,
        capacity,
        "createdAt",
        "updatedAt"
      FROM sprints
      WHERE id = ${sprintId}
    ` as any[]

    if (updatedSprint.length === 0) {
      return NextResponse.json({ error: 'Sprint não encontrada' }, { status: 404 })
    }

    return NextResponse.json(updatedSprint[0])
  } catch (error) {
    console.error('Erro ao atualizar status da sprint:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

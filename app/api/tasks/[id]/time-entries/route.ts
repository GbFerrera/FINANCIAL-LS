import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: {
    id: string
  }
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const timeEntries = await prisma.timeEntry.findMany({
      where: { taskId: params.id },
      orderBy: { startTime: 'desc' }
    })

    return NextResponse.json(timeEntries)
  } catch (error) {
    console.error('Erro ao buscar entradas de tempo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const body = await request.json()
    const { startTime, endTime, duration, description, userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      )
    }

    const timeEntry = await prisma.timeEntry.create({
      data: {
        taskId: params.id,
        userId,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        duration: duration || null,
        description: description || null
      }
    })

    return NextResponse.json(timeEntry, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar entrada de tempo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

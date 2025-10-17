import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: {
    id: string
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const body = await request.json()
    const { entryId } = body

    // Buscar a entrada de tempo ativa
    const timeEntry = await prisma.timeEntry.findUnique({
      where: { id: entryId }
    })

    if (!timeEntry || timeEntry.endTime) {
      return NextResponse.json(
        { error: 'Timer não encontrado ou já finalizado' },
        { status: 400 }
      )
    }

    const endTime = new Date()
    const duration = Math.floor((endTime.getTime() - timeEntry.startTime.getTime()) / 1000)

    // Atualizar a entrada com o tempo final
    const updatedEntry = await prisma.timeEntry.update({
      where: { id: entryId },
      data: {
        endTime,
        duration
      }
    })

    // Atualizar o tempo total da tarefa
    const totalTime = await prisma.timeEntry.aggregate({
      where: { 
        taskId: params.id,
        endTime: { not: null }
      },
      _sum: { duration: true }
    })

    const updatedTask = await prisma.task.update({
      where: { id: params.id },
      data: {
        actualMinutes: Math.floor((totalTime._sum.duration || 0) / 60)
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true }
        },
        project: {
          select: { id: true, name: true }
        }
      }
    })

    return NextResponse.json(updatedEntry)
  } catch (error) {
    console.error('Erro ao pausar timer:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

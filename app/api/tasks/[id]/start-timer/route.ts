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
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se já existe um timer ativo para esta tarefa
    const existingActiveEntry = await prisma.timeEntry.findFirst({
      where: { 
        taskId: params.id,
        userId,
        endTime: null
      }
    })

    if (existingActiveEntry) {
      return NextResponse.json(
        { error: 'Já existe um timer ativo para esta tarefa' },
        { status: 400 }
      )
    }

    // Criar nova entrada de tempo
    const timeEntry = await prisma.timeEntry.create({
      data: {
        taskId: params.id,
        userId,
        startTime: new Date(),
        endTime: null,
        duration: null
      }
    })

    return NextResponse.json(timeEntry, { status: 201 })
  } catch (error) {
    console.error('Erro ao iniciar timer:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

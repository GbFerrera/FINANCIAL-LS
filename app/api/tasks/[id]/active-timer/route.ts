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
    // Buscar entrada de tempo ativa (sem endTime)
    const activeEntry = await prisma.timeEntry.findFirst({
      where: { 
        taskId: params.id,
        endTime: null
      },
      orderBy: { startTime: 'desc' }
    })

    return NextResponse.json({ activeEntry })
  } catch (error) {
    console.error('Erro ao buscar timer ativo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

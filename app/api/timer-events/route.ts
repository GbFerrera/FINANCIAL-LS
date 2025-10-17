import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { addEventToStore, getRecentEvents, type TimerEvent } from '@/lib/event-store'

const clients: Map<string, ReadableStreamDefaultController> = new Map()

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const userRole = searchParams.get('userRole')

  if (!userId) {
    return new NextResponse('userId é obrigatório', { status: 400 })
  }

  // Apenas admins podem receber eventos de timer
  if (userRole !== 'ADMIN') {
    return new NextResponse('Acesso negado', { status: 403 })
  }

  const stream = new ReadableStream({
    start(controller) {
      clients.set(userId, controller)
      
      // Enviar evento de conexão
      controller.enqueue(`data: ${JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString()
      })}\n\n`)

      // Enviar eventos recentes (últimos 10 minutos)
      const tenMinutesAgo = Date.now() - (10 * 60 * 1000)
      const recentEvents = getRecentEvents(tenMinutesAgo)

      recentEvents.forEach((event: TimerEvent) => {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
      })
    },
    cancel() {
      clients.delete(userId)
    }
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const event: TimerEvent = await request.json()
    
    // Validar evento
    if (!event.type || !event.userId || !event.taskId) {
      return NextResponse.json({ error: 'Dados do evento inválidos' }, { status: 400 })
    }

    // Armazenar evento usando função compartilhada
    addEventToStore(event)

    // Enviar para todos os supervisores conectados
    const eventData = `data: ${JSON.stringify(event)}\n\n`
    
    clients.forEach((controller, clientId) => {
      try {
        controller.enqueue(eventData)
      } catch (error) {
        // Cliente desconectado, remover da lista
        clients.delete(clientId)
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao processar evento de timer:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Tipos de eventos disponíveis para webhooks
type WebhookEvent = 
  | 'project.created'
  | 'project.updated'
  | 'project.completed'
  | 'task.created'
  | 'task.updated'
  | 'task.completed'
  | 'client.created'
  | 'client.message'
  | 'milestone.reached'
  | 'payment.received'
  | 'user.assigned'

interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: any
  signature?: string
}

// Webhooks serão buscados do banco de dados

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    // TODO: Implementar modelo Webhook no Prisma
    // const webhooks = await prisma.webhook.findMany({
    //   orderBy: { createdAt: 'desc' }
    // })

    return NextResponse.json({
      webhooks: [],
      availableEvents: [
        'project.created',
        'project.updated', 
        'project.completed',
        'task.created',
        'task.updated',
        'task.completed',
        'client.created',
        'client.message',
        'milestone.reached',
        'payment.received',
        'user.assigned'
      ]
    })
  } catch (error) {
    console.error('Erro ao buscar webhooks:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { url, events, secret } = body

    if (!url || !events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: 'URL e eventos são obrigatórios' },
        { status: 400 }
      )
    }

    // Validar URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'URL inválida' },
        { status: 400 }
      )
    }

    // Validar eventos
    const validEvents: WebhookEvent[] = [
      'project.created', 'project.updated', 'project.completed',
      'task.created', 'task.updated', 'task.completed',
      'client.created', 'client.message', 'milestone.reached',
      'payment.received', 'user.assigned'
    ]

    const invalidEvents = events.filter((event: string) => !validEvents.includes(event as WebhookEvent))
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { error: `Eventos inválidos: ${invalidEvents.join(', ')}` },
        { status: 400 }
      )
    }

    // TODO: Implementar modelo Webhook no Prisma
    // const newWebhook = await prisma.webhook.create({
    //   data: {
    //     url,
    //     events,
    //     secret: secret || `webhook_secret_${Date.now()}`,
    //     active: true,
    //     createdBy: session.user.id
    //   }
    // })

    const newWebhook = {
      id: `webhook_${Date.now()}`,
      url,
      events,
      active: true,
      createdAt: new Date().toISOString()
    }

    return NextResponse.json({
      webhook: newWebhook,
      message: 'Webhook criado com sucesso (temporário - implementar modelo Prisma)'
    })
  } catch (error) {
    console.error('Erro ao criar webhook:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// Função utilitária para disparar webhooks (seria chamada em outros lugares do sistema)
export async function triggerWebhook(event: WebhookEvent, data: any) {
  try {
    // TODO: Implementar modelo Webhook no Prisma
    // const relevantWebhooks = await prisma.webhook.findMany({
    //   where: {
    //     active: true,
    //     events: {
    //       has: event
    //     }
    //   }
    // })
    
    const relevantWebhooks: any[] = []

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data
    }

    // Disparar webhooks em paralelo
    const promises = relevantWebhooks.map(async (webhook) => {
      try {
        // Gerar assinatura HMAC (simulado)
        const signature = `sha256=${Buffer.from(
          JSON.stringify(payload) + webhook.secret
        ).toString('base64')}`

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event,
            'User-Agent': 'FinancialLS-Webhook/1.0'
          },
          body: JSON.stringify(payload)
        })

        if (!response.ok) {
          console.error(`Webhook ${webhook.id} failed:`, response.status, response.statusText)
        }

        return {
          webhookId: webhook.id,
          success: response.ok,
          status: response.status
        }
      } catch (error) {
        console.error(`Webhook ${webhook.id} error:`, error)
        return {
          webhookId: webhook.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    const results = await Promise.all(promises)
    console.log(`Triggered ${results.length} webhooks for event ${event}:`, results)
    
    return results
  } catch (error) {
    console.error('Error triggering webhooks:', error)
    return []
  }
}
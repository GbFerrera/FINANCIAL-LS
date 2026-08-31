import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { findSubscriptionPaymentFix } from '@/lib/subscription-reconcile'
import type { BillingCycle } from '@/lib/subscription-billing'
import { UserRole } from '@prisma/client'
import { z } from 'zod'

const bodySchema = z.object({
  apply: z.boolean().optional(),
  clientSubscriptionId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const json = await req.json().catch(() => ({}))
    const body = bodySchema.parse(json)
    const apply = body.apply === true

    const db = prisma as any
    const links = await db.clientSubscription.findMany({
      where: {
        status: 'ACTIVE',
        ...(body.clientSubscriptionId ? { id: body.clientSubscriptionId } : {}),
      },
      include: {
        client: { select: { name: true } },
        subscription: { select: { name: true, billingCycle: true, isActive: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const fixes: Array<ReturnType<typeof findSubscriptionPaymentFix> & object> = []
    let updated = 0

    for (const link of links) {
      if (!link.subscription?.isActive) continue

      const fix = findSubscriptionPaymentFix({
        id: link.id,
        dueDay: link.dueDay,
        startedAt: link.startedAt,
        lastPaidFor: link.lastPaidFor,
        paidAt: link.paidAt,
        billingCycle: link.subscription.billingCycle as BillingCycle,
        clientName: link.client?.name || 'Cliente',
        subscriptionName: link.subscription?.name || 'Assinatura',
      })

      if (!fix) continue
      fixes.push(fix)

      if (apply) {
        await db.clientSubscription.update({
          where: { id: link.id },
          data: {
            lastPaidFor: fix.toLastPaidFor,
            ...(fix.toLastPaidFor === null ? { paidAt: null } : {}),
          },
        })
        updated += 1
      }
    }

    return NextResponse.json({
      apply,
      analyzed: links.length,
      fixable: fixes.length,
      updated,
      fixes,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados inválidos', details: error.issues }, { status: 400 })
    }
    console.error('Erro ao reconciliar assinaturas:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

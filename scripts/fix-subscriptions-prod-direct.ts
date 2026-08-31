/**
 * Corrige lastPaidFor em produção:
 * 1) Busca assinaturas via API PM (produção)
 * 2) Aplica correções no banco via PROD_DATABASE_URL ou DATABASE_URL
 *
 *   PROD_DATABASE_URL="postgresql://..." PM_EMAIL=... PM_PASSWORD=... \
 *     npx tsx scripts/fix-subscriptions-prod-direct.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import type { BillingCycle } from '../lib/subscription-billing'
import { dateKey } from '../lib/subscription-billing'
import { findSubscriptionPaymentFix } from '../lib/subscription-reconcile'
import { pmSession } from './lib/pm-api-client'

const apply = process.argv.includes('--apply')

type ApiSubscription = {
  id: string
  billingCycle: BillingCycle
  name: string
  clients: Array<{
    id: string
    dueDay: number
    startedAt: string
    lastPaidFor?: string | null
    paidAt?: string | null
    client?: { name?: string }
  }>
}

async function main() {
  const dbUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL
  if (!dbUrl) {
    throw new Error('Defina PROD_DATABASE_URL (ou DATABASE_URL) apontando para o Postgres de produção')
  }

  const { base, cookies } = await pmSession()
  const res = await fetch(`${base}/api/subscriptions`, {
    headers: { Cookie: cookies },
  })
  if (!res.ok) throw new Error(`GET /api/subscriptions falhou (${res.status})`)

  const data = (await res.json()) as { subscriptions: ApiSubscription[] }
  const fixes = []

  for (const sub of data.subscriptions || []) {
    const link = sub.clients?.[0]
    if (!link) continue

    const fix = findSubscriptionPaymentFix({
      id: link.id,
      dueDay: link.dueDay,
      startedAt: new Date(link.startedAt),
      lastPaidFor: link.lastPaidFor ? new Date(link.lastPaidFor) : null,
      paidAt: link.paidAt ? new Date(link.paidAt) : null,
      billingCycle: sub.billingCycle,
      clientName: link.client?.name || 'Cliente',
      subscriptionName: sub.name,
    })
    if (fix) fixes.push(fix)
  }

  console.log(apply ? '🔧 APPLY\n' : '👀 Dry-run\n')
  console.log(`Casos encontrados: ${fixes.length}\n`)

  for (const fix of fixes) {
    console.log(`${fix.clientName} • ${fix.subscriptionName}`)
    console.log(`  id: ${fix.clientSubscriptionId}`)
    console.log(`  ${fix.reason}: ${fix.fromLastPaidFor ? dateKey(fix.fromLastPaidFor) : '—'} → ${fix.toLastPaidFor ? dateKey(fix.toLastPaidFor) : 'null'}`)
  }

  if (!fixes.length) return
  if (!apply) {
    console.log('\nPara aplicar: adicione --apply')
    return
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  })

  try {
    let updated = 0
    for (const fix of fixes) {
      await prisma.clientSubscription.update({
        where: { id: fix.clientSubscriptionId },
        data: {
          lastPaidFor: fix.toLastPaidFor,
          ...(fix.toLastPaidFor === null ? { paidAt: null } : {}),
        },
      })
      updated += 1
    }
    console.log(`\n✅ ${updated} registro(s) atualizado(s) no banco de produção`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})

/**
 * Audita e corrige lastPaidFor de assinaturas afetadas pelo bug de "pular mês".
 *
 * Uso:
 *   npx tsx scripts/reconcile-subscription-billing.ts           # dry-run (padrão)
 *   npx tsx scripts/reconcile-subscription-billing.ts --apply     # aplica correções
 *   npx tsx scripts/reconcile-subscription-billing.ts --apply --id=<clientSubscriptionId>
 *
 * Requer DATABASE_URL no ambiente (prod: rode no host/Coolify com .env de produção).
 */
import { PrismaClient } from '@prisma/client'
import { dateKey } from '../lib/subscription-billing'
import { findSubscriptionPaymentFix } from '../lib/subscription-reconcile'
import type { BillingCycle } from '../lib/subscription-billing'

const prisma = new PrismaClient()

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const idArg = args.find((a) => a.startsWith('--id='))
const onlyId = idArg ? idArg.split('=')[1] : null

async function main() {
  console.log(apply ? '🔧 Modo APPLY — alterações serão gravadas\n' : '👀 Modo dry-run — nenhuma alteração\n')

  const links = await prisma.clientSubscription.findMany({
    where: {
      status: 'ACTIVE',
      ...(onlyId ? { id: onlyId } : {}),
    },
    include: {
      client: { select: { name: true } },
      subscription: { select: { name: true, billingCycle: true, isActive: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  let fixable = 0
  let fixed = 0

  for (const link of links) {
    if (!link.subscription.isActive) continue

    const fix = findSubscriptionPaymentFix({
      id: link.id,
      dueDay: link.dueDay,
      startedAt: link.startedAt,
      lastPaidFor: link.lastPaidFor,
      paidAt: link.paidAt,
      billingCycle: link.subscription.billingCycle as BillingCycle,
      clientName: link.client.name,
      subscriptionName: link.subscription.name,
    })

    if (!fix) continue

    fixable += 1
    console.log('—'.repeat(60))
    console.log(`${fix.clientName} • ${fix.subscriptionName} (${link.id.slice(0, 8)}…)`)
    console.log(`  dueDay: ${link.dueDay}  billing: ${link.subscription.billingCycle}`)
    console.log(
      `  lastPaidFor: ${link.lastPaidFor ? dateKey(new Date(link.lastPaidFor)) : '—'}  paidAt: ${
        link.paidAt ? dateKey(new Date(link.paidAt)) : '—'
      }`
    )
    console.log(`  ⚠ ${fix.reason}`)
    console.log(
      `  → corrigir para: ${fix.toLastPaidFor === null ? 'null (reset)' : dateKey(fix.toLastPaidFor)}`
    )

    if (apply) {
      await prisma.clientSubscription.update({
        where: { id: link.id },
        data: {
          lastPaidFor: fix.toLastPaidFor,
          ...(fix.toLastPaidFor === null ? { paidAt: null } : {}),
        },
      })
      fixed += 1
      console.log('  ✅ Atualizado no banco')
    } else {
      console.log('  💡 Rodar com --apply para gravar')
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`Assinaturas ativas analisadas: ${links.length}`)
  console.log(`Com correção disponível: ${fixable}`)
  if (apply) console.log(`Registros atualizados: ${fixed}`)
  else if (fixable > 0) console.log('\nPara aplicar: npx tsx scripts/reconcile-subscription-billing.ts --apply')

  if (fixable === 0) {
    console.log('\nNenhum caso para corrigir.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

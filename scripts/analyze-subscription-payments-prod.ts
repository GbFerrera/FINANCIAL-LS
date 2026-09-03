/**
 * Analisa assinaturas em produção e propõe lastPaidFor correto com base em
 * entradas financeiras e histórico conhecido antes do reset agressivo.
 */
import 'dotenv/config'
import { config } from 'dotenv'
import { pmSession } from './lib/pm-api-client'
import {
  dateKey,
  dueDateForMonth,
  isCyclePaid,
  listMonthlyDuesInRange,
  normalizeToDueDay,
  unpaidDueDateForClientSubscription,
  yearMonthKey,
} from '../lib/subscription-billing'

config({ path: '.env.local', override: true })

type ApiSubscription = {
  id: string
  name: string
  billingCycle: 'MONTHLY' | 'YEARLY'
  clients: Array<{
    id: string
    dueDay: number
    startedAt: string
    lastPaidFor: string | null
    paidAt: string | null
    client?: { name?: string }
  }>
}

type FinancialEntry = {
  id: string
  type: string
  description: string
  amount: number
  date: string
  clientSubscriptionId: string | null
}

/** Valores antes do reset de 2026-08-31 (apply via reconcile). */
const BEFORE_RESET: Record<
  string,
  { lastPaidFor: string; paidAt: string | null; reason: string }
> = {
  cmth6plj200z0nv2cl879cqgm: {
    lastPaidFor: '2027-01-01T15:00:00.000Z',
    paidAt: '2026-08-31T00:00:00.000Z',
    reason: 'SKIPPED_MONTHS_AHEAD',
  },
  cmr22ydow000hr12byeocltod: {
    lastPaidFor: '2026-08-07T12:00:00.000Z',
    paidAt: null,
    reason: 'OPEN_GAP_BEFORE_LAST_PAID',
  },
  cmr23ajyw000nr12ba8wrn09y: {
    lastPaidFor: '2026-08-15T15:00:00.000Z',
    paidAt: null,
    reason: 'OPEN_GAP_BEFORE_LAST_PAID',
  },
  cmr23q6ya0004qk291seulev5: {
    lastPaidFor: '2026-08-12T15:00:00.000Z',
    paidAt: null,
    reason: 'OPEN_GAP_BEFORE_LAST_PAID',
  },
  cmrararhq001llm28t31eoo64: {
    lastPaidFor: '2026-08-10T12:00:00.000Z',
    paidAt: null,
    reason: 'OPEN_GAP_BEFORE_LAST_PAID',
  },
  cmr23ea25000tr12b70vvecm1: {
    lastPaidFor: '2026-08-05T12:00:00.000Z',
    paidAt: null,
    reason: 'OPEN_GAP_BEFORE_LAST_PAID',
  },
  cmr23npgh0001qk29lz9zmeme: {
    lastPaidFor: '2026-08-01T15:00:00.000Z',
    paidAt: null,
    reason: 'OPEN_GAP_BEFORE_LAST_PAID',
  },
  cmr23cfqu000qr12bex9xb61q: {
    lastPaidFor: '2026-08-05T15:00:00.000Z',
    paidAt: null,
    reason: 'OPEN_GAP_BEFORE_LAST_PAID',
  },
  cmr23fw7w000wr12b10w7v3ci: {
    lastPaidFor: '2026-08-01T12:00:00.000Z',
    paidAt: null,
    reason: 'OPEN_GAP_BEFORE_LAST_PAID',
  },
  cmr23vdrl0007qk2909krde0p: {
    lastPaidFor: '2026-08-01T12:00:00.000Z',
    paidAt: null,
    reason: 'OPEN_GAP_BEFORE_LAST_PAID',
  },
}

function inferLastPaidFromEntries(
  linkId: string,
  dueDay: number,
  startedAt: Date,
  entries: FinancialEntry[]
) {
  const related = entries
    .filter((e) => e.clientSubscriptionId === linkId && e.type === 'INCOME')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  if (!related.length) return null

  const dues = listMonthlyDuesInRange({
    startedAt,
    dueDay,
    from: startedAt,
    to: new Date(),
  })

  const paidMonths = new Set<string>()
  for (const entry of related) {
    const entryDate = new Date(entry.date)
    // Pagamento registrado no mês M costuma ser pelo vencimento desse mês ou anterior
    for (const due of dues) {
      const dueYm = yearMonthKey(due)
      const entryYm = yearMonthKey(entryDate)
      const prevDue = dueDateForMonth(due.getFullYear(), due.getMonth() - 1, dueDay)
      const prevYm = yearMonthKey(prevDue)
      if (entryYm === dueYm || entryYm === prevYm) {
        paidMonths.add(dueYm)
      }
    }
    // Fallback: mapeia data da entrada ao vencimento mais próximo (até 45 dias)
    let best: Date | null = null
    let bestDiff = Infinity
    for (const due of dues) {
      const diff = Math.abs(entryDate.getTime() - due.getTime())
      if (diff < bestDiff && diff <= 45 * 86400000) {
        bestDiff = diff
        best = due
      }
    }
    if (best) paidMonths.add(yearMonthKey(best))
  }

  if (!paidMonths.size) return null

  const sorted = [...paidMonths].sort()
  const lastYm = sorted[sorted.length - 1]
  const [y, m] = lastYm.split('-').map(Number)
  return dueDateForMonth(y, m - 1, dueDay)
}

function correctLastPaidFor(input: {
  linkId: string
  dueDay: number
  startedAt: Date
  before: (typeof BEFORE_RESET)[string] | undefined
  entries: FinancialEntry[]
}) {
  const { linkId, dueDay, startedAt, before, entries } = input

  if (before?.reason === 'OPEN_GAP_BEFORE_LAST_PAID') {
    // Reset foi errado: lastPaidFor anterior era o mês efetivamente pago
    return {
      lastPaidFor: new Date(before.lastPaidFor),
      paidAt: before.paidAt ? new Date(before.paidAt) : new Date(before.lastPaidFor),
      source: 'restore_open_gap',
    }
  }

  if (before?.reason === 'SKIPPED_MONTHS_AHEAD') {
    const fromEntries = inferLastPaidFromEntries(linkId, dueDay, startedAt, entries)
    if (fromEntries) {
      return { lastPaidFor: fromEntries, paidAt: new Date(before.paidAt || before.lastPaidFor), source: 'entries' }
    }
    // paidAt 2026-08-31 → pagou ciclo ago/2026
    if (before.paidAt) {
      const paidAt = new Date(before.paidAt)
      const due = dueDateForMonth(paidAt.getFullYear(), paidAt.getMonth(), dueDay)
      return { lastPaidFor: due, paidAt, source: 'paidAt_month' }
    }
  }

  const fromEntries = inferLastPaidFromEntries(linkId, dueDay, startedAt, entries)
  if (fromEntries) {
    return { lastPaidFor: fromEntries, paidAt: new Date(), source: 'entries_only' }
  }

  return null
}

async function main() {
  const { base, cookies } = await pmSession()

  const subsRes = await fetch(`${base}/api/subscriptions`, { headers: { Cookie: cookies } })
  const subsData = (await subsRes.json()) as { subscriptions: ApiSubscription[] }

  const finRes = await fetch(`${base}/api/financial?type=INCOME&limit=500&days=all`, {
    headers: { Cookie: cookies },
  })
  const finData = (await finRes.json()) as { entries?: FinancialEntry[]; data?: FinancialEntry[] }
  const entries = finData.entries ?? finData.data ?? []

  console.log(`Assinaturas: ${subsData.subscriptions?.length ?? 0}`)
  console.log(`Entradas financeiras (INCOME): ${entries.length}\n`)

  const proposals: Array<{
    id: string
    label: string
    current: string
    proposed: string
    nextUnpaid: string
    entries: number
    source: string
  }> = []

  for (const sub of subsData.subscriptions || []) {
    const link = sub.clients?.[0]
    if (!link || sub.billingCycle !== 'MONTHLY') continue

    const before = BEFORE_RESET[link.id]
    const relatedEntries = entries.filter((e) => e.clientSubscriptionId === link.id)

    const correction = correctLastPaidFor({
      linkId: link.id,
      dueDay: link.dueDay,
      startedAt: new Date(link.startedAt),
      before,
      entries,
    })

    const currentLast = link.lastPaidFor
    const needsFix =
      correction &&
      (!currentLast ||
        yearMonthKey(new Date(currentLast)) !== yearMonthKey(correction.lastPaidFor))

    if (!needsFix && !before) continue

    const nextUnpaid = correction
      ? unpaidDueDateForClientSubscription({
          dueDay: link.dueDay,
          billingCycle: sub.billingCycle,
          startedAt: new Date(link.startedAt),
          lastPaidFor: correction.lastPaidFor,
        })
      : unpaidDueDateForClientSubscription({
          dueDay: link.dueDay,
          billingCycle: sub.billingCycle,
          startedAt: new Date(link.startedAt),
          lastPaidFor: link.lastPaidFor ? new Date(link.lastPaidFor) : null,
        })

    const label = `${link.client?.name} • ${sub.name}`

    console.log(`\n${label}`)
    console.log(`  id: ${link.id}`)
    console.log(`  atual lastPaidFor: ${currentLast ?? 'null'}`)
    if (before) console.log(`  antes reset: ${before.lastPaidFor} (${before.reason})`)
    console.log(`  entradas financeiras: ${relatedEntries.length}`)
    for (const e of relatedEntries.slice(-5)) {
      console.log(`    - ${dateKey(new Date(e.date))} R$${e.amount} ${e.description}`)
    }
    if (correction) {
      console.log(`  → proposto lastPaidFor: ${dateKey(correction.lastPaidFor)} (${correction.source})`)
      console.log(`  → próx. em aberto: ${nextUnpaid ? dateKey(nextUnpaid) : '—'}`)
    } else {
      console.log(`  → sem correção proposta`)
    }

    if (needsFix && correction) {
      proposals.push({
        id: link.id,
        label,
        current: currentLast ?? 'null',
        proposed: dateKey(correction.lastPaidFor),
        nextUnpaid: nextUnpaid ? dateKey(nextUnpaid) : '—',
        entries: relatedEntries.length,
        source: correction.source,
      })
    }
  }

  console.log('\n\n=== RESUMO — aplicar ===')
  console.log(JSON.stringify(proposals, null, 2))
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})

/**
 * Restaura lastPaidFor em produção com base nas entradas financeiras vinculadas.
 *
 *   PM_EMAIL=... PM_PASSWORD=... npx tsx scripts/restore-subscription-payments-prod.ts
 *   PM_EMAIL=... PM_PASSWORD=... npx tsx scripts/restore-subscription-payments-prod.ts --apply
 */
import 'dotenv/config'
import { config } from 'dotenv'
import { pmSession } from './lib/pm-api-client'
import {
  dateKey,
  dueDateForMonth,
  isFirstDueApplicable,
  listMonthlyDuesInRange,
  unpaidDueDateForClientSubscription,
  yearMonthKey,
} from '../lib/subscription-billing'

config({ path: '.env.local', override: true })

const apply = process.argv.includes('--apply')

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
  date: string
  clientSubscriptionId: string | null
}

/** Entrada financeira → ciclo pago (vencimento no mês da entrada). */
export function mapEntryToPaidForCycle(entryDate: Date, dueDay: number) {
  return dueDateForMonth(entryDate.getFullYear(), entryDate.getMonth(), dueDay)
}

export function inferLastPaidFromEntries(input: {
  linkId: string
  dueDay: number
  startedAt: Date
  entries: FinancialEntry[]
}) {
  const related = input.entries
    .filter((e) => e.clientSubscriptionId === input.linkId && e.type === 'INCOME')
    .map((e) => new Date(e.date))

  const cycles: Date[] = []
  for (const entryDate of related) {
    const cycle = mapEntryToPaidForCycle(entryDate, input.dueDay)
    if (!isFirstDueApplicable(input.startedAt, cycle)) continue
    cycles.push(cycle)
  }

  if (!cycles.length) return null
  cycles.sort((a, b) => b.getTime() - a.getTime())
  return cycles[0]
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

  const updates: Array<{
    id: string
    label: string
    from: string
    to: string
    nextUnpaid: string
    paidAt: string
  }> = []

  for (const sub of subsData.subscriptions || []) {
    const link = sub.clients?.[0]
    if (!link || sub.billingCycle !== 'MONTHLY') continue

    const startedAt = new Date(link.startedAt)
    const inferred = inferLastPaidFromEntries({
      linkId: link.id,
      dueDay: link.dueDay,
      startedAt,
      entries,
    })

    if (!inferred) continue

    const current = link.lastPaidFor ? normalizeYm(link.lastPaidFor, link.dueDay) : null
    const target = yearMonthKey(inferred)

    if (current === target) continue

    const nextUnpaid = unpaidDueDateForClientSubscription({
      dueDay: link.dueDay,
      billingCycle: sub.billingCycle,
      startedAt,
      lastPaidFor: inferred,
    })

    const related = entries.filter((e) => e.clientSubscriptionId === link.id)
    const latestEntry = related.reduce<Date | null>((max, e) => {
      const d = new Date(e.date)
      return !max || d > max ? d : max
    }, null)

    updates.push({
      id: link.id,
      label: `${link.client?.name} • ${sub.name}`,
      from: link.lastPaidFor ? dateKey(new Date(link.lastPaidFor)) : 'null',
      to: dateKey(inferred),
      nextUnpaid: nextUnpaid ? dateKey(nextUnpaid) : '—',
      paidAt: (latestEntry ?? inferred).toISOString(),
    })
  }

  console.log(apply ? '🔧 APPLY\n' : '👀 Dry-run\n')
  console.log(`Correções propostas: ${updates.length}\n`)

  for (const u of updates) {
    console.log(`${u.label}`)
    console.log(`  id: ${u.id}`)
    console.log(`  lastPaidFor: ${u.from} → ${u.to}`)
    console.log(`  próx. em aberto: ${u.nextUnpaid}`)
  }

  if (!updates.length) {
    console.log('\nNada a corrigir.')
    return
  }

  if (!apply) {
    console.log('\nPara aplicar: adicione --apply')
    return
  }

  let ok = 0
  for (const u of updates) {
    const res = await fetch(`${base}/api/subscriptions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookies },
      body: JSON.stringify({
        clientSubscriptionId: u.id,
        paidForDate: new Date(u.to + 'T12:00:00.000Z').toISOString(),
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error(`\n❌ ${u.label}: ${res.status} ${err}`)
      continue
    }
    ok += 1
    console.log(`\n✅ ${u.label} → ${u.to}`)
  }

  console.log(`\n✅ ${ok}/${updates.length} assinatura(s) restaurada(s)`)
}

function normalizeYm(raw: string, dueDay: number) {
  const d = new Date(raw)
  return yearMonthKey(dueDateForMonth(d.getFullYear(), d.getMonth(), dueDay))
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})

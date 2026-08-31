/**
 * Corrige lastPaidFor errado em produção via API (requer endpoint /api/subscriptions/reconcile deployado).
 *
 *   PM_EMAIL=... PM_PASSWORD=... npx tsx scripts/fix-subscriptions-prod-via-api.ts
 *   PM_EMAIL=... PM_PASSWORD=... npx tsx scripts/fix-subscriptions-prod-via-api.ts --apply
 */
import { pmSession } from './lib/pm-api-client'

const apply = process.argv.includes('--apply')

async function main() {
  const { base, cookies } = await pmSession()

  const dryRes = await fetch(`${base}/api/subscriptions/reconcile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ apply: false }),
  })

  if (dryRes.status === 404) {
    throw new Error(
      'Endpoint /api/subscriptions/reconcile não encontrado em produção. Faça deploy do código atual e rode de novo.'
    )
  }

  if (!dryRes.ok) {
    const err = await dryRes.text()
    throw new Error(`Dry-run falhou (${dryRes.status}): ${err}`)
  }

  const dry = await dryRes.json()
  console.log(JSON.stringify(dry, null, 2))

  if (!apply) {
    console.log('\n👀 Dry-run. Para aplicar: adicione --apply')
    return
  }

  if (!dry.fixable) {
    console.log('\nNada para corrigir.')
    return
  }

  const applyRes = await fetch(`${base}/api/subscriptions/reconcile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ apply: true }),
  })

  if (!applyRes.ok) {
    const err = await applyRes.text()
    throw new Error(`Apply falhou (${applyRes.status}): ${err}`)
  }

  const result = await applyRes.json()
  console.log('\n✅ Produção atualizada:')
  console.log(JSON.stringify(result, null, 2))
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})

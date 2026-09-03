/**
 * Reordena checklist da task Link Board no PM.
 */
import { pmApi, pmSession } from './lib/pm-api-client'

const TASK_ID = 'cmsryiir000egnv2cq54vzw87'

/** Ordem desejada (match parcial no titulo) */
const DESIRED_ORDER = [
  '1. Setup',
  '2. Entender',
  '3. Features',
  '4. shadcn',
  '5. PostgreSQL',
  '6. Debug',
  '7. Docker',
  '8. Entrega',
]

function sortKey(title: string): number {
  const index = DESIRED_ORDER.findIndex((prefix) => title.toLowerCase().includes(prefix.split('. ')[1]?.toLowerCase() ?? prefix.toLowerCase()))
  return index === -1 ? 999 : index
}

async function main() {
  const { base, cookies } = await pmSession()

  const res = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/checklist`)
  const { groups } = (await res.json()) as { groups: Array<{ id: string; title: string; order: number }> }

  console.log('Ordem atual:')
  groups.sort((a, b) => a.order - b.order).forEach((g, i) => console.log(`  ${i + 1}. ${g.title}`))

  const sorted = [...groups].sort((a, b) => sortKey(a.title) - sortKey(b.title) || a.order - b.order)

  // Renumerar titulos 1..N
  const labels = ['Setup', 'Entender o codigo', 'Features', 'shadcn', 'PostgreSQL + Prisma', 'Debug', 'Docker', 'Entrega']
  const renames: Array<{ id: string; title: string }> = []

  sorted.forEach((group, index) => {
    const label = labels[index]
    if (!label) return
    const newTitle = `${index + 1}. ${label}${group.title.includes('dev') && label.includes('PostgreSQL') ? ' (melhoria — dev)' : label === 'Features' ? ' (escolher 3+)' : label === 'shadcn' ? ' (praticar UI)' : ''}`
    if (group.title !== newTitle) {
      renames.push({ id: group.id, title: newTitle })
    }
  })

  for (const { id, title } of renames) {
    await pmApi(base, cookies, `/api/tasks/${TASK_ID}/checklist`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'update_group', groupId: id, title }),
    })
    console.log(`Renomeado: ${title}`)
  }

  const reorderRes = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/checklist`, {
    method: 'PATCH',
    body: JSON.stringify({
      action: 'reorder',
      groupsOrder: sorted.map((g) => g.id),
    }),
  })
  if (!reorderRes.ok) throw new Error(`reorder: ${await reorderRes.text()}`)

  console.log('\nNova ordem:')
  sorted.forEach((g, i) => {
    const renamed = renames.find((r) => r.id === g.id)
    console.log(`  ${i + 1}. ${renamed?.title ?? g.title}`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

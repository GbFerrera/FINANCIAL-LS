/**
 * Atualiza estimativa da task Grupo de Empresas → 3 dias (24 h).
 */
import { config } from 'dotenv'
import { pmApi, pmSession } from './lib/pm-api-client'

config({ path: '.env.local' })
config()

const PROJECT_ID = 'cmltidb5000awp81xkssz2a26'
const TASK_ID = 'cmsrl99lu006inv2ctdhil9t5'
const SHARE_TOKEN = '3164f74c-4f08-48e8-b712-8a85c0d4f062'
const ESTIMATED_MINUTES = 3 * 8 * 60 // 24 h · 3 dias

const GROUP_TITLES: Record<string, string> = {
  '1. Modelo de dados': '1. Modelo de dados',
  '2. Cadastros B2B': '2. Cadastros B2B',
  '3. Motores por tipo de contrato': '3. Motores por tipo de contrato',
  '4. Pedidos e integração': '4. Pedidos e integração',
  '5. Front — config e operação': '5. Front — config e operação',
  '6. Cardápio e garçom': '6. Cardápio e garçom',
  '7. Homologação e deploy': '7. Homologação e deploy',
}

function stripHours(title: string): string {
  return title.replace(/\s*\(\d+\s*h\)/gi, '').trim()
}

async function patchChecklist(
  base: string,
  cookies: string,
  taskId: string,
  body: Record<string, unknown>
) {
  const res = await pmApi(base, cookies, `/api/tasks/${taskId}/checklist`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`checklist PATCH: ${res.status} ${await res.text()}`)
}

async function main() {
  const { base, cookies } = await pmSession()

  const taskPatch = await pmApi(base, cookies, `/api/tasks/${TASK_ID}`, {
    method: 'PATCH',
    body: JSON.stringify({ estimatedMinutes: ESTIMATED_MINUTES, priority: 'HIGH' }),
  })
  if (!taskPatch.ok) throw new Error(`task PATCH: ${taskPatch.status} ${await taskPatch.text()}`)
  console.log(`+ Estimativa PM: 3 dias (${ESTIMATED_MINUTES} min)`)

  await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}`, {
    method: 'PUT',
    body: JSON.stringify({
      priority: 'HIGH',
      description: `**Grupo de Empresas** — contratos B2B (5 tipos) + cartões corporativos + faturamento.

Empresas contratantes, funcionários, créditos/marmitas/consumo via **TabCard** estendido. Extras (bebida) pagos à parte.

**Estimativa:** 3 dias (24 h) · spec no vault.

**Monorepo:** \`/Users/gabrielferreira/Desktop/linkeats\`

Portal: ${base}/task-portal/${SHARE_TOKEN}`,
    }),
  })

  const portalRes = await fetch(`${base}/api/task-portal/${SHARE_TOKEN}`)
  const portal = (await portalRes.json()) as {
    checklist?: {
      groups?: Array<{
        id: string
        title: string
        items?: Array<{ id: string; title: string; description?: string | null }>
      }>
    }
  }

  for (const group of portal.checklist?.groups ?? []) {
    const newTitle = GROUP_TITLES[stripHours(group.title)] ?? stripHours(group.title)
    if (newTitle !== group.title) {
      await patchChecklist(base, cookies, TASK_ID, {
        action: 'update_group',
        groupId: group.id,
        title: newTitle,
      })
      console.log(`+ Grupo: ${newTitle}`)
    }

    for (const item of group.items ?? []) {
      const newItemTitle = stripHours(item.title)
      const needsTitle = newItemTitle !== item.title
      const needsDesc = item.description?.match(/\d+\s*h/)
      if (needsTitle || needsDesc) {
        await patchChecklist(base, cookies, TASK_ID, {
          action: 'update_item',
          itemId: item.id,
          title: newItemTitle,
          description: needsDesc ? null : item.description,
        })
      }
    }
  }
  console.log('+ Checklist — horas por item removidas')

  const note = `## Estimativa revisada

Prazo alvo: **3 dias** (24 h) — escopo MVP com spec já documentada no vault.`
  const commentsRes = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/comments`)
  const comments = commentsRes.ok ? ((await commentsRes.json()) as Array<{ content: string }>) : []
  if (!comments.some((c) => c.content.includes('Estimativa revisada'))) {
    await pmApi(base, cookies, `/api/tasks/${TASK_ID}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: note }),
    })
    console.log('+ Comentário estimativa revisada')
  }

  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

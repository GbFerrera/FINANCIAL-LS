/**
 * Atualiza fase PostgreSQL na task Link Board — entrega do dev (nao implementado no repo).
 */
import { pmApi, pmSession } from './lib/pm-api-client'

const TASK_ID = 'cmsryiir000egnv2cq54vzw87'
const GROUP_TITLE = '5. PostgreSQL + Prisma (melhoria — dev)'

const ITEMS = [
  {
    title: 'Adicionar Postgres no docker-compose.yml',
    description: 'Servico db com volume persistente',
  },
  {
    title: 'Configurar Prisma — schema Order + OrderItem',
    description: 'Mesmo padrao Link Eats (linkeats/back/prisma)',
  },
  {
    title: 'Substituir store em memoria por Prisma',
    description: 'Hoje: Map em api/src/store.js — migrar CRUD para banco',
  },
  {
    title: 'DATABASE_URL em api/.env + prisma db push',
  },
  {
    title: 'Health check com status do banco — GET /health',
  },
  {
    title: 'Validar — criar pedido, reiniciar API, pedido continua no banco',
  },
]

const COMMENT = `[Melhoria — PostgreSQL]
- Hoje os pedidos ficam em memoria (Map) e somem ao reiniciar a API
- Entrega: Postgres + Prisma + Docker Compose
- Referencia: linkeats/back (Fastify + Prisma + PostgreSQL)
- DoD: pedidos persistem apos restart da API`

async function deleteGroup(base: string, cookies: string, taskId: string, groupId: string, items: Array<{ id: string }>) {
  for (const item of items) {
    await pmApi(base, cookies, `/api/tasks/${taskId}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ action: 'delete_item', itemId: item.id }),
    })
  }
  await pmApi(base, cookies, `/api/tasks/${taskId}/checklist`, {
    method: 'POST',
    body: JSON.stringify({ action: 'delete_group', groupId }),
  })
}

async function main() {
  const { base, cookies } = await pmSession()

  const checklistRes = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/checklist`)
  const { groups } = (await checklistRes.json()) as {
    groups: Array<{ id: string; title: string; items: Array<{ id: string }> }>
  }

  for (const group of groups.filter((g) => g.title.toLowerCase().includes('postgres'))) {
    await deleteGroup(base, cookies, TASK_ID, group.id, group.items)
    console.log(`- removido grupo antigo: ${group.title}`)
  }

  const groupRes = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/checklist`, {
    method: 'POST',
    body: JSON.stringify({ action: 'create_group', title: GROUP_TITLE }),
  })
  if (!groupRes.ok) throw new Error(await groupRes.text())
  const { group } = (await groupRes.json()) as { group: { id: string } }

  for (const item of ITEMS) {
    await pmApi(base, cookies, `/api/tasks/${TASK_ID}/checklist`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'create_item',
        groupId: group.id,
        title: item.title,
        description: item.description,
      }),
    })
  }
  console.log(`+ ${GROUP_TITLE} (${ITEMS.length} itens)`)

  const commentsRes = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/comments`)
  const comments = commentsRes.ok ? ((await commentsRes.json()) as Array<{ content: string }>) : []

  if (!comments.some((c) => c.content.startsWith('[Melhoria — PostgreSQL]'))) {
    await pmApi(base, cookies, `/api/tasks/${TASK_ID}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: COMMENT }),
    })
    console.log('+ comentario melhoria PostgreSQL')
  }

  console.log('\nPortal: https://projects.linksystem.tech/task-portal/52f16ea3-8612-4b56-b769-be96d8377bec')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

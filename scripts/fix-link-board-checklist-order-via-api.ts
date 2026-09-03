/**
 * Limpa duplicatas e recria checklist + comentarios da task Link Board.
 */
import { pmApi, pmSession } from './lib/pm-api-client'

const PROJECT_ID = 'cmsrxy2xh008knv2c1dk37vpb'
const TASK_ID = 'cmsryiir000egnv2cq54vzw87'
const REPO = 'https://github.com/GbFerrera/link-board'

const CHECKLIST: Array<{ title: string; items: Array<{ title: string; description?: string }> }> = [
  {
    title: '1. Setup',
    items: [
      { title: 'Clonar repo e instalar', description: REPO },
      { title: 'Rodar pnpm install:all && pnpm dev na raiz' },
      { title: 'Testar KDS em duas abas (WS tempo real)' },
    ],
  },
  {
    title: '2. Entender o codigo',
    items: [
      { title: 'web/lib/websocket-client.ts' },
      { title: 'web/components/kitchen-board.tsx' },
      { title: 'api/src/ws.js' },
      { title: 'Comparar com Link Eats (orders/page.tsx)' },
    ],
  },
  {
    title: '3. Features (escolher 3+)',
    items: [
      { title: 'Cancelar pedido (DELETE + Dialog)' },
      { title: 'Busca por cliente no KDS' },
      { title: 'Badge tempo de espera' },
      { title: 'Som ao novo pedido' },
      { title: 'Historico de entregues' },
    ],
  },
  {
    title: '4. shadcn (praticar UI)',
    items: [
      { title: 'Skeleton no loading' },
      { title: 'DropdownMenu no card' },
      { title: 'Sheet com detalhe do pedido' },
    ],
  },
  {
    title: '5. PostgreSQL + Prisma (melhoria — dev)',
    items: [
      { title: 'Adicionar Postgres no docker-compose.yml' },
      { title: 'Configurar Prisma — schema Order + OrderItem' },
      { title: 'Substituir store em memoria por Prisma (api/src/store.js)' },
      { title: 'DATABASE_URL em api/.env + prisma db push' },
      { title: 'Health check com status do banco' },
      { title: 'Validar persistencia apos restart da API' },
    ],
  },
  {
    title: '6. Debug',
    items: [
      { title: 'API offline com mensagem clara' },
      { title: 'WS desconecta ao trocar aba' },
      { title: 'Toast duplicado ao criar pedido' },
    ],
  },
  {
    title: '7. Docker',
    items: [
      { title: 'Dockerfile api + web' },
      { title: 'docker-compose.yml na raiz' },
      { title: 'README com docker compose up --build' },
    ],
  },
  {
    title: '8. Entrega',
    items: [
      { title: 'PR para develop' },
      { title: 'Demo GIF ou Loom' },
    ],
  },
]

const COMMENTS = [
  `[Contexto]
- Repo: ${REPO}
- Mini KDS onboarding Link System
- Stack: Next + shadcn + Fastify + WebSocket
- Pedidos hoje em memoria (Map)`,

  `[Ordem]
1. Setup → 2. Codigo → 3. Features → 4. shadcn
5. PostgreSQL (dev) → 6. Debug → 7. Docker → 8. Entrega`,

  `[Melhoria PostgreSQL — dev]
- Criar Postgres + Prisma + Docker Compose
- Substituir api/src/store.js (memoria) por banco
- Referencia: linkeats/back/prisma`,
]

async function deleteChecklistItem(base: string, cookies: string, itemId: string) {
  await pmApi(base, cookies, `/api/tasks/${TASK_ID}/checklist`, {
    method: 'DELETE',
    body: JSON.stringify({ action: 'delete_item', itemId }),
  })
}

async function deleteChecklistGroup(base: string, cookies: string, groupId: string) {
  await pmApi(base, cookies, `/api/tasks/${TASK_ID}/checklist`, {
    method: 'DELETE',
    body: JSON.stringify({ action: 'delete_group', groupId }),
  })
}

async function wipeChecklist(base: string, cookies: string) {
  const res = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/checklist`)
  const { groups } = (await res.json()) as {
    groups: Array<{ id: string; items: Array<{ id: string }> }>
  }
  if (!groups?.length) return
  for (const group of groups) {
    for (const item of group.items ?? []) {
      await deleteChecklistItem(base, cookies, item.id)
    }
    await deleteChecklistGroup(base, cookies, group.id)
  }
  console.log(`Removidos ${groups.length} grupos`)
  await wipeChecklist(base, cookies)
}

async function wipeComments(base: string, cookies: string) {
  const res = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/comments`)
  if (!res.ok) return
  const comments = (await res.json()) as Array<{ id: string }>
  for (const c of comments) {
    const del = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/comments/${c.id}`, {
      method: 'DELETE',
    })
    console.log(del.ok ? `- comment ${c.id}` : `! comment ${c.id} (${del.status})`)
  }
}

async function createChecklist(base: string, cookies: string) {
  for (const groupDef of CHECKLIST) {
    const groupRes = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ action: 'create_group', title: groupDef.title }),
    })
    if (!groupRes.ok) throw new Error(await groupRes.text())
    const { group } = (await groupRes.json()) as { group: { id: string } }
    for (const itemDef of groupDef.items) {
      await pmApi(base, cookies, `/api/tasks/${TASK_ID}/checklist`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_item',
          groupId: group.id,
          title: itemDef.title,
          description: itemDef.description,
        }),
      })
    }
    console.log(`+ ${groupDef.title}`)
  }
}

async function main() {
  const { base, cookies } = await pmSession()

  await wipeChecklist(base, cookies)
  await wipeComments(base, cookies)
  await createChecklist(base, cookies)

  for (const content of COMMENTS) {
    await pmApi(base, cookies, `/api/tasks/${TASK_ID}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
  }

  const shareRes = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/share`, {
    method: 'POST',
    body: JSON.stringify({ action: 'enable' }),
  })
  const share = (await shareRes.json()) as { shareUrl: string }

  await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: 'Onboarding — Link Board',
      description: `[Repo] ${REPO}\n\nPortal: ${share.shareUrl}`,
    }),
  })

  const verify = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/checklist`)
  const { groups } = await verify.json()
  const cr = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/comments`)
  const comments = await cr.json()

  console.log('\n--- OK ---')
  console.log(JSON.stringify({ groups: groups.length, comments: comments.length, shareUrl: share.shareUrl }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

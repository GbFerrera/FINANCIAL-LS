/**
 * Recria task Link Board limpa (sem duplicatas).
 */
import { pmApi, pmSession } from './lib/pm-api-client'

const PROJECT_ID = 'cmsrxy2xh008knv2c1dk37vpb'
const OLD_TASK_ID = 'cmsryiir000egnv2cq54vzw87'
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
- Pedidos hoje em memoria (Map em api/src/store.js)`,

  `[Ordem]
1. Setup → 2. Codigo → 3. Features → 4. shadcn
5. PostgreSQL (dev) → 6. Debug → 7. Docker → 8. Entrega`,

  `[Melhoria PostgreSQL — dev]
- Criar Postgres + Prisma + Docker Compose
- Substituir store em memoria por banco
- Referencia: linkeats/back/prisma`,
]

async function createChecklist(base: string, cookies: string, taskId: string) {
  for (const groupDef of CHECKLIST) {
    const groupRes = await pmApi(base, cookies, `/api/tasks/${taskId}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ action: 'create_group', title: groupDef.title }),
    })
    if (!groupRes.ok) throw new Error(await groupRes.text())
    const { group } = (await groupRes.json()) as { group: { id: string } }
    for (const itemDef of groupDef.items) {
      await pmApi(base, cookies, `/api/tasks/${taskId}/checklist`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_item',
          groupId: group.id,
          title: itemDef.title,
          description: itemDef.description,
        }),
      })
    }
  }
}

async function main() {
  const { base, cookies } = await pmSession()

  await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks/${OLD_TASK_ID}`, {
    method: 'DELETE',
  })
  console.log('Task antiga removida')

  const taskRes = await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      title: 'Onboarding — Link Board',
      description: `[Repo] ${REPO}`,
      status: 'TODO',
      priority: 'HIGH',
    }),
  })
  const task = (await taskRes.json()) as { id: string }

  const shareRes = await pmApi(base, cookies, `/api/tasks/${task.id}/share`, {
    method: 'POST',
    body: JSON.stringify({ action: 'enable' }),
  })
  const share = (await shareRes.json()) as { shareUrl: string; shareToken: string }

  await createChecklist(base, cookies, task.id)

  for (const content of COMMENTS) {
    await pmApi(base, cookies, `/api/tasks/${task.id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
  }

  await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks/${task.id}`, {
    method: 'PUT',
    body: JSON.stringify({ description: `[Repo] ${REPO}\n\nPortal: ${share.shareUrl}` }),
  })

  console.log(JSON.stringify({ taskId: task.id, shareUrl: share.shareUrl, groups: CHECKLIST.length, comments: COMMENTS.length }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

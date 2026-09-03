/**
 * Limpa task Link Board: remove checklist duplicado e comentarios verbosos.
 *
 * Uso:
 *   cd /Users/gabrielferreira/Desktop/projects
 *   npx tsx scripts/cleanup-link-board-task-via-api.ts
 */
import { pmApi, pmSession } from './lib/pm-api-client'

const PROJECT_ID = 'cmsrxy2xh008knv2c1dk37vpb'
const TASK_ID = 'cmsryiir000egnv2cq54vzw87'
const REPO = 'https://github.com/GbFerrera/link-board'
const PORTAL = 'https://projects.linksystem.tech/task-portal/52f16ea3-8612-4b56-b769-be96d8377bec'

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
    title: '4. shadcn (escolher 3+)',
    items: [
      { title: 'Skeleton no loading' },
      { title: 'DropdownMenu no card' },
      { title: 'Sheet com detalhe do pedido' },
    ],
  },
  {
    title: '5. Debug',
    items: [
      { title: 'API offline com mensagem clara' },
      { title: 'WS desconecta ao trocar aba' },
      { title: 'Toast duplicado ao criar pedido' },
    ],
  },
  {
    title: '6. Docker',
    items: [
      { title: 'Dockerfile api + web' },
      { title: 'docker-compose.yml na raiz' },
      { title: 'README com docker compose up --build' },
    ],
  },
  {
    title: '7. Entrega',
    items: [
      { title: 'PR para develop' },
      { title: 'Demo GIF ou Loom' },
    ],
  },
]

const COMMENTS = [
  `[Contexto]
- Repo: ${REPO}
- Mini KDS para onboarding Link System
- Scaffold pronto: Next + shadcn + Fastify + WebSocket
- Entrega: features, componentes, bugs, Docker`,

  `[Stack]
- Front: Next.js 16, React, TypeScript, Tailwind, shadcn/ui, Sonner
- Back: Node, Fastify, ws (WebSocket nativo)
- Por que WS: KDS atualiza na hora, mesmo padrao do Link Eats
- Tooling: pnpm, Git, Docker Compose`,

  `[Ordem]
1. Setup local
2. Ler codigo base
3. Implementar features + shadcn
4. Corrigir bugs listados
5. Docker + PR`,
]

const DESCRIPTION = `Onboarding Link Board — mini KDS em tempo real.

Repo: ${REPO}
Portal: ${PORTAL}

[Objetivo]
Aprender Next.js + shadcn + WebSocket no padrao Link Eats e entregar features, debug e Docker.

[DoD]
- pnpm dev sobe api + web
- 3+ features novas
- 3+ componentes shadcn
- Bugs da fase 5 corrigidos
- docker compose up --build ok
- PR em develop`

async function clearChecklist(base: string, cookies: string, taskId: string) {
  const res = await pmApi(base, cookies, `/api/tasks/${taskId}/checklist`)
  if (!res.ok) throw new Error(`get checklist: ${res.status}`)
  const { groups } = (await res.json()) as {
    groups: Array<{ id: string; items: Array<{ id: string }> }>
  }

  for (const group of groups ?? []) {
    for (const item of group.items ?? []) {
      await pmApi(base, cookies, `/api/tasks/${taskId}/checklist`, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_item', itemId: item.id }),
      })
    }
    await pmApi(base, cookies, `/api/tasks/${taskId}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ action: 'delete_group', groupId: group.id }),
    })
  }
  console.log(`Checklist limpa (${groups?.length ?? 0} grupos removidos)`)
}

async function createChecklist(base: string, cookies: string, taskId: string) {
  for (const groupDef of CHECKLIST) {
    const groupRes = await pmApi(base, cookies, `/api/tasks/${taskId}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ action: 'create_group', title: groupDef.title }),
    })
    if (!groupRes.ok) throw new Error(`create_group: ${await groupRes.text()}`)
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
    console.log(`+ ${groupDef.title}`)
  }
}

async function clearComments(base: string, cookies: string, taskId: string) {
  const res = await pmApi(base, cookies, `/api/tasks/${taskId}/comments`)
  if (!res.ok) throw new Error(`get comments: ${res.status}`)
  const comments = (await res.json()) as Array<{ id: string }>

  for (const comment of comments) {
    const del = await pmApi(base, cookies, `/api/tasks/${taskId}/comments/${comment.id}`, {
      method: 'DELETE',
    })
    if (del.ok) console.log(`- comentario ${comment.id}`)
    else console.log(`! nao removeu ${comment.id} (${del.status})`)
  }
}

async function main() {
  const { base, cookies } = await pmSession()

  await clearChecklist(base, cookies, TASK_ID)
  await createChecklist(base, cookies, TASK_ID)

  await clearComments(base, cookies, TASK_ID)
  for (const content of COMMENTS) {
    await pmApi(base, cookies, `/api/tasks/${TASK_ID}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
    console.log('+ comentario')
  }

  await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: 'Onboarding — Link Board',
      description: DESCRIPTION,
      priority: 'HIGH',
    }),
  })

  console.log('\nTask limpa:', PORTAL)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

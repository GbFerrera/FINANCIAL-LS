/**
 * Bootstrap projeto Link Board + task de onboarding (Next + shadcn + WS + Docker).
 *
 * Uso:
 *   cd /Users/gabrielferreira/Desktop/projects
 *   npx tsx scripts/create-link-board-onboarding-task-via-api.ts
 */
import { pmApi, pmSession } from './lib/pm-api-client'

const LINK_SYSTEM_CLIENT_ID = 'cmlri2e1b0004qu3itu4njpo9'
const PROJECT_NAME = 'LinkBoard'
const TASK_TITLE = 'Onboarding — Mini KDS + Docker'
const REPO_URL = 'https://github.com/GbFerrera/link-board'

const CHECKLIST: Array<{ title: string; items: Array<{ title: string; description?: string }> }> = [
  {
    title: '1. Ambiente local',
    items: [
      { title: 'Clonar repo público', description: REPO_URL },
      { title: 'Subir API — `cd api && pnpm install && pnpm dev` (porta 3333)' },
      { title: 'Subir Web — `cd web && pnpm install && pnpm dev` (porta 3000)' },
      { title: 'Testar tempo real — duas abas, criar pedido em /novo, ver KDS atualizar via WS' },
    ],
  },
  {
    title: '2. Entender o código (Link Eats mini)',
    items: [
      {
        title: 'Ler `web/lib/websocket-client.ts` — connect, join-room, handlers, reconnect',
      },
      {
        title: 'Ler `api/src/ws.js` — rooms, broadcast order-created / order-updated',
      },
      {
        title: 'Ler `web/components/kitchen-board.tsx` — fetch inicial + eventos WS + Sonner',
      },
      {
        title: 'Comparar com Link Eats — `linkeats/front/lib/websocket-client.ts` e `orders/page.tsx`',
      },
    ],
  },
  {
    title: '3. Docker (entrega principal)',
    items: [
      {
        title: 'Criar `api/Dockerfile` — Node 20, pnpm, expor 3333',
        description: 'Multi-stage opcional; `pnpm install --prod` ou install completo para dev',
      },
      {
        title: 'Criar `web/Dockerfile` — build Next + start (standalone se possível)',
      },
      {
        title: 'Criar `docker-compose.yml` na raiz — serviços api + web',
        description: 'Web depende da api; env NEXT_PUBLIC_API_URL e NEXT_PUBLIC_WS_URL apontando para api',
      },
      {
        title: 'Ajustar WS no compose — browser acessa ws via host publicado (ex. localhost:3333/ws)',
      },
      {
        title: 'Documentar no README — seção "Docker" com `docker compose up --build`',
      },
      {
        title: 'Validar — `docker compose up --build` e repetir teste das duas abas',
      },
    ],
  },
  {
    title: '4. Entrega',
    items: [
      { title: 'Branch `develop` + PR com Docker + README' },
      { title: 'GIF ou print — duas abas sincronizadas (local ou Docker)' },
      { title: 'Marcar checklist no task-portal conforme concluir cada fase' },
    ],
  },
]

const COMMENTS = [
  `## Contexto

Projeto de **onboarding** Link System — mini KDS em tempo real.

**Repo:** ${REPO_URL}

Stack: Next.js 16 + shadcn/ui + Fastify + WebSocket (\`/ws\`).

O scaffold (API + Web + WS) **já está pronto**. Sua entrega principal é **Dockerfile + docker-compose** para subir tudo com um comando.`,

  `## Ordem sugerida

1. Rodar local e entender WS/shadcn (fases 1–2)
2. Docker api → Docker web → compose na raiz
3. Testar \`docker compose up --build\`
4. PR para \`develop\``,

  `## Referências Link Eats

- \`linkeats/front/lib/websocket-client.ts\`
- \`linkeats/back/websocket-server.js\`
- \`linkeats/front/app/app/orders/page.tsx\`

**Definition of done Docker:** \`docker compose up --build\` sobe api:3333 + web:3000; criar pedido em /novo atualiza KDS em outra aba.`,
]

function taskDescription(shareUrl: string): string {
  return `Onboarding dev Link System — **Link Board** (mini KDS).

**Repo:** ${REPO_URL}

**Objetivo:** dominar Next.js + shadcn + WebSocket no padrão Link Eats e **entregar Docker + Compose**.

Portal: ${shareUrl}`
}

async function createChecklist(base: string, cookies: string, taskId: string) {
  for (const groupDef of CHECKLIST) {
    const groupRes = await pmApi(base, cookies, `/api/tasks/${taskId}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ action: 'create_group', title: groupDef.title }),
    })
    if (!groupRes.ok) throw new Error(`create_group: ${groupRes.status} ${await groupRes.text()}`)
    const { group } = (await groupRes.json()) as { group: { id: string } }

    for (const itemDef of groupDef.items) {
      const itemRes = await pmApi(base, cookies, `/api/tasks/${taskId}/checklist`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_item',
          groupId: group.id,
          title: itemDef.title,
          description: itemDef.description,
        }),
      })
      if (!itemRes.ok) throw new Error(`create_item: ${itemRes.status} ${await itemRes.text()}`)
    }
    console.log(`+ ${groupDef.title} (${groupDef.items.length} itens)`)
  }
}

async function findOrCreateProject(base: string, cookies: string): Promise<string> {
  const listRes = await pmApi(base, cookies, '/api/projects?limit=100')
  if (!listRes.ok) throw new Error(`list projects: ${listRes.status} ${await listRes.text()}`)
  const { projects } = (await listRes.json()) as { projects: Array<{ id: string; name: string }> }
  const existing = projects.find((p) => p.name === PROJECT_NAME || p.name === 'Link Board')
  if (existing) {
    console.log(`Projeto existente: ${existing.name} (${existing.id})`)
    return existing.id
  }

  const projectRes = await pmApi(base, cookies, '/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: PROJECT_NAME,
      description: 'Projeto de onboarding — Mini KDS (Next + shadcn + WS + Docker)',
      clientId: LINK_SYSTEM_CLIENT_ID,
      status: 'IN_PROGRESS',
      startDate: new Date().toISOString(),
    }),
  })
  if (!projectRes.ok) throw new Error(`create project: ${projectRes.status} ${await projectRes.text()}`)
  const project = (await projectRes.json()) as { id: string; name: string }
  console.log(`+ Projeto: ${project.name} (${project.id})`)
  return project.id
}

async function main() {
  const { base, cookies } = await pmSession()
  console.log(`PM: ${base}`)

  const projectId = await findOrCreateProject(base, cookies)

  const listRes = await pmApi(base, cookies, `/api/projects/${projectId}/tasks`)
  if (!listRes.ok) throw new Error(`list tasks: ${listRes.status} ${await listRes.text()}`)
  const tasks = (await listRes.json()) as Array<{ id: string; title: string }>
  const existing = tasks.find((t) => t.title === TASK_TITLE)

  let taskId: string
  if (existing) {
    taskId = existing.id
    console.log(`Task já existe: ${taskId}`)
  } else {
    const taskRes = await pmApi(base, cookies, `/api/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title: TASK_TITLE,
        description: '',
        status: 'TODO',
        priority: 'HIGH',
      }),
    })
    if (!taskRes.ok) throw new Error(`create task: ${taskRes.status} ${await taskRes.text()}`)
    const task = (await taskRes.json()) as { id: string; title: string }
    taskId = task.id
    console.log(`+ Task: ${task.title} (${taskId})`)
  }

  const shareRes = await pmApi(base, cookies, `/api/tasks/${taskId}/share`, {
    method: 'POST',
    body: JSON.stringify({ action: 'enable' }),
  })
  if (!shareRes.ok) throw new Error(`enable share: ${shareRes.status} ${await shareRes.text()}`)
  const share = (await shareRes.json()) as { shareUrl: string; shareToken: string }
  console.log(`+ Task portal: ${share.shareUrl}`)

  const portalRes = await fetch(`${base}/api/task-portal/${share.shareToken}`)
  const portal = (await portalRes.json()) as { checklist?: { groups?: unknown[] } }
  if ((portal.checklist?.groups?.length ?? 0) === 0) {
    await createChecklist(base, cookies, taskId)
    console.log(`+ Checklist: ${CHECKLIST.reduce((n, g) => n + g.items.length, 0)} itens`)
  } else {
    console.log('Checklist já existe — skip')
  }

  for (const content of COMMENTS) {
    const prefix = content.slice(0, 40)
    const commentsRes = await pmApi(base, cookies, `/api/tasks/${taskId}/comments`)
    const existingComments = commentsRes.ok
      ? ((await commentsRes.json()) as Array<{ content: string }>)
      : []
    if (existingComments.some((c) => c.content.startsWith(prefix))) {
      console.log('Comentário já existe — skip')
      continue
    }
    const res = await pmApi(base, cookies, `/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
    if (!res.ok) throw new Error(`comment: ${res.status} ${await res.text()}`)
    console.log('+ comentário')
  }

  await pmApi(base, cookies, `/api/projects/${projectId}/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify({ description: taskDescription(share.shareUrl), priority: 'HIGH' }),
  })

  console.log('\n--- Resultado ---')
  console.log(
    JSON.stringify(
      {
        projectId,
        taskId,
        shareToken: share.shareToken,
        shareUrl: share.shareUrl,
        repoUrl: REPO_URL,
      },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

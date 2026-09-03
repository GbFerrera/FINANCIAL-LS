/**
 * Atualiza checklist da task Link Board — onboarding completo (features, shadcn, debug, docker).
 *
 * Uso:
 *   cd /Users/gabrielferreira/Desktop/projects
 *   npx tsx scripts/update-link-board-onboarding-task-via-api.ts
 */
import { pmApi, pmSession } from './lib/pm-api-client'

const PROJECT_ID = 'cmsrxy2xh008knv2c1dk37vpb'
const TASK_ID = 'cmsrxy31l008onv2c7b4thvbj'
const REPO_URL = 'https://github.com/GbFerrera/link-board'

const CHECKLIST: Array<{ title: string; items: Array<{ title: string; description?: string }> }> = [
  {
    title: '1. Ambiente e primeiro run',
    items: [
      { title: 'Clonar repo', description: REPO_URL },
      { title: 'Instalar deps — `pnpm install:all` na raiz (ou api + web separados)' },
      { title: 'Subir tudo — `pnpm dev` na raiz (api :3333 + web :3000 juntos)' },
      { title: 'Validar health — http://localhost:3333/health retorna `{ ok: true }`' },
      { title: 'Teste WS — duas abas em /, criar pedido em /novo, KDS atualiza sem refresh' },
      {
        title: 'Se aparecer "Failed to fetch" — confirmar API rodando e ler banner vermelho no topo',
        description: 'Erro comum: só subiu o front. Sempre rodar api + web.',
      },
    ],
  },
  {
    title: '2. Entender a base (Link Eats mini)',
    items: [
      { title: 'Mapear fluxo REST — POST /orders → broadcast WS → KDS re-render' },
      { title: 'Estudar `web/lib/websocket-client.ts` — join-room, handlers, reconnect' },
      { title: 'Estudar `web/components/kitchen-board.tsx` — fetch + subscribe WS + Sonner' },
      { title: 'Estudar `api/src/ws.js` — rooms, broadcast order-created / order-updated' },
      { title: 'Comparar com Link Eats — `linkeats/front/lib/websocket-client.ts` e `orders/page.tsx`' },
    ],
  },
  {
    title: '3. Novas features (implementar)',
    items: [
      {
        title: 'Feature: cancelar pedido',
        description: 'DELETE /orders/:id na API + botão com Dialog de confirmação no card; broadcast order-cancelled',
      },
      {
        title: 'Feature: busca por cliente',
        description: 'Input no KDS filtrando cards por customerName (client-side ou query na API)',
      },
      {
        title: 'Feature: tempo de espera',
        description: 'Badge "há X min" no card usando createdAt + date-fns ou Intl',
      },
      {
        title: 'Feature: som ao novo pedido',
        description: 'Tocar áudio curto quando WS dispara order-created (como Link Eats notifications)',
      },
      {
        title: 'Feature: histórico entregues',
        description: 'Tab ou rota /historico listando status delivered (últimas 24h)',
      },
    ],
  },
  {
    title: '4. Componentes shadcn (praticar UI)',
    items: [
      { title: 'Adicionar Skeleton — loading do KDS enquanto fetchOrders()' },
      { title: 'Adicionar DropdownMenu — ações rápidas no card (Iniciar / Cancelar / Ver detalhes)' },
      { title: 'Adicionar Sheet ou Drawer — detalhe expandido do pedido ao clicar no card' },
      { title: 'Refinar empty state — ilustração + CTA "Criar primeiro pedido"' },
      { title: 'Garantir responsivo — grid 1 col mobile, 2 tablet, 3 desktop' },
    ],
  },
  {
    title: '5. Debug e correção de bugs',
    items: [
      {
        title: 'Bug: mensagem clara quando API offline',
        description: 'Melhorar tratamento em lib/api.ts e banner ApiStatusBanner (já iniciado no repo)',
      },
      {
        title: 'Bug: pedido sumiu após reload',
        description: 'Documentar que store é em memória; opcional: persistir JSON ou SQLite',
      },
      {
        title: 'Bug: WS desconecta ao trocar de aba',
        description: 'Revisar connect/disconnect no useEffect; evitar disconnect agressivo',
      },
      {
        title: 'Bug: duplo toast ao criar pedido na mesma aba',
        description: 'Evitar toast local + WS na aba que originou o POST',
      },
      {
        title: 'Registrar achados — comentar no task-portal o que causou cada bug e como corrigiu',
      },
    ],
  },
  {
    title: '6. Docker e Compose',
    items: [
      { title: 'Criar `api/Dockerfile` — Node 20, pnpm, expor 3333' },
      { title: 'Criar `web/Dockerfile` — build Next standalone + start' },
      {
        title: 'Criar `docker-compose.yml` — serviços api + web',
        description: 'NEXT_PUBLIC_API_URL e NEXT_PUBLIC_WS_URL apontando para host exposto',
      },
      { title: 'README — seção Docker com `docker compose up --build`' },
      { title: 'Validar E2E no Docker — duas abas, criar pedido, avançar status' },
    ],
  },
  {
    title: '7. Entrega',
    items: [
      { title: 'Branch feature/* → PR para develop com descrição do que implementou' },
      { title: 'Demo — GIF ou Loom: features + WS + Docker' },
      { title: 'Marcar checklist no task-portal item a item' },
      { title: 'Code review com mentor — padrões Link System (TypeScript, shadcn, WS)' },
    ],
  },
]

const COMMENTS = [
  `## Objetivo do onboarding

Repo de treino **Link Board** — mini KDS em tempo real.

**Repo:** ${REPO_URL}

Você vai: **entender a base → criar features → praticar shadcn → debugar bugs → Docker**.

Não é só ler código: cada fase tem entrega concreta em PR.`,

  `## Ordem recomendada

1. Ambiente (fase 1) — **obrigatório antes de tudo**
2. Entender WS/REST (fase 2)
3. Features (fase 3) — escolher pelo menos **3** das 5
4. shadcn (fase 4) — pelo menos **3** componentes novos
5. Debug (fase 5) — corrigir **todos** os bugs listados
6. Docker (fase 6)
7. PR + demo (fase 7)`,

  `## Definition of done

- \`pnpm dev\` na raiz sobe api + web sem "Failed to fetch"
- Pelo menos 3 features novas funcionando + WS ok
- Pelo menos 3 componentes shadcn adicionados/usados
- Bugs da fase 5 corrigidos com comentário no portal
- \`docker compose up --build\` funcional
- PR aprovado em develop`,

  `## Stack — principais tecnologias (Link System)

Ver comentário dedicado nesta task com tabela completa: **Next.js, React, TS, Tailwind, shadcn, Fastify, ws, pnpm, Docker** — o que é, por que usamos e como espelha o Link Eats.`,
]

function taskDescription(shareUrl: string): string {
  return `Onboarding dev Link System — **Link Board**.

**Repo:** ${REPO_URL}

**Trilha:** ambiente → código base → **features** → **shadcn** → **debug** → **Docker** → PR.

Portal: ${shareUrl}`
}

async function clearChecklist(base: string, cookies: string, taskId: string) {
  const res = await pmApi(base, cookies, `/api/tasks/${taskId}/checklist`)
  if (!res.ok) throw new Error(`get checklist: ${res.status} ${await res.text()}`)
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
  console.log(`Checklist anterior removida (${groups?.length ?? 0} grupos)`)
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

async function main() {
  const { base, cookies } = await pmSession()
  console.log(`PM: ${base}`)

  await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: 'Onboarding — Dev Full Stack (Link Board)',
      priority: 'HIGH',
      status: 'TODO',
    }),
  })

  await clearChecklist(base, cookies, TASK_ID)
  await createChecklist(base, cookies, TASK_ID)
  console.log(`+ Checklist nova: ${CHECKLIST.reduce((n, g) => n + g.items.length, 0)} itens`)

  const shareRes = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/share`, {
    method: 'POST',
    body: JSON.stringify({ action: 'enable' }),
  })
  if (!shareRes.ok) throw new Error(`share: ${shareRes.status} ${await shareRes.text()}`)
  const share = (await shareRes.json()) as { shareUrl: string; shareToken: string }

  for (const content of COMMENTS) {
    const res = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
    if (!res.ok) throw new Error(`comment: ${res.status} ${await res.text()}`)
    console.log('+ comentário')
  }

  await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}`, {
    method: 'PUT',
    body: JSON.stringify({ description: taskDescription(share.shareUrl) }),
  })

  console.log('\n--- Resultado ---')
  console.log(
    JSON.stringify(
      {
        projectId: PROJECT_ID,
        taskId: TASK_ID,
        shareUrl: share.shareUrl,
        items: CHECKLIST.reduce((n, g) => n + g.items.length, 0),
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

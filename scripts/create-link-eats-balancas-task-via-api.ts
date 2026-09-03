/**
 * Cria task "Implementação de Balanças" no projeto Link Eats (PM produção).
 *
 * Uso:
 *   PM_EMAIL=... PM_PASSWORD=... npx tsx scripts/create-link-eats-balancas-task-via-api.ts
 */
import { pmApi, pmSession } from './lib/pm-api-client'

const PROJECT_ID = 'cmltidb5000awp81xkssz2a26'
const TASK_TITLE = 'Implementação de Balanças'

const CHECKLIST: Array<{ title: string; items: Array<{ title: string; description?: string }> }> = [
  {
    title: '1. Discovery e hardware',
    items: [
      { title: 'Levantar modelo(s) de balança alvo — protocolo (serial/USB), baud rate, layout do frame' },
      { title: 'Documentar formato da string enviada — peso, preço/kg, total (se a balança envia)' },
      { title: 'Definir ambiente de teste — balança física + PC Windows com Printer instalado' },
      { title: 'Mapear produto “por quilo” no cardápio — flag ou categoria específica' },
    ],
  },
  {
    title: '2. Printer — integração balança',
    items: [
      { title: 'Módulo de leitura contínua (serial/port) no app Electron' },
      { title: 'Parser estável — debounce, ignorar leituras inválidas, log local' },
      { title: 'Tela/fluxo operador — cartão lido ou código informado antes/depois da pesagem' },
      {
        title: 'Enviar evento ao back',
        description: '{ cardToken|code, weight, pricePerKg, total, deviceId }',
      },
      { title: 'Testes ponta a ponta Printer → API (mock + hardware)' },
    ],
  },
  {
    title: '3. Backend — API e comanda',
    items: [
      { title: 'Endpoint autenticado (printer/device) para registrar pesagem' },
      { title: 'Validar cartão TabCard ativo e comanda Tab aberta' },
      { title: 'Criar item de pedido com quantidade = peso (kg) e preço unitário = R$/kg' },
      { title: 'Garantir idempotência — mesma leitura duplicada não duplica item' },
      { title: 'WS/evento opcional — atualizar painel salão em tempo real' },
      { title: 'Testes API + cenários: cartão livre, comanda fechada, peso zero' },
    ],
  },
  {
    title: '4. Front — operação e config',
    items: [
      { title: 'Config empresa — habilitar balança, preço/kg padrão ou produto vinculado' },
      { title: 'Status cartão/comanda na operação (mesa/comandas) — feedback pós-pesagem' },
      { title: 'Documentar fluxo operador para restaurante piloto' },
    ],
  },
  {
    title: '5. Homologação e deploy',
    items: [
      { title: 'Roteiro E2E — pesar → cartão → item na comanda → impressão cupom (se aplicável)' },
      { title: 'Sandbox: deploy back + front + build Printer' },
      { title: 'Produção: após OK do cliente piloto' },
      { title: 'Atualizar vault — Printer, Módulos e rotas' },
    ],
  },
]

const COMMENTS = [
  `## Contexto

Feature para restaurantes com **venda por peso** (self-service / buffet por quilo). A balança dispara a leitura e o sistema amarra à comanda do **cartão** do salão — sem lançamento manual de peso no garçom.

**Repos:** \`linkeats/printer\`, \`linkeats/back\`, \`linkeats/front\`

Referências código:
- \`back/prisma/schema.prisma\` → TabCard, Tab, Order
- \`front/app/app/settings/page.tsx\` → cartões QR
- \`printer/\` → Electron + WS`,

  `## Ordem de execução

1. Discovery hardware (bloqueante)
2. POC leitura no Printer (serial → console)
3. API back mínima + teste com Postman
4. Vínculo cartão → comanda → order item
5. UI operador + config front
6. E2E sandbox → prod`,

  `## Definition of done

- Pesagem real na balança piloto gera **um item** na comanda correta em **< 3 s** após estabilizar peso
- Re-leitura acidental **não** duplica cobrança
- Fluxo documentado no vault + task-portal marcável por fase

**Fora de escopo v1:** todas as marcas de balança; delivery por peso (foco salão + cartão).`,
]

function taskDescription(shareUrl: string): string {
  return `Integrar **balanças comerciais** ao fluxo de comandas do Link Eats (Printer + Back + Front).

**Objetivo:** balança envia peso/valor → vínculo com TabCard → item na comanda Tab/Order.

**Monorepo:** \`/Users/gabrielferreira/Desktop/linkeats\`

Portal: ${shareUrl}`
}

async function createChecklist(
  base: string,
  cookies: string,
  taskId: string
) {
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

  const listRes = await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks`)
  if (!listRes.ok) throw new Error(`list tasks: ${listRes.status} ${await listRes.text()}`)
  const tasks = (await listRes.json()) as Array<{ id: string; title: string; shareToken?: string | null }>
  const existing = tasks.find((t) => t.title === TASK_TITLE)

  let taskId: string
  if (existing) {
    taskId = existing.id
    console.log(`Task já existe: ${taskId} — populando se necessário`)
  } else {
    const taskRes = await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks`, {
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
    console.log(`+ Task: ${task.title} (${taskId}) · prioridade HIGH`)
  }

  await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify({ priority: 'HIGH' }),
  })

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

  await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify({ description: taskDescription(share.shareUrl) }),
  })
  console.log('Descrição atualizada')

  console.log('\n--- Resultado ---')
  console.log(
    JSON.stringify(
      {
        projectId: PROJECT_ID,
        taskId,
        shareToken: share.shareToken,
        shareUrl: share.shareUrl,
        priority: 'HIGH',
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

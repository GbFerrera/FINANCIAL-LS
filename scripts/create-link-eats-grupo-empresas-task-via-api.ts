/**
 * Cria task "Grupo de Empresas" no projeto Link Eats (PM produção).
 *
 * Uso:
 *   npx tsx scripts/create-link-eats-grupo-empresas-task-via-api.ts
 * (PM_EMAIL / PM_PASSWORD em .env.local)
 */
import { config } from 'dotenv'
import { pmApi, pmSession } from './lib/pm-api-client'

config({ path: '.env.local' })
config()

const PROJECT_ID = 'cmltidb5000awp81xkssz2a26'
const TASK_TITLE = 'Grupo de Empresas'
const ESTIMATED_MINUTES = 3 * 8 * 60 // 3 dias · 24 h

const CHECKLIST: Array<{ title: string; items: Array<{ title: string; description?: string }> }> = [
  {
    title: '1. Modelo de dados',
    items: [
      {
        title: 'Schema Prisma — CorporateClient, Contract, Employee, Wallet, Invoice',
        description: 'incluir extensão TabCard (purpose corporate/salao)',
      },
      { title: 'Migration + enums tipos contrato' },
    ],
  },
  {
    title: '2. Cadastros B2B',
    items: [
      { title: 'API CRUD empresas contratantes (CNPJ, contato)' },
      { title: 'API CRUD contratos + campos por tipo (5 modelos)' },
      { title: 'API CRUD funcionários + vínculo cartão' },
      { title: 'TabCard modo corporativo vs salão' },
    ],
  },
  {
    title: '3. Motores por tipo de contrato',
    items: [
      { title: 'Créditos mensais — saldo, débito, reset período', description: 'sempre via cartão' },
      { title: 'Consumo por funcionário — ledger + cartão', description: 'sempre via cartão' },
      {
        title: 'Quantidade fixa marmitas — cota + baixa cartão/dia',
        description: 'controle diário + extras à parte',
      },
      { title: 'Valor fixo mensal — cobrança recorrente' },
      { title: 'Faturamento por período — invoice + fechamento' },
      {
        title: 'Itens fora do contrato / pagamento à parte',
        description: 'ex.: bebida paga por fora (billing_scope personal)',
      },
    ],
  },
  {
    title: '4. Pedidos e integração',
    items: [
      { title: 'Middleware checkout com cartão corporativo' },
      { title: 'Order/Tab — billing_scope contrato vs pessoal' },
      { title: 'Relatórios consumo empresa/funcionário/dia' },
    ],
  },
  {
    title: '5. Front — config e operação',
    items: [
      { title: 'Menu Cadastros → Grupo de Empresas' },
      { title: 'Telas empresa + contrato (form dinâmico por tipo)' },
      { title: 'Funcionários + emitir/associar cartões' },
      { title: 'Operação garçom/caixa — scan, saldo/cota, pagar à parte' },
      { title: 'Dashboard faturamento / fechamento período' },
    ],
  },
  {
    title: '6. Cardápio e garçom',
    items: [
      { title: 'Cardápio — fluxo cartão corporativo' },
      { title: 'Garçom — operação B2B' },
    ],
  },
  {
    title: '7. Homologação e deploy',
    items: [
      { title: 'E2E por tipo de contrato (5 cenários)' },
      { title: 'Sandbox + restaurante piloto' },
      { title: 'Atualizar vault — Módulos e rotas' },
    ],
  },
]

const COMMENTS = [
  `## Contexto — Grupo de Empresas

Contratos **B2B**: restaurante atende empresas (marmitas, refeitório corporativo). Cadastro da empresa contratante + **tipo de contrato** + funcionários com **cartão**.

**5 modelos:** valor fixo mensal · quantidade fixa marmitas · consumo por funcionário · créditos mensais · faturamento por período.

**Regra:** créditos, consumo por funcionário e marmitas fixas **sempre passam pelo cartão**. Marmitas fixas registram **quem comeu em qual dia**. Itens fora (ex. bebida) → **pagar à parte**.

**Spec completa:** \`link-brain/Projetos/Link Eats/Tarefa - Grupo de Empresas.md\`

**Base código:** TabCard/comandas existentes — estender, não substituir salão.`,

  `## Ordem de execução

1. Schema + migrations (bloqueante)
2. CRUD empresas/contratos/funcionários + cartão corporativo
3. Motor créditos + consumo + marmitas (cartão)
4. Checkout pedido + billing_scope pessoal
5. Front cadastros + operação
6. Cardápio/garçom B2B
7. Faturamento período + E2E

**Estimativa total:** 3 dias (24 h) · spec no vault.`,

  `## Modelos de contrato (resumo)

| Tipo | Cartão |
|------|--------|
| Créditos mensais | Sim — debita saldo |
| Consumo por funcionário | Sim — ledger |
| Qtd fixa marmitas | Sim — baixa cota + log/dia |
| Valor fixo mensal | Cobrança recorrente |
| Faturamento período | Consolida consumo |

**DoD:** funcionário passa cartão → regra aplicada; extra fora do contrato cobrado à parte; fechamento gera fatura.`,
]

function taskDescription(shareUrl: string): string {
  return `**Grupo de Empresas** — contratos B2B (5 tipos) + cartões corporativos + faturamento.

Empresas contratantes, funcionários, créditos/marmitas/consumo via **TabCard** estendido. Extras (bebida) pagos à parte.

**Estimativa:** 3 dias (24 h) · spec no vault.

**Monorepo:** \`/Users/gabrielferreira/Desktop/linkeats\`

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

async function main() {
  const { base, cookies } = await pmSession()
  console.log(`PM: ${base}`)

  const listRes = await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks`)
  if (!listRes.ok) throw new Error(`list tasks: ${listRes.status} ${await listRes.text()}`)
  const tasks = (await listRes.json()) as Array<{ id: string; title: string }>
  const existing = tasks.find((t) => t.title === TASK_TITLE)

  let taskId: string
  if (existing) {
    taskId = existing.id
    console.log(`Task já existe: ${taskId}`)
  } else {
    const taskRes = await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title: TASK_TITLE,
        description: '',
        status: 'TODO',
        priority: 'HIGH',
        estimatedMinutes: ESTIMATED_MINUTES,
      }),
    })
    if (!taskRes.ok) throw new Error(`create task: ${taskRes.status} ${await taskRes.text()}`)
    const task = (await taskRes.json()) as { id: string; title: string }
    taskId = task.id
    console.log(`+ Task: ${task.title} (${taskId}) · HIGH · ${ESTIMATED_MINUTES / 60}h`)
  }

  await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify({ priority: 'HIGH', estimatedMinutes: ESTIMATED_MINUTES }),
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
        estimatedHours: ESTIMATED_MINUTES / 60,
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

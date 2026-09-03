/**
 * Atualiza task "Implementação de Balanças" — novo fluxo (ago/2026).
 *
 * Uso:
 *   cd /Users/gabrielferreira/Desktop/projects
 *   PM_EMAIL=... PM_PASSWORD=... npx tsx scripts/update-link-eats-balancas-task-via-api.ts
 */
import { pmApi, pmSession } from './lib/pm-api-client'

const PROJECT_ID = 'cmltidb5000awp81xkssz2a26'
const TASK_ID = 'cmsrklnwg004snv2crcoc2mb6'
const SHARE_TOKEN = '906a446e-a81e-4162-adc3-b65b75ffa342'
const PORTAL = `https://projects.linksystem.tech/task-portal/${SHARE_TOKEN}`

const CHECKLIST: Array<{ title: string; items: Array<{ title: string; description?: string }> }> = [
  {
    title: '1. Printer — leitura de peso (pronto)',
    items: [
      {
        title: 'Leitura serial contínua + auto-detect protocolo/baud',
        description: 'printer/scale/ScaleService.js',
      },
      {
        title: 'Parser estável — debounce, leituras inválidas, log local',
        description: 'printer/scale/protocols.js',
      },
      {
        title: 'Protocolos documentados (Toledo, Filizola, Urano, Elgin, ENQ, simples)',
      },
      {
        title: 'Ambiente físico testado — balança + Printer Windows',
      },
    ],
  },
  {
    title: '2. Printer — ativar cartão com peso',
    items: [
      {
        title: 'UI: número do cartão + botão Ativar (após peso estável na aba Balança)',
      },
      {
        title: 'Chamar API de ativação com code + peso (kg) + preço/kg + total',
        description: 'Reutilizar /company/tab-cards/activate (estender body)',
      },
      {
        title: 'Validações: cartão livre, peso > 0, peso estável antes de ativar',
      },
      { title: 'Testes Printer → API (mock + hardware)' },
    ],
  },
  {
    title: '3. Backend — cartão, config e baixa',
    items: [
      {
        title: 'Estender activate — registrar pesagem na comanda/tab ao ativar cartão',
      },
      {
        title: 'Config empresa: modo garçom — exibir cartões OU mesas',
      },
      {
        title: 'Config empresa: cartões + opção vincular mesa (people_count na Tab)',
      },
      {
        title: 'Activate sem mesa quando modo = só cartões (table_id opcional)',
      },
      {
        title: 'Endpoint liberar cartão (baixa caixa) — status free + encerrar comanda',
      },
      { title: 'Testes API: cartão livre, ativo, peso zero, mesa opcional/obrigatória' },
    ],
  },
  {
    title: '4. Front — config, garçom e caixa',
    items: [
      {
        title: 'Settings — escolher exibição garçom: cartões ou mesas',
      },
      {
        title: 'Settings — sub-opção: vincular mesa ao cartão + quantidade de pessoas',
      },
      { title: 'Garçom — adaptar tela inicial conforme config (cartões vs mesas)' },
      {
        title: 'Garçom — fluxo mesa + pessoas quando vincular mesa estiver habilitado',
      },
      {
        title: 'Caixa — buscar cartão por número e dar baixa (liberar reutilização)',
        description: 'front/app/app/operacao/caixa/page.tsx',
      },
    ],
  },
  {
    title: '5. Homologação e deploy',
    items: [
      {
        title: 'Roteiro E2E — pesar → ativar no Printer → consumo garçom → baixa no caixa',
      },
      { title: 'Sandbox: deploy back + front + build Printer' },
      { title: 'Produção: após OK do cliente piloto' },
      { title: 'Atualizar vault — fluxo balança + cartões + caixa' },
    ],
  },
]

/** Itens já concluídos (fase 1). */
const DONE_TITLES = new Set([
  'Leitura serial contínua + auto-detect protocolo/baud',
  'Parser estável — debounce, leituras inválidas, log local',
  'Protocolos documentados (Toledo, Filizola, Urano, Elgin, ENQ, simples)',
  'Ambiente físico testado — balança + Printer Windows',
])

const FLOW_COMMENT = `## Fluxo revisado (18/08/2026)

**Etapa 1 — Pesagem (Printer, pronto)**  
Cliente pesa na balança → Printer captura peso automaticamente (serial).

**Etapa 2 — Ativação (Printer)**  
Operador digita **número do cartão** e clica **Ativar** → mesma lógica TabCard existente, enviando peso/preço/total.

**Etapa 3 — Config + Garçom (Front)**  
- Config: garçom vê **cartões** ou **mesas**
- Se cartões: opção extra **sempre vincular mesa** → garçom informa mesa + qtd pessoas

**Etapa 4 — Baixa (Caixa)**  
Após refeição, caixa **busca cartão** e dá baixa → cartão volta a \`free\`.

**Removido do escopo:** produto por kg no cardápio, item OrderItem separado, WS tempo real pós-pesagem.`

const DESCRIPTION = `Integrar **balanças** ao fluxo de **cartões/comandas** do Link Eats.

**Fluxo:** pesar (Printer) → ativar cartão com peso (Printer) → operação garçom (config cartões/mesas) → baixa no caixa.

**Monorepo:** \`/Users/gabrielferreira/Desktop/linkeats\`

Portal: ${PORTAL}`

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
  if (!res.ok) throw new Error(`get checklist: ${res.status}`)
  const { groups } = (await res.json()) as {
    groups: Array<{ id: string; items: Array<{ id: string }> }>
  }
  for (const group of groups ?? []) {
    for (const item of group.items ?? []) {
      await deleteChecklistItem(base, cookies, item.id)
    }
    await deleteChecklistGroup(base, cookies, group.id)
  }
  console.log(`Checklist anterior removida (${groups?.length ?? 0} grupos)`)
}

async function createChecklist(base: string, cookies: string) {
  for (const groupDef of CHECKLIST) {
    const groupRes = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ action: 'create_group', title: groupDef.title }),
    })
    if (!groupRes.ok) throw new Error(`create_group: ${groupRes.status} ${await groupRes.text()}`)
    const { group } = (await groupRes.json()) as { group: { id: string } }

    for (const itemDef of groupDef.items) {
      const itemRes = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/checklist`, {
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

async function markDoneViaPortal() {
  const portalRes = await fetch(`${PORTAL.replace('/task-portal/', '/api/task-portal/')}`)
  const portal = (await portalRes.json()) as {
    checklist?: { groups?: Array<{ items?: Array<{ id: string; title: string }> }> }
  }
  let marked = 0
  for (const group of portal.checklist?.groups ?? []) {
    for (const item of group.items ?? []) {
      if (!DONE_TITLES.has(item.title)) continue
      const res = await fetch(`${PORTAL.replace('/task-portal/', '/api/task-portal/')}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_item', itemId: item.id, done: true }),
      })
      if (res.ok) {
        marked++
        console.log(`✓ done: ${item.title}`)
      }
    }
  }
  console.log(`Marcados done: ${marked}/${DONE_TITLES.size}`)
}

async function main() {
  const { base, cookies } = await pmSession()
  console.log(`PM: ${base}`)

  await wipeChecklist(base, cookies)
  await createChecklist(base, cookies)
  await markDoneViaPortal()

  const taskRes = await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}`, {
    method: 'PUT',
    body: JSON.stringify({ description: DESCRIPTION, priority: 'HIGH', status: 'IN_PROGRESS' }),
  })
  if (!taskRes.ok) throw new Error(`update task: ${taskRes.status} ${await taskRes.text()}`)
  console.log('Descrição + status IN_PROGRESS')

  const commentsRes = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/comments`)
  const existing = commentsRes.ok ? ((await commentsRes.json()) as Array<{ content: string }>) : []
  if (!existing.some((c) => c.content.includes('Fluxo revisado (18/08/2026)'))) {
    const res = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: FLOW_COMMENT }),
    })
    if (!res.ok) throw new Error(`comment: ${res.status} ${await res.text()}`)
    console.log('+ comentário fluxo revisado')
  }

  const total = CHECKLIST.reduce((n, g) => n + g.items.length, 0)
  console.log(`\n--- Resultado ---`)
  console.log(JSON.stringify({ taskId: TASK_ID, shareToken: SHARE_TOKEN, portal: PORTAL, total, done: DONE_TITLES.size }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

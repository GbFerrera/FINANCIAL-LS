/**
 * Cria tasks — Comandas (acréscimo/juros + fechar pela agenda) no PM — Link Callendar.
 *
 * Uso:
 *   cd /Users/gabrielferreira/Desktop/projects
 *   npx tsx scripts/create-link-calendar-comandas-tasks-via-api.ts
 */
import { config } from 'dotenv'
import { pmApi, pmSession } from './lib/pm-api-client'

config({ path: '.env.local' })
config()

const PROJECT_ID = 'cmnhenfhr002tp4202x1aw096'
const PROJECT_NAME = 'Link Callendar'
const ASSIGNEE_ID = 'cmsrzl9ya00j9nv2cofivhy8s' // Fabricio
const ASSIGNEE_NAME = 'Fabricio'

type TaskDef = {
  title: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  estimatedHours: number
  dueDate?: string
  description: string
  comments: string[]
  checklist: Array<{ title: string; items: Array<{ title: string; description?: string }> }>
}

const TASKS: TaskDef[] = [
  {
    title: 'Comandas — Acréscimo/juros ao fechar comanda',
    priority: 'HIGH',
    estimatedHours: 1,
    description: `Implementar lógica para adicionar **acréscimo/juros** (ou taxa similar) no fluxo de **fechar comanda**, com paridade entre back, LC-FRONT e mobile-web.

**Estado atual:** descontos existem **por item** (\`PATCH /commands/:id/items/discounts\`). Não há campo, API nem UI para juros/acréscimo no total da comanda. Fechamento canônico = \`POST /payments\` (exige gaveta aberta).

**Repos:** \`linkcallendar/back\`, \`front/\`, \`mobile-web/\``,
    comments: [
      `## Análise (2026-09-01)

### Fluxo atual de fechamento
- **Front:** \`front/app/financial/commands/page.tsx\` — dialog "Fechar Comanda" com descontos por item + split de métodos de pagamento
- **Mobile-web:** \`mobile-web/app/comandas/page.tsx\` — modal equivalente
- **Back:** \`POST /payments\` fecha comanda (\`status: closed\`); descontos salvos antes via \`PATCH /commands/:id/items/discounts\`

### Gap
- Não existe \`surcharge\` / \`juros\` / \`interest\` / \`fee\` no schema (\`commands\`, \`command_items\`, \`payments\`)
- \`total_amount\` do pagamento = soma dos itens (com desconto por item), sem acréscimo global

### Sugestão técnica
1. Migration em \`commands\`: \`surcharge_type\` (\`none|percentage|fixed\`), \`surcharge_value\`, \`surcharge_label\` (ex. "Juros")
2. \`PATCH /commands/:id/surcharge\` — validar comanda aberta
3. Total final = subtotal itens + acréscimo
4. UI no dialog de pagamento (front + mobile-web): tipo, valor, label opcional, breakdown no resumo
5. Salvar acréscimo antes do \`POST /payments\`; \`total_amount\` deve incluir acréscimo

### Referências
- \`back/src/utils/discountCalculator.js\` — espelhar padrão para acréscimo
- \`back/src/controllers/paymentsController.js\` — fechamento + gaveta`,
    ],
    checklist: [
      {
        title: '1. Back — schema e API',
        items: [
          { title: 'Migration: surcharge_type, surcharge_value, surcharge_label em commands' },
          { title: 'Util surchargeCalculator (none / percentage / fixed)' },
          { title: 'PATCH /commands/:id/surcharge + retornar campos no show/index/getByAppointment' },
          { title: 'Total da comanda inclui acréscimo nas respostas da API' },
        ],
      },
      {
        title: '2. LC-FRONT — UI fechar comanda',
        items: [
          { title: 'Estado + UI acréscimo no dialog Fechar Comanda (commands/page.tsx)' },
          { title: 'Recalcular total/restante ao aplicar acréscimo' },
          { title: 'Persistir acréscimo antes do POST /payments' },
        ],
      },
      {
        title: '3. Mobile-web — UI fechar comanda',
        items: [
          { title: 'Paridade com front no modal de pagamento (comandas/page.tsx)' },
          { title: 'Testar fechamento com acréscimo fixo e percentual' },
        ],
      },
    ],
  },
  {
    title: 'Agenda — Fechar comanda completa (LC-FRONT + mobile-web)',
    priority: 'HIGH',
    estimatedHours: 1,
    dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    description: `Permitir **fechar comanda com baixa completa** direto pela **agenda** (LC-FRONT e mobile-web), com **paridade** à página de comandas: métodos de pagamento, descontos por item, acréscimo/juros (quando task anterior estiver pronta) e validação de gaveta.

**Estado atual:** botão "Faturar comanda" na agenda faz **atalho só dinheiro** (\`POST /payments\` com \`cash\` no total). Grade (\`/schedule/grid\`) só exibe comanda + link para \`/financial/commands\`.

**Repos:** \`linkcallendar/front\`, \`linkcallendar/mobile-web\``,
    comments: [
      `## Análise (2026-09-01)

### Onde está hoje
| Tela | Repo | Comportamento |
|------|------|---------------|
| \`/agenda\` | front | \`handleBillCommand\` — cash only, sem desconto/split |
| \`/schedule/grid\` | front | Comanda read-only + "Ver detalhes" → \`/financial/commands?commandId=\` |
| \`/agenda\` | mobile-web | Mesmo atalho cash-only |

### API útil
- \`GET /commands/appointment/:appointment_id\` — comanda do agendamento
- \`POST /payments\` — fechamento canônico (gaveta aberta obrigatória)
- \`PATCH /commands/:id/items/discounts\` — descontos

### Implementação sugerida
1. **Reutilizar** o dialog/modal de "Fechar Comanda" da página de comandas (extrair componente compartilhado ou duplicar fluxo mínimo)
2. **Front:** \`/agenda/page.tsx\` e \`/schedule/grid/page.tsx\` — botão "Fechar comanda" abre fluxo completo
3. **Mobile-web:** \`/agenda/page.tsx\` — idem
4. Tratar erro de gaveta fechada (redirect ou toast igual commands)
5. Após fechar: refetch comanda do agendamento + atualizar status visual

### DoD
- Fechar com split de pagamento (pix, cartão, etc.) pela agenda
- Descontos por item funcionam
- Comportamento idêntico à tela de comandas
- Teste manual: agendamento com comanda aberta → fechar pela agenda → comanda \`closed\``,
    ],
    checklist: [
      {
        title: '1. LC-FRONT — /agenda',
        items: [
          { title: 'Substituir "Faturar comanda" (cash-only) por fluxo completo de fechamento' },
          { title: 'Reutilizar ou extrair dialog de pagamento de financial/commands' },
          { title: 'Refetch comanda após fechamento bem-sucedido' },
        ],
      },
      {
        title: '2. LC-FRONT — /schedule/grid',
        items: [
          { title: 'Botão "Fechar comanda" no painel lateral (hoje só link para commands)' },
          { title: 'Mesmo modal/dialog de pagamento da agenda/comandas' },
        ],
      },
      {
        title: '3. Mobile-web — /agenda',
        items: [
          { title: 'Paridade: modal fechar comanda igual comandas/page.tsx' },
          { title: 'Tratar gaveta fechada e erros de pagamento' },
        ],
      },
      {
        title: '4. Testes',
        items: [
          { title: 'Fechar com 2 métodos de pagamento pela agenda (front)' },
          { title: 'Fechar com desconto em item pela agenda (mobile-web)' },
          { title: 'Validar com gaveta fechada exibe mensagem correta' },
        ],
      },
    ],
  },
]

async function ensureTeamMember(base: string, cookies: string, userId: string) {
  const teamRes = await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/team`)
  if (!teamRes.ok) throw new Error(`list team: ${teamRes.status}`)
  const team = (await teamRes.json()) as Array<{ userId: string }>
  if (team.some((m) => m.userId === userId)) return
  const addRes = await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/team`, {
    method: 'POST',
    body: JSON.stringify({ userId, role: 'MEMBER' }),
  })
  if (!addRes.ok) throw new Error(`add team: ${addRes.status} ${await addRes.text()}`)
  console.log(`+ Fabricio adicionado ao projeto ${PROJECT_NAME}`)
}

async function createChecklist(
  base: string,
  cookies: string,
  taskId: string,
  checklist: TaskDef['checklist']
) {
  for (const groupDef of checklist) {
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
    console.log(`  + ${groupDef.title} (${groupDef.items.length} itens)`)
  }
}

async function upsertTask(
  base: string,
  cookies: string,
  existingTasks: Array<{ id: string; title: string }>,
  def: TaskDef
) {
  let taskId: string
  const found = existingTasks.find((t) => t.title === def.title)

  if (found) {
    taskId = found.id
    console.log(`Task já existe: ${def.title} (${taskId})`)
  } else {
    const taskRes = await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title: def.title,
        description: def.description,
        status: 'TODO',
        priority: def.priority,
        estimatedMinutes: def.estimatedHours * 60,
        assigneeId: ASSIGNEE_ID,
        ...(def.dueDate ? { dueDate: def.dueDate } : {}),
      }),
    })
    if (!taskRes.ok) throw new Error(`create task: ${taskRes.status} ${await taskRes.text()}`)
    const task = (await taskRes.json()) as { id: string }
    taskId = task.id
    console.log(`+ Task criada: ${def.title} (${taskId})`)
  }

  await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify({
      description: def.description,
      priority: def.priority,
      assigneeId: ASSIGNEE_ID,
    }),
  })

  const patchBody: Record<string, unknown> = { estimatedMinutes: def.estimatedHours * 60 }
  if (def.dueDate) patchBody.dueDate = def.dueDate

  const estimateRes = await pmApi(base, cookies, `/api/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(patchBody),
  })
  if (!estimateRes.ok) {
    throw new Error(`patch estimate: ${estimateRes.status} ${await estimateRes.text()}`)
  }
  console.log(`  → Responsável: ${ASSIGNEE_NAME} · Estimativa: ${def.estimatedHours}h`)

  const shareRes = await pmApi(base, cookies, `/api/tasks/${taskId}/share`, {
    method: 'POST',
    body: JSON.stringify({ action: 'enable' }),
  })
  if (!shareRes.ok) throw new Error(`enable share: ${shareRes.status} ${await shareRes.text()}`)
  const share = (await shareRes.json()) as { shareUrl: string; shareToken: string }

  const portalRes = await fetch(`${base}/api/task-portal/${share.shareToken}`)
  const portal = (await portalRes.json()) as { checklist?: { groups?: unknown[] } }

  if ((portal.checklist?.groups?.length ?? 0) === 0) {
    console.log('  Checklist:')
    await createChecklist(base, cookies, taskId, def.checklist)
  } else {
    console.log('  Checklist já existe — skip')
  }

  for (const content of def.comments) {
    const prefix = content.slice(0, 35)
    const commentsRes = await pmApi(base, cookies, `/api/tasks/${taskId}/comments`)
    const existingComments = commentsRes.ok
      ? ((await commentsRes.json()) as Array<{ content: string }>)
      : []
    if (existingComments.some((c) => c.content.startsWith(prefix))) continue
    const res = await pmApi(base, cookies, `/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
    if (!res.ok) throw new Error(`comment: ${res.status} ${await res.text()}`)
    console.log('  + comentário')
  }

  const descWithPortal = `${def.description}\n\n**Task portal:** ${share.shareUrl}\n\n**Responsável:** ${ASSIGNEE_NAME}`
  await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify({ description: descWithPortal }),
  })

  return { taskId, title: def.title, shareUrl: share.shareUrl, shareToken: share.shareToken, assignee: ASSIGNEE_NAME }
}

async function main() {
  const { base, cookies } = await pmSession()
  console.log(`PM: ${base} · Projeto: ${PROJECT_NAME} (${PROJECT_ID})\n`)

  await ensureTeamMember(base, cookies, ASSIGNEE_ID)

  const listRes = await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks`)
  if (!listRes.ok) throw new Error(`list tasks: ${listRes.status} ${await listRes.text()}`)
  const tasks = (await listRes.json()) as Array<{ id: string; title: string }>

  const results = []
  for (const def of TASKS) {
    console.log(`\n--- ${def.title} ---`)
    const result = await upsertTask(base, cookies, tasks, def)
    results.push(result)
  }

  console.log('\n=== Resumo ===')
  console.log(JSON.stringify({ projectId: PROJECT_ID, assignee: ASSIGNEE_NAME, tasks: results }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

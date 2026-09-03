/**
 * Cria tasks de evolução Assinaturas (Link Callendar) no PM.
 *
 * Uso:
 *   cd /Users/gabrielferreira/Desktop/projects
 *   npx tsx scripts/create-link-calendar-assinaturas-tasks-via-api.ts
 */
import { config } from 'dotenv'
import { pmApi, pmSession } from './lib/pm-api-client'

config({ path: '.env.local' })
config()

const PROJECT_ID = 'cmnhenfhr002tp4202x1aw096'
const PROJECT_NAME = 'Link Callendar'

type TaskDef = {
  title: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  estimatedHours: number
  description: string
  comments: string[]
  checklist: Array<{ title: string; items: Array<{ title: string; description?: string }> }>
}

const TASKS: TaskDef[] = [
  {
    title: 'Back — Planos e assinaturas (base)',
    priority: 'HIGH',
    estimatedHours: 8,
    description: `Fundação API para evolução de assinaturas de clientes no Link Callendar.

**Escopo:** sessões ilimitadas, vigência indeterminada, remaining_sessions na criação manual, API calendário de vencimentos.

**Repos:** \`linkcallendar/back\`

**Refs:** \`plansController\`, \`subscriptionsController\`, migrations \`plans\` / \`subscriptions\`.`,
    comments: [
      `## Contexto técnico

Hoje \`plans.sessions_limit = null\` já significa ilimitado no schema, mas **front/mobile não expõem toggle**. Assinatura manual via mobile-web **não envia \`remaining_sessions\`**, então agenda não consome sessões (\`remaining_sessions > 0\`).

**Vigência indeterminada:** usar \`end_date = null\` + flag opcional \`is_indefinite\` (migration) ou convenção documentada.

**Calendário cobranças:** endpoint \`GET /subscriptions/billing-calendar?from=&to=\` filtrando \`next_billing_date\` + status active.`,
      `## DoD

- Toggle ilimitado persiste \`sessions_limit: null\`
- POST /subscriptions calcula \`remaining_sessions\` quando limitado (paridade front)
- Assinatura indeterminada aceita \`end_date\` null
- Endpoint calendário vencimentos documentado em Módulos e rotas`,
    ],
    checklist: [
      {
        title: '1. Plano — sessões ilimitadas',
        items: [
          { title: 'Validar/create/update plans com sessions_limit null = ilimitado' },
          { title: 'Documentar contrato API no vault (Módulos e rotas)' },
        ],
      },
      {
        title: '2. Assinatura — vigência e sessões',
        items: [
          {
            title: 'Migration opcional is_indefinite ou convenção end_date null',
            description: 'decidir com front/mobile',
          },
          {
            title: 'POST /subscriptions — calcular remaining_sessions',
            description: 'sessions_limit ou sessions_per_week * 4 * meses; null = null (ilimitado)',
          },
          { title: 'PUT /subscriptions — permitir end_date null (indeterminado)' },
        ],
      },
      {
        title: '3. Calendário vencimentos',
        items: [
          {
            title: 'GET /subscriptions/billing-calendar',
            description: 'range de datas, next_billing_date, cliente, plano, valor',
          },
          { title: 'Testes manuais ou seed de assinaturas com next_billing_date' },
        ],
      },
    ],
  },
  {
    title: 'Front + Mobile-web — Planos e criar assinatura',
    priority: 'HIGH',
    estimatedHours: 10,
    description: `UI admin: toggle sessões ilimitadas no plano; criar assinatura com vigência indeterminada; paridade remaining_sessions.

**Repos:** \`linkcallendar/front\`, \`linkcallendar/mobile-web\`

**Telas:** \`/clients/plans\`, \`/assinaturas/planos\`, modal Nova Assinatura.`,
    comments: [
      `## Gap atual (mobile-web)

Modal "Nova Assinatura" em \`app/assinaturas/planos/page.tsx\` não envia \`remaining_sessions\`. Front já calcula em \`clients/plans/page.tsx\`.

**Toggle ilimitado:** Switch "Sessões ilimitadas" → não enviar sessions_limit ou enviar null.

**Indeterminado:** Switch "Sem data de término" → end_date undefined/null.`,
      `## DoD

- front e mobile-web com mesmos campos de plano e assinatura
- Assinatura manual funciona consumo na agenda (remaining_sessions > 0)
- UX clara: ilimitado vs N sessões; indeterminado vs data fim`,
    ],
    checklist: [
      {
        title: '1. CRUD Plano',
        items: [
          { title: 'Switch "Sessões ilimitadas" (front + mobile-web)' },
          { title: 'Desabilitar sessions_limit / sessions_per_week quando ilimitado' },
          { title: 'Preview no card do plano ("Ilimitado" vs "X sessões")' },
        ],
      },
      {
        title: '2. Nova assinatura',
        items: [
          { title: 'Switch "Vigência indeterminada" (sem end_date)' },
          {
            title: 'Enviar remaining_sessions no POST /subscriptions (mobile-web)',
            description: 'copiar lógica do front',
          },
          { title: 'Toggle pagamento confirmado (já existe mobile)' },
        ],
      },
      {
        title: '3. Homologação',
        items: [
          { title: 'Criar plano ilimitado + assinatura indeterminada em sandbox' },
          { title: 'Validar listagem em /assinaturas e /clients/signatures' },
        ],
      },
    ],
  },
  {
    title: 'Front + Mobile-web — Calendário vencimentos cobrança',
    priority: 'MEDIUM',
    estimatedHours: 6,
    description: `Agenda/calendário de vencimentos de cobrança de assinaturas de clientes (\`next_billing_date\`).

**Repos:** front, mobile-web (+ back task base).

**Sugestão rota:** nova página ou aba em Assinaturas.`,
    comments: [
      `## UX sugerida

- Vista mês/semana com chips: cliente, plano, valor, status pagamento
- Filtro: active / overdue payment_status
- Link rápido para editar assinatura ou abrir cliente

Consome \`GET /subscriptions/billing-calendar\` (task Back).`,
    ],
    checklist: [
      {
        title: '1. UI calendário',
        items: [
          { title: 'Componente calendário mensal (front + mobile-web)' },
          { title: 'Integrar API billing-calendar' },
          { title: 'Empty state quando sem vencimentos no período' },
        ],
      },
      {
        title: '2. Ações',
        items: [
          { title: 'Clique no dia → lista assinaturas a vencer' },
          { title: 'Atalho marcar payment_status / reagendar next_billing_date' },
        ],
      },
    ],
  },
  {
    title: 'Front + Mobile-web — Agenda badge assinante + faturar comanda',
    priority: 'HIGH',
    estimatedHours: 12,
    description: `Na agenda admin: badge "Assinante" quando cliente tem assinatura active; faturar comanda direto do agendamento.

**Repos:** \`front/app/agenda\`, \`mobile-web/app/agenda\`, possivelmente comandas API.`,
    comments: [
      `## Badge assinante

Ao listar agendamentos, se \`client_id\` tem subscription active (cache ou \`GET /subscriptions/client/:id\`):

- Badge visual no card/linha (front + mobile-web)
- Opcional: prefetch map clientId → hasActiveSubscription no load do dia

## Faturar comanda pela agenda

Fluxo: agendamento completed → abrir/criar comanda pré-preenchida (cliente, serviços, professional, subscription_id).

Ver integração \`comandas\` + \`appointmentsController\` (já vincula subscription_id ao completar).`,
      `## DoD

- Badge visível em ambos apps na grade e lista
- Ação "Faturar comanda" cria ou abre comanda ligada ao appointment
- Assinante identificado sem abrir ficha do cliente`,
    ],
    checklist: [
      {
        title: '1. Badge assinante',
        items: [
          { title: 'Helper hasActiveSubscription(clientId) + cache por página' },
          { title: 'Badge UI grade mobile-web (agenda/page.tsx)' },
          { title: 'Badge UI grade front' },
        ],
      },
      {
        title: '2. Faturar comanda',
        items: [
          { title: 'Mapear endpoint criar comanda a partir de appointment_id' },
          { title: 'Botão/ação na modal ou card do agendamento' },
          { title: 'Pré-preencher serviços e subscription_id se aplicável' },
        ],
      },
      {
        title: '3. Testes',
        items: [
          { title: 'Cliente assinante + não assinante na mesma grade' },
          { title: 'Comanda reflete desconto/sessão assinatura quando linked' },
        ],
      },
    ],
  },
  {
    title: 'Agenda — Home assinante (serviços e sessões restantes)',
    priority: 'HIGH',
    estimatedHours: 10,
    description: `App cliente (agenda / agenda-v2): após login com assinatura active, home mostra serviços do plano e sessões restantes (global e por serviço se aplicável).

**Repos:** \`agenda\`, \`agenda-v2/apps/web\`

**Login já retorna subscription** em \`POST /sessions/clients\`.`,
    comments: [
      `## Estado atual

- **agenda legado:** login guarda subscription no localStorage; home não exibe breakdown por serviço
- **agenda-v2:** plans-tab read-only; sem home assinante

## Dados necessários

\`GET /subscriptions/client/:id\` ou enriquecer login com plan.services + remaining_sessions.

**Decisão produto:** sessões são globais hoje (\`remaining_sessions\` único). Se precisar "por serviço", task Back adicional.`,
      `## DoD

- Home principal (logado + assinatura active) lista serviços inclusos
- Exibe "X sessões restantes" (ou "Ilimitado")
- CTA agendar serviço incluso`,
    ],
    checklist: [
      {
        title: '1. API / dados',
        items: [
          { title: 'Confirmar payload login ou fetch subscription detail pós-login' },
          { title: 'Tratar plan.sessions_limit null → UI "Ilimitado"' },
        ],
      },
      {
        title: '2. UI Home (agenda-v2 prioritário)',
        items: [
          { title: 'Bloco "Sua assinatura" na home autenticada' },
          { title: 'Lista serviços do plano com contador restante' },
          { title: 'Espelhar ou deprecar fluxo no agenda legado' },
        ],
      },
    ],
  },
  {
    title: 'Agenda — Aba Assinaturas (detalhes completos)',
    priority: 'MEDIUM',
    estimatedHours: 6,
    description: `Aba Assinaturas no app cliente: status, plano, serviços, datas, sessões restantes, histórico de uso.

**Repos:** agenda-v2 (nova tab ou expandir plans-tab-screen).`,
    comments: [
      `## Conteúdo da aba

- Nome do plano, preço, status (active/pending/canceled)
- start_date, end_date ou "Indeterminado"
- next_billing_date
- Serviços inclusos
- remaining_sessions / ilimitado
- Opcional: últimos agendamentos com subscription_id

Fonte: \`GET /subscriptions/client/:client_id\` (já existe no back).`,
    ],
    checklist: [
      {
        title: '1. Tela detalhes',
        items: [
          { title: 'Fetch GET /subscriptions/client/:id no mount da aba' },
          { title: 'Layout cards: plano, vigência, pagamento, sessões' },
          { title: 'Lista serviços do plan.services' },
        ],
      },
      {
        title: '2. Estados',
        items: [
          { title: 'Sem assinatura → CTA ver planos disponíveis' },
          { title: 'Múltiplas assinaturas → seletor ou lista' },
          { title: 'agenda-v2 navigation tab Assinaturas' },
        ],
      },
    ],
  },
]

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
  existingTitles: Set<string>,
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
      estimatedMinutes: def.estimatedHours * 60,
    }),
  })

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

  const descWithPortal = `${def.description}\n\n**Task portal:** ${share.shareUrl}`
  await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify({ description: descWithPortal }),
  })

  return { taskId, title: def.title, shareUrl: share.shareUrl, shareToken: share.shareToken }
}

async function main() {
  const { base, cookies } = await pmSession()
  console.log(`PM: ${base} · Projeto: ${PROJECT_NAME} (${PROJECT_ID})\n`)

  const listRes = await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks`)
  if (!listRes.ok) throw new Error(`list tasks: ${listRes.status} ${await listRes.text()}`)
  const tasks = (await listRes.json()) as Array<{ id: string; title: string }>

  const results = []
  for (const def of TASKS) {
    console.log(`\n--- ${def.title} ---`)
    const result = await upsertTask(base, cookies, new Set(tasks.map((t) => t.title)), tasks, def)
    results.push(result)
  }

  console.log('\n=== Resumo ===')
  console.log(JSON.stringify({ projectId: PROJECT_ID, projectName: PROJECT_NAME, tasks: results }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

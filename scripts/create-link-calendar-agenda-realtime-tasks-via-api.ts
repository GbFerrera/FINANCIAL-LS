/**
 * Cria tasks — Agenda tempo real (WSS/Socket.IO) no PM — Link Callendar.
 *
 * Uso:
 *   cd /Users/gabrielferreira/Desktop/projects
 *   npx tsx scripts/create-link-calendar-agenda-realtime-tasks-via-api.ts
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
  description: string
  comments: string[]
  checklist: Array<{ title: string; items: Array<{ title: string; description?: string }> }>
}

const TASKS: TaskDef[] = [
  {
    title: 'Back — Socket.IO eventos da agenda (tempo real)',
    priority: 'HIGH',
    estimatedHours: 1,
    description: `Expandir eventos Socket.IO para sincronizar a agenda admin em tempo real.

**Estado atual:** só \`appointments:new\` no \`POST /appointments\` (\`appointmentsController.create\`). Update, cancel, delete e reagendamento **não emitem**.

**Repo:** \`linkcallendar/back\`

**Sala:** \`company:{company_id}\` (handshake query \`company_id\`).`,
    comments: [
      `## Análise (2026-09-01)

- Server: \`back/src/server.js\` — Socket.IO path \`/socket.io\`
- Único emit: \`io.to(\\\`company:\${company_id}\\\`).emit('appointments:new', payload)\`
- Payload hoje: \`{ appointment, client, professional, services }\`
- Agendamentos via IA / reschedule não passam pelo emit

## Eventos sugeridos

| Evento | Quando |
|--------|--------|
| \`appointments:new\` | Criação (já existe — garantir todos os fluxos) |
| \`appointments:updated\` | PUT /appointments/:id, PATCH status |
| \`appointments:deleted\` | DELETE /appointments/:id |
| \`appointments:rescheduled\` | POST reschedule (opcional: emitir new + updated) |

## DoD

- Todos os fluxos de criação emitem \`appointments:new\`
- Update/cancel/delete emitem evento correspondente
- Documentar contrato de payload no vault (\`Módulos e rotas\` ou \`Arquitetura\`)`,
    ],
    checklist: [
      {
        title: '1. Mapear fluxos de agendamento',
        items: [
          { title: 'Auditar create, update, updateStatus, delete, reschedule, IA' },
          { title: 'Extrair helper emitAppointmentEvent(io, company_id, event, payload)' },
        ],
      },
      {
        title: '2. Implementar emits',
        items: [
          { title: 'Garantir appointments:new em todos os creates' },
          { title: 'Emit appointments:updated no PUT e PATCH status' },
          { title: 'Emit appointments:deleted no DELETE' },
        ],
      },
      {
        title: '3. Homologação',
        items: [
          { title: 'Testar socket client (wscat ou script) na sala company:{id}' },
          { title: 'Documentar eventos no link-brain' },
        ],
      },
    ],
  },
  {
    title: 'Front — Agenda admin tempo real (WSS)',
    priority: 'HIGH',
    estimatedHours: 1.5,
    description: `Conectar páginas de agenda ao Socket.IO para refetch automático ao receber eventos.

**Estado atual:** \`client-layout.tsx\` escuta \`appointments:new\` só para sino/som. \`/schedule/grid\` e \`/agenda\` usam REST puro.

**Repo:** \`linkcallendar/front\``,
    comments: [
      `## Gap

Socket conectado globalmente mas **não atualiza a grade**. Refetch só após ação local, troca de data ou botão refresh.

## Implementação sugerida

1. Hook \`useAppointmentRealtime\` ou contexto compartilhado (reutilizar socket do layout ou singleton)
2. Escutar \`appointments:new\`, \`appointments:updated\`, \`appointments:deleted\`
3. Filtrar por \`appointment_date\` + \`professional_id\` visíveis na tela antes de refetch
4. Chamar \`fetchAllAppointments()\` / \`forceRefresh()\` existentes

## Telas

- \`/schedule/grid\` (principal)
- \`/agenda\` (alternativa)

## WSS prod

\`NEXT_PUBLIC_SOCKET_URL\` ou HTTPS em \`NEXT_PUBLIC_API_URL\` → wss automático.`,
    ],
    checklist: [
      {
        title: '1. Infra socket',
        items: [
          { title: 'Criar hook/context useAppointmentRealtime (eventos + callback)' },
          { title: 'Expor socket do client-layout ou conectar uma vez por app' },
          { title: 'Documentar env NEXT_PUBLIC_SOCKET_URL no .env.example' },
        ],
      },
      {
        title: '2. Integrar agenda',
        items: [
          { title: 'Wire /schedule/grid — refetch no evento relevante' },
          { title: 'Wire /agenda — refetch no evento relevante' },
          { title: 'Debounce refetch (ex. 300ms) se múltiplos eventos' },
        ],
      },
      {
        title: '3. Testes',
        items: [
          { title: 'Dois browsers mesma empresa — criar agendamento em um, ver grade atualizar no outro' },
          { title: 'Validar cancelamento/update reflete após task Back' },
        ],
      },
    ],
  },
  {
    title: 'Mobile-web — Agenda admin tempo real (WSS)',
    priority: 'HIGH',
    estimatedHours: 1.5,
    description: `Paridade com front: agenda PWA atualiza via Socket.IO.

**Estado atual:** \`client-layout.tsx\` → notificação push/toast em \`appointments:new\`. \`/agenda\` e \`/agenda/grade\` REST only.

**Repo:** \`linkcallendar/mobile-web\``,
    comments: [
      `## Gap

Mesmo padrão do front: WSS conectado, grade não escuta.

**Filtro profissional:** layout já ignora eventos de outro \`professional_id\` nas notificações — replicar na lógica de refetch se usuário for profissional.

## Telas

- \`/agenda\`
- \`/agenda/grade\`

## DoD

- Nova refetch automática nas duas telas
- Notificação + grade sincronizados
- Teste PWA no celular (mesma Wi-Fi / prod)`,
    ],
    checklist: [
      {
        title: '1. Infra socket',
        items: [
          { title: 'Hook/context useAppointmentRealtime (copiar/adaptar do front)' },
          { title: 'Manter filtro professional_id para role profissional' },
        ],
      },
      {
        title: '2. Integrar agenda',
        items: [
          { title: 'Wire /agenda/page.tsx — fetchAppointments on event' },
          { title: 'Wire /agenda/grade/page.tsx — fetchAllAppointments on event' },
        ],
      },
      {
        title: '3. Testes',
        items: [
          { title: 'Criar agendamento no painel desktop → grade mobile atualiza' },
          { title: 'Profissional só vê refetch dos próprios horários' },
        ],
      },
    ],
  },
]

async function ensureTeamMember(base: string, cookies: string, userId: string) {
  const teamRes = await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/team`)
  if (!teamRes.ok) throw new Error(`list team: ${teamRes.status}`)
  const team = (await teamRes.json()) as Array<{ userId: string }>
  if (team.some((m) => m.userId === userId)) {
    console.log(`Fabricio já está no projeto ${PROJECT_NAME}`)
    return
  }
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

  const estimateRes = await pmApi(base, cookies, `/api/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ estimatedMinutes: def.estimatedHours * 60 }),
  })
  if (!estimateRes.ok) {
    throw new Error(`patch estimate: ${estimateRes.status} ${await estimateRes.text()}`)
  }
  console.log(`  → Responsável: ${ASSIGNEE_NAME}`)

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
  console.log(
    JSON.stringify(
      { projectId: PROJECT_ID, projectName: PROJECT_NAME, assignee: ASSIGNEE_NAME, tasks: results },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

#!/usr/bin/env node
/**
 * Marca itens do checklist, atualiza status e adiciona comentário no PM.
 *
 * Uso:
 *   node scripts/pm-task-progress.js <shareToken> <itemId> [itemId...] \
 *     [--status IN_PROGRESS|IN_REVIEW|TODO|COMPLETED] \
 *     [--comment "texto"] \
 *     [--project-id xxx] [--task-id xxx]
 *
 * Status workflow (Link System):
 *   IN_PROGRESS = Em Andamento (ao iniciar dev)
 *   IN_REVIEW   = Testar (dev concluído, falta validação manual)
 *   COMPLETED   = só quando usuário confirmar
 */
const token = process.argv[2]
const args = process.argv.slice(3)

function readFlag(name) {
  const idx = args.indexOf(name)
  if (idx < 0) return null
  return args[idx + 1] ?? null
}

function readRestAfter(name) {
  const idx = args.indexOf(name)
  if (idx < 0) return null
  return args.slice(idx + 1).join(' ').replace(/^"|"$/g, '')
}

const statusIdx = args.indexOf('--status')
const commentIdx = args.indexOf('--comment')
const projectId = readFlag('--project-id')
const taskIdFlag = readFlag('--task-id')

const status = statusIdx >= 0 ? args[statusIdx + 1] : null
const comment = commentIdx >= 0 ? readRestAfter('--comment') : null

const itemEnd = Math.min(
  ...[statusIdx, commentIdx, args.indexOf('--project-id'), args.indexOf('--task-id')].filter((i) => i >= 0),
  args.length
)
const itemIds = args.slice(0, itemEnd === args.length ? undefined : itemEnd).filter(Boolean)

if (!token) {
  console.error(
    'Uso: node pm-task-progress.js <shareToken> [itemId...] [--status IN_PROGRESS] [--comment "texto"]'
  )
  process.exit(1)
}

const base = 'https://projects.linksystem.tech'
const VALID_STATUS = new Set(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED'])

async function toggleItem(itemId) {
  const res = await fetch(`${base}/api/task-portal/${token}/checklist`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'toggle_item', itemId, done: true }),
  })
  if (!res.ok) throw new Error(`toggle ${itemId}: ${res.status} ${await res.text()}`)
  console.log(`✓ check ${itemId}`)
}

async function getPortal() {
  const res = await fetch(`${base}/api/task-portal/${token}`)
  if (!res.ok) throw new Error(`portal: ${res.status}`)
  return res.json()
}

async function loginPm() {
  const email = process.env.PM_EMAIL
  const password = process.env.PM_PASSWORD
  if (!email || !password) throw new Error('Defina PM_EMAIL e PM_PASSWORD para status/comentário autenticado')

  const jar = {}
  const cookieHeader = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')

  const csrfRes = await fetch(`${base}/api/auth/csrf`)
  const csrfJson = await csrfRes.json()
  for (const h of csrfRes.headers.getSetCookie?.() ?? []) {
    const part = h.split(';')[0]
    const eq = part.indexOf('=')
    if (eq > 0) jar[part.slice(0, eq)] = part.slice(eq + 1)
  }

  const signInRes = await fetch(`${base}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader() },
    body: new URLSearchParams({
      csrfToken: csrfJson.csrfToken,
      email,
      password,
      redirect: 'false',
      json: 'true',
    }),
    redirect: 'manual',
  })
  for (const h of signInRes.headers.getSetCookie?.() ?? []) {
    const part = h.split(';')[0]
    const eq = part.indexOf('=')
    if (eq > 0) jar[part.slice(0, eq)] = part.slice(eq + 1)
  }

  return cookieHeader()
}

async function updateStatus(cookies, taskId, projectIdResolved, newStatus) {
  if (!VALID_STATUS.has(newStatus)) throw new Error(`Status inválido: ${newStatus}`)
  const res = await fetch(`${base}/api/projects/${projectIdResolved}/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ status: newStatus }),
  })
  if (!res.ok) throw new Error(`status ${newStatus}: ${res.status} ${await res.text()}`)
  console.log(`✓ status → ${newStatus}`)
}

async function addComment(cookies, taskId, content) {
  const res = await fetch(`${base}/api/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) throw new Error(`comment: ${res.status} ${await res.text()}`)
  console.log('✓ comentário adicionado')
}

async function main() {
  for (const id of itemIds) {
    await toggleItem(id)
  }

  const portal = await getPortal()
  const taskId = taskIdFlag || portal.task?.id
  const projectIdResolved = projectId || portal.task?.project?.id

  if (status || comment) {
    const cookies = await loginPm()
    if (status) await updateStatus(cookies, taskId, projectIdResolved, status)
    if (comment) await addComment(cookies, taskId, comment)
  }

  const updated = await getPortal()
  console.log(`Progresso: ${updated.checklist?.progress?.done}/${updated.checklist?.progress?.total}`)
  if (updated.task?.status) console.log(`Status task: ${updated.task.status}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

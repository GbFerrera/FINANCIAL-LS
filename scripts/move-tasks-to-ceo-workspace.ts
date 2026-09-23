/**
 * Move tasks Esteira A → workspace CEO via API (requer deploy do PATCH projectId).
 *
 * Preferível sem deploy: npx tsx scripts/move-tasks-to-ceo-workspace-prisma.ts
 * (com PROD_DATABASE_URL no .env.local — Coolify → projects → DATABASE_URL)
 */
import { config } from 'dotenv'
import { loginPm, pmApi, pmBase, requirePmCredentials } from './lib/pm-api-client'

config({ path: '.env.local' })
config()

type WorkspaceDetail = {
  id: string
  name: string
  slug: string
  kind?: string
  settings?: { internalProjectId?: string } | null
  projectIds?: string[]
  projects?: Array<{ project: { id: string; name: string } }>
}

type TaskRow = {
  id: string
  title: string
  projectId?: string
  project?: { id: string; name: string }
  labels?: { id: string; name: string }[]
  linkedProjects?: Array<{ project: { id: string; name: string } }>
}

async function fetchWorkspace(base: string, cookies: string, slug: string): Promise<WorkspaceDetail> {
  const res = await pmApi(base, cookies, `/api/workspaces/${encodeURIComponent(slug)}`)
  if (!res.ok) throw new Error(`workspace ${slug}: ${res.status}`)
  return res.json()
}

function resolveTargetProjectId(ws: WorkspaceDetail): string | null {
  const internal = ws.settings?.internalProjectId
  if (internal) return internal
  const gestao = (ws.projects || []).find((p) =>
    p.project.name.toLowerCase().includes('[gestão]') || p.project.name.toLowerCase().includes('[gestao]')
  )
  return gestao?.project.id ?? ws.projectIds?.[0] ?? null
}

async function main() {
  const base = pmBase()
  const { email, password } = requirePmCredentials()
  const cookies = await loginPm(base, email, password)

  const session = (await (await pmApi(base, cookies, '/api/auth/session')).json()) as {
    user?: { id: string; name?: string; email?: string }
  }
  const userId = session.user?.id
  if (!userId) throw new Error('Sessão sem user id')

  const sourceSlug = (process.env.SOURCE_WORKSPACE_SLUG || 'esteira-a').trim()
  const targetSlug = (process.env.TARGET_WORKSPACE_SLUG || 'ceo').trim()

  const source = await fetchWorkspace(base, cookies, sourceSlug)
  const target = await fetchWorkspace(base, cookies, targetSlug)
  const targetProjectId = resolveTargetProjectId(target)

  if (!targetProjectId) {
    throw new Error(`Workspace "${target.name}" sem projeto interno de gestão`)
  }

  const sourceProjectIds = source.projectIds || []
  console.log(`Origem: ${source.name} (${source.slug}) — ${sourceProjectIds.length} projetos`)
  console.log(`Destino: ${target.name} (${target.slug}) — projeto ${targetProjectId}`)
  console.log(`Usuário: ${session.user?.name || session.user?.email}`)

  const tasksRes = await pmApi(
    base,
    cookies,
    `/api/tasks?projectIds=${sourceProjectIds.join(',')}&assigneeIds=${userId}`
  )
  if (!tasksRes.ok) throw new Error(`tasks: ${tasksRes.status}`)
  const { tasks = [] } = (await tasksRes.json()) as { tasks?: TaskRow[] }

  console.log(`Tasks atribuídas a você na origem: ${tasks.length}`)

  const labelsRes = await pmApi(base, cookies, `/api/task-labels?workspaceId=${encodeURIComponent(source.id)}`)
  const { labels = [] } = (await labelsRes.json()) as { labels?: { id: string; name: string }[] }
  const ceoLabel = labels.find((l) => l.name.toLowerCase() === 'ceo')

  let moved = 0
  let labelsRemoved = 0

  for (const task of tasks) {
    const currentLabelIds = (task.labels || []).map((l) => l.id)
    const withoutCeo = ceoLabel
      ? currentLabelIds.filter((id) => id !== ceoLabel.id)
      : currentLabelIds

    const alreadyInTarget =
      task.projectId === targetProjectId ||
      task.project?.id === targetProjectId ||
      (task.linkedProjects || []).some((lp) => lp.project.id === targetProjectId)

    const patch: Record<string, unknown> = {}

    if (ceoLabel && currentLabelIds.includes(ceoLabel.id)) {
      patch.labelIds = withoutCeo
    }

    if (!alreadyInTarget) {
      patch.projectId = targetProjectId
      const existingLinks = (task.linkedProjects || [])
        .map((lp) => lp.project.id)
        .filter((id) => id !== task.projectId && id !== targetProjectId)
      patch.linkedProjectIds = existingLinks
    }

    if (Object.keys(patch).length === 0) {
      console.log(`= ${task.title} (já ok)`)
      continue
    }

    const patchRes = await pmApi(base, cookies, `/api/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })

    if (!patchRes.ok) {
      const err = await patchRes.json().catch(() => ({}))
      console.error(`Falha "${task.title}":`, err)
      continue
    }

    const updated = (await patchRes.json()) as TaskRow
    const movedOk = updated.project?.id === targetProjectId
    if (patch.projectId && movedOk) moved++
    if (patch.labelIds) labelsRemoved++
    if (patch.projectId && !movedOk) {
      console.error(
        `⚠ ${task.title}: API não moveu (ainda em ${updated.project?.name}). Faça deploy da correção projectId e rode de novo.`
      )
      continue
    }
    console.log(
      `✓ ${task.title} → ${updated.project?.name || targetProjectId}${
        patch.labelIds ? ' (etiqueta CEO removida)' : ''
      }`
    )
  }

  console.log(`Concluído: ${moved} movida(s), ${labelsRemoved} com etiqueta CEO removida.`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})

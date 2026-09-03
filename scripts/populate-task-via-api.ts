/**
 * Popula checklist, comentários e descrição de uma task existente no PM.
 *
 * Uso:
 *   PM_EMAIL=... PM_PASSWORD=... TASK_ID=... npx tsx scripts/populate-task-via-api.ts
 *   PM_EMAIL=... PM_PASSWORD=... SHARE_TOKEN=... PROJECT_NAME="Link Foo" npx tsx scripts/populate-task-via-api.ts
 */
import {
  defaultBootstrapChecklist,
  defaultBootstrapComments,
  defaultTaskDescription,
} from './lib/bootstrap-checklist'
import { pmApi, pmSession } from './lib/pm-api-client'

type ChecklistGroup = { title: string; items: Array<{ title: string; description?: string }> }

async function createChecklist(
  base: string,
  cookies: string,
  taskId: string,
  checklist: ChecklistGroup[]
) {
  for (const groupDef of checklist) {
    const groupRes = await pmApi(base, cookies, `/api/tasks/${taskId}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ action: 'create_group', title: groupDef.title }),
    })
    if (!groupRes.ok) {
      throw new Error(`create_group: ${groupRes.status} ${await groupRes.text()}`)
    }
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
      if (!itemRes.ok) {
        throw new Error(`create_item: ${itemRes.status} ${await itemRes.text()}`)
      }
    }
    console.log(`+ ${groupDef.title} (${groupDef.items.length} itens)`)
  }
}

async function main() {
  const taskId = process.env.TASK_ID
  const shareToken = process.env.SHARE_TOKEN
  const projectName = process.env.PROJECT_NAME || 'Projeto'
  const projectId = process.env.PROJECT_ID
  const baseRepo = process.env.BASE_REPO || 'FINANCIAL-LS'

  const { base, cookies } = await pmSession()

  let resolvedTaskId = taskId
  let resolvedProjectId = projectId
  let shareUrl = shareToken ? `${base}/task-portal/${shareToken}` : ''

  if (shareToken && !resolvedTaskId) {
    const portalRes = await fetch(`${base}/api/task-portal/${shareToken}`)
    const portal = (await portalRes.json()) as {
      task?: { id: string; description?: string; project?: { id: string } }
      checklist?: { groups?: unknown[] }
    }
    if (!portal.task?.id) throw new Error('Task não encontrada pelo SHARE_TOKEN')
    resolvedTaskId = portal.task.id
    resolvedProjectId = portal.task.project?.id
    if ((portal.checklist?.groups?.length ?? 0) > 0) {
      console.log('Checklist já existe — use FORCE=1 para recriar (não implementado; delete manual)')
      process.exit(0)
    }
  }

  if (!resolvedTaskId) throw new Error('Defina TASK_ID ou SHARE_TOKEN')
  if (!resolvedProjectId) throw new Error('Defina PROJECT_ID ou use SHARE_TOKEN')

  const checklist = defaultBootstrapChecklist(projectName, baseRepo)
  await createChecklist(base, cookies, resolvedTaskId, checklist)

  const comments = defaultBootstrapComments(projectName, resolvedProjectId, shareUrl || `${base}/task-portal/...`)
  for (const content of comments) {
    const res = await pmApi(base, cookies, `/api/tasks/${resolvedTaskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
    if (!res.ok) throw new Error(`comment: ${res.status} ${await res.text()}`)
    console.log('+ comentário')
  }

  const description = defaultTaskDescription(projectName, shareUrl || `${base}/task-portal/...`)
  const taskRes = await pmApi(base, cookies, `/api/projects/${resolvedProjectId}/tasks/${resolvedTaskId}`, {
    method: 'PUT',
    body: JSON.stringify({ description }),
  })
  if (!taskRes.ok) {
    console.warn(`PUT descrição: ${taskRes.status}`)
  } else {
    console.log('Descrição atualizada')
  }

  console.log('Done.', resolvedTaskId)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

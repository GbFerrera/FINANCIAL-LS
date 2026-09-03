/**
 * Bootstrap completo: projeto + task "Iniciar projeto" + share + checklist + comentários.
 *
 * Uso:
 *   PM_EMAIL=... PM_PASSWORD=... PROJECT_NAME="Link Foo" CLIENT_ID=... \
 *     npx tsx scripts/bootstrap-project-via-api.ts
 *
 * Cliente Link System (padrão produtos próprios): cmlri2e1b0004qu3itu4njpo9
 */
import {
  defaultBootstrapChecklist,
  defaultBootstrapComments,
  defaultTaskDescription,
} from './lib/bootstrap-checklist'
import { pmApi, pmSession } from './lib/pm-api-client'

const LINK_SYSTEM_CLIENT_ID = 'cmlri2e1b0004qu3itu4njpo9'

async function createChecklist(
  base: string,
  cookies: string,
  taskId: string,
  checklist: ReturnType<typeof defaultBootstrapChecklist>
) {
  for (const groupDef of checklist) {
    const groupRes = await pmApi(base, cookies, `/api/tasks/${taskId}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ action: 'create_group', title: groupDef.title }),
    })
    if (!groupRes.ok) throw new Error(`create_group: ${await groupRes.text()}`)
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
      if (!itemRes.ok) throw new Error(`create_item: ${await itemRes.text()}`)
    }
  }
}

async function main() {
  const projectName = process.env.PROJECT_NAME
  if (!projectName) throw new Error('Defina PROJECT_NAME')

  const clientId = process.env.CLIENT_ID || LINK_SYSTEM_CLIENT_ID
  const status = process.env.PROJECT_STATUS || 'IN_PROGRESS'
  const description = process.env.PROJECT_DESCRIPTION || `Produto Link System — ${projectName}`
  const baseRepo = process.env.BASE_REPO || 'FINANCIAL-LS'

  const { base, cookies } = await pmSession()
  console.log(`PM: ${base}`)

  const projectRes = await pmApi(base, cookies, '/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: projectName.replace(/\s+/g, ''),
      description,
      clientId,
      status,
      startDate: new Date().toISOString(),
    }),
  })
  if (!projectRes.ok) throw new Error(`create project: ${projectRes.status} ${await projectRes.text()}`)
  const project = (await projectRes.json()) as { id: string; name: string }
  console.log(`+ Projeto: ${project.name} (${project.id})`)

  const taskRes = await pmApi(base, cookies, `/api/projects/${project.id}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      title: 'Iniciar projeto',
      description: '',
      status: 'TODO',
      priority: 'MEDIUM',
    }),
  })
  if (!taskRes.ok) throw new Error(`create task: ${taskRes.status} ${await taskRes.text()}`)
  const task = (await taskRes.json()) as { id: string; title: string }
  console.log(`+ Task: ${task.title} (${task.id})`)

  const shareRes = await pmApi(base, cookies, `/api/tasks/${task.id}/share`, {
    method: 'POST',
    body: JSON.stringify({ action: 'enable' }),
  })
  if (!shareRes.ok) throw new Error(`enable share: ${shareRes.status} ${await shareRes.text()}`)
  const share = (await shareRes.json()) as { shareUrl: string; shareToken: string }
  console.log(`+ Task portal: ${share.shareUrl}`)

  const checklist = defaultBootstrapChecklist(projectName, baseRepo)
  await createChecklist(base, cookies, task.id, checklist)
  console.log(`+ Checklist: ${checklist.reduce((n, g) => n + g.items.length, 0)} itens`)

  for (const content of defaultBootstrapComments(projectName, project.id, share.shareUrl)) {
    await pmApi(base, cookies, `/api/tasks/${task.id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
  }
  console.log('+ 3 comentários')

  await pmApi(base, cookies, `/api/projects/${project.id}/tasks/${task.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      description: defaultTaskDescription(projectName, share.shareUrl),
    }),
  })

  console.log('\n--- Resultado ---')
  console.log(JSON.stringify({
    projectId: project.id,
    taskId: task.id,
    shareToken: share.shareToken,
    shareUrl: share.shareUrl,
    vaultPath: `/Users/gabrielferreira/Desktop/link-brain/Projetos/${projectName}/`,
  }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

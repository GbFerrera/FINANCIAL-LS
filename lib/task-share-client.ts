type TaskShareClipboardInput = {
  title: string
  projectName?: string
  status?: string
  priority?: string
  assigneeName?: string
}

export function buildTaskShareUrlClient(shareToken: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/task-portal/${shareToken}`
}

export function buildTaskAgentApiUrlClient(shareToken: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/api/task-portal/${shareToken}/agent`
}

export function buildTaskAgentClipboardText(
  task: TaskShareClipboardInput,
  shareUrl: string,
  agentApiUrl: string
) {
  const lines = [
    `# Task: ${task.title}`,
    task.projectName ? `Projeto: ${task.projectName}` : null,
    task.status ? `Status: ${task.status}` : null,
    task.priority ? `Prioridade: ${task.priority}` : null,
    task.assigneeName ? `Responsável: ${task.assigneeName}` : null,
    '',
    'Leia o passo a passo completo (checklist + comentários) e execute:',
    agentApiUrl,
    '',
    'Visualização humana:',
    shareUrl,
    '',
    'Instruções: busque o markdown acima, siga os grupos do checklist em ordem e marque itens concluídos via API de checklist quando aplicável.',
  ].filter((line): line is string => line !== null)

  return lines.join('\n')
}

export async function ensureTaskShareLink(taskId: string) {
  const res = await fetch(`/api/tasks/${taskId}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'enable' }),
  })

  if (!res.ok) {
    throw new Error('Não foi possível gerar o link da task')
  }

  const data = await res.json()
  if (!data.shareToken) {
    throw new Error('Link da task indisponível')
  }

  return {
    shareToken: data.shareToken as string,
    shareUrl: (data.shareUrl as string) || buildTaskShareUrlClient(data.shareToken),
    agentApiUrl: (data.agentApiUrl as string) || buildTaskAgentApiUrlClient(data.shareToken),
  }
}

import { prisma } from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'

export function buildTaskShareUrl(shareToken: string, baseUrl?: string) {
  const origin = baseUrl || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  return `${origin.replace(/\/$/, '')}/task-portal/${shareToken}`
}

export function buildTaskAgentApiUrl(shareToken: string, baseUrl?: string) {
  const origin = baseUrl || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  return `${origin.replace(/\/$/, '')}/api/task-portal/${shareToken}/agent`
}

export async function findSharedTask(shareToken: string) {
  if (!shareToken?.trim()) return null

  const task = await prisma.task.findFirst({
    where: {
      shareToken,
      shareEnabled: true,
    },
    include: {
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, email: true } },
      checklistGroups: {
        orderBy: { order: 'asc' },
        include: {
          items: { orderBy: { order: 'asc' } },
        },
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, name: true } },
        },
      },
    },
  })

  return task
}

export async function enableTaskShare(taskId: string) {
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: { shareToken: true, shareEnabled: true },
  })

  if (!existing) return null

  const shareToken = existing.shareToken || uuidv4()

  return prisma.task.update({
    where: { id: taskId },
    data: {
      shareToken,
      shareEnabled: true,
    },
    select: {
      id: true,
      title: true,
      shareToken: true,
      shareEnabled: true,
    },
  })
}

export async function disableTaskShare(taskId: string) {
  return prisma.task.update({
    where: { id: taskId },
    data: { shareEnabled: false },
    select: {
      id: true,
      title: true,
      shareToken: true,
      shareEnabled: true,
    },
  })
}

export function checklistProgress(groups: Array<{ items: Array<{ done: boolean }> }>) {
  const total = groups.reduce((sum, g) => sum + g.items.length, 0)
  const done = groups.reduce((sum, g) => sum + g.items.filter((i) => i.done).length, 0)
  return { total, done, percent: total > 0 ? Math.round((done / total) * 100) : 0 }
}

export function renderTaskAgentMarkdown(task: NonNullable<Awaited<ReturnType<typeof findSharedTask>>>) {
  const progress = checklistProgress(task.checklistGroups)
  const lines: string[] = []

  lines.push(`# Task: ${task.title}`)
  lines.push(`Project: ${task.project.name}`)
  lines.push(`Status: ${task.status}`)
  lines.push(`Priority: ${task.priority}`)
  if (task.assignee?.name) lines.push(`Assignee: ${task.assignee.name}`)
  lines.push(`Checklist progress: ${progress.done}/${progress.total} (${progress.percent}%)`)
  lines.push('')

  if (task.description?.trim()) {
    lines.push('## Description')
    lines.push(task.description.trim())
    lines.push('')
  }

  if (task.checklistGroups.length > 0) {
    lines.push('## Checklist (execute in order)')
    for (const group of task.checklistGroups) {
      lines.push('')
      lines.push(`### ${group.title}`)
      for (const item of group.items) {
        const mark = item.done ? 'x' : ' '
        const desc = item.description?.trim() ? ` — ${item.description.trim()}` : ''
        lines.push(`- [${mark}] ${item.title}${desc}`)
      }
    }
    lines.push('')
  }

  if (task.comments.length > 0) {
    lines.push('## Comments')
    for (const comment of task.comments) {
      const author = comment.author?.name || 'Sistema'
      lines.push('')
      lines.push(`### ${author}`)
      lines.push(comment.content.trim())
    }
    lines.push('')
  }

  lines.push('## Agent instructions')
  lines.push('- Read checklist groups top to bottom; each group is a phase.')
  lines.push('- Mark completed steps: PATCH checklist API with `{ "action": "toggle_item", "itemId": "...", "done": true }`.')
  lines.push('- Do not invent scope outside this task description and checklist.')

  return lines.join('\n')
}

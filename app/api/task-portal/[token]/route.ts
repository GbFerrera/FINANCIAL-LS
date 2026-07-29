import { NextRequest, NextResponse } from 'next/server'
import {
  buildTaskAgentApiUrl,
  buildTaskShareUrl,
  checklistProgress,
  findSharedTask,
} from '@/lib/task-share'
import { stripAttachmentSectionFromDescription } from '@/lib/task-attachments'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const task = await findSharedTask(token)

    if (!task) {
      return NextResponse.json({ error: 'Link inválido ou desativado' }, { status: 404 })
    }

    const origin = process.env.NEXTAUTH_URL || request.nextUrl.origin
    const progress = checklistProgress(task.checklistGroups)
    const description = stripAttachmentSectionFromDescription(task.description)

    return NextResponse.json({
      task: {
        id: task.id,
        title: task.title,
        description,
        status: task.status,
        priority: task.priority,
        project: task.project,
        assignee: task.assignee,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
      checklist: {
        groups: task.checklistGroups,
        progress,
      },
      comments: task.comments.map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        author: c.author,
      })),
      links: {
        view: buildTaskShareUrl(token, origin),
        api: `${origin.replace(/\/$/, '')}/api/task-portal/${token}`,
        agentMarkdown: buildTaskAgentApiUrl(token, origin),
        checklist: `${origin.replace(/\/$/, '')}/api/task-portal/${token}/checklist`,
      },
      agentInstructions: {
        summary:
          'Use os grupos do checklist como fases de execução. Marque itens concluídos via PATCH na API de checklist.',
        toggleItem: {
          method: 'PATCH',
          url: `${origin.replace(/\/$/, '')}/api/task-portal/${token}/checklist`,
          body: { action: 'toggle_item', itemId: '<id>', done: true },
        },
      },
    })
  } catch (error) {
    console.error('Erro task-portal GET:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

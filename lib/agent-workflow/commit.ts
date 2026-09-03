import { prisma } from '@/lib/prisma'
import type { CommitResult, PlannedTaskDraft } from './types'

async function nextTaskOrder(projectId: string, sprintId: string | null) {
  const last = await prisma.task.findFirst({
    where: { projectId, sprintId },
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  return (last?.order ?? 0) + 1
}

async function createTaskWithChecklist(
  projectId: string,
  sprintId: string | null,
  order: number,
  draft: PlannedTaskDraft
) {
  const task = await prisma.task.create({
    data: {
      title: draft.title,
      description: draft.description || null,
      projectId,
      sprintId,
      priority: draft.priority,
      storyPoints: draft.storyPoints ?? null,
      estimatedMinutes: draft.estimatedMinutes ?? null,
      order,
      status: 'TODO',
    },
  })

  if (draft.checklist?.length) {
    for (let gi = 0; gi < draft.checklist.length; gi++) {
      const groupDef = draft.checklist[gi]
      const group = await prisma.taskChecklistGroup.create({
        data: {
          title: groupDef.title,
          taskId: task.id,
          order: gi,
        },
      })
      for (let ii = 0; ii < groupDef.items.length; ii++) {
        const itemDef = groupDef.items[ii]
        await prisma.taskChecklistItem.create({
          data: {
            title: itemDef.title,
            description: itemDef.description ?? null,
            groupId: group.id,
            taskId: task.id,
            order: ii,
          },
        })
      }
    }
  }

  return task.id
}

export async function commitAgentWorkflow(params: {
  projectId: string
  epicTask?: PlannedTaskDraft
  tasks: PlannedTaskDraft[]
  sprintId?: string | null
}): Promise<CommitResult> {
  const { projectId, epicTask, tasks, sprintId = null } = params
  const createdTaskIds: string[] = []
  let order = await nextTaskOrder(projectId, sprintId)

  let epicTaskId: string | undefined
  if (epicTask?.selected) {
    epicTaskId = await createTaskWithChecklist(projectId, sprintId, order, epicTask)
    createdTaskIds.push(epicTaskId)
    order += 1
  }

  for (const taskDraft of tasks.filter((t) => t.selected)) {
    const description =
      epicTaskId && taskDraft.description
        ? `${taskDraft.description}\n\n_Epic: ${epicTask?.title}_`
        : taskDraft.description

    const id = await createTaskWithChecklist(
      projectId,
      sprintId,
      order,
      { ...taskDraft, description }
    )
    createdTaskIds.push(id)
    order += 1
  }

  return {
    createdTaskIds,
    epicTaskId,
    count: createdTaskIds.length,
  }
}

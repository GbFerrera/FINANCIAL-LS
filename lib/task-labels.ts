import type { Prisma } from '@prisma/client'

export type TaskLabelScope = 'GLOBAL' | 'PERSONAL'

export type TaskLabelDTO = {
  id: string
  name: string
  color: string
  scope: TaskLabelScope
  userId: string | null
  workspaceId: string | null
}

export const TASK_LABEL_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#0ea5e9',
  '#64748b',
] as const

export const taskLabelsInclude = {
  labelAssignments: {
    include: {
      label: true,
    },
  },
} satisfies Prisma.TaskInclude

type LabelRow = {
  id: string
  name: string
  color: string
  scope: TaskLabelScope
  userId: string | null
  workspaceId: string | null
}

export function serializeTaskLabel(label: LabelRow): TaskLabelDTO {
  return {
    id: label.id,
    name: label.name,
    color: label.color,
    scope: label.scope,
    userId: label.userId,
    workspaceId: label.workspaceId,
  }
}

export function labelVisibleToUser(label: LabelRow, viewerUserId: string) {
  if (label.scope === 'GLOBAL') return true
  return label.userId === viewerUserId
}

export function labelsVisibleToUser(labels: LabelRow[], viewerUserId: string) {
  return labels.filter((label) => labelVisibleToUser(label, viewerUserId))
}

export function extractTaskLabels(
  assignments: { label: LabelRow }[] | undefined,
  viewerUserId: string
): TaskLabelDTO[] {
  if (!assignments?.length) return []
  const seen = new Set<string>()
  const result: TaskLabelDTO[] = []
  for (const row of assignments) {
    if (!labelVisibleToUser(row.label, viewerUserId)) continue
    if (seen.has(row.label.id)) continue
    seen.add(row.label.id)
    result.push(serializeTaskLabel(row.label))
  }
  return result
}

export function buildTaskLabelsWhere(viewerUserId: string, workspaceId?: string | null): Prisma.TaskLabelWhereInput {
  const workspaceFilter: Prisma.TaskLabelWhereInput = workspaceId
    ? { OR: [{ workspaceId: null }, { workspaceId }] }
    : { workspaceId: null }

  return {
    AND: [
      workspaceFilter,
      buildTaskLabelAssignWhere(viewerUserId),
    ],
  }
}

/** Etiquetas que o usuário pode vincular a uma tarefa (independe do workspace da etiqueta). */
export function buildTaskLabelAssignWhere(viewerUserId: string): Prisma.TaskLabelWhereInput {
  return {
    OR: [{ scope: 'GLOBAL' }, { scope: 'PERSONAL', userId: viewerUserId }],
  }
}

export async function syncTaskLabels(
  tx: Prisma.TransactionClient,
  taskId: string,
  labelIds: string[],
  viewerUserId: string
) {
  const uniqueIds = [...new Set(labelIds.filter(Boolean))]
  if (uniqueIds.length === 0) {
    await tx.taskLabelAssignment.deleteMany({ where: { taskId } })
    return
  }

  const labels = await tx.taskLabel.findMany({
    where: {
      id: { in: uniqueIds },
      ...buildTaskLabelAssignWhere(viewerUserId),
    },
  })

  if (labels.length !== uniqueIds.length) {
    throw new Error('INVALID_LABELS')
  }

  await tx.taskLabelAssignment.deleteMany({
    where: {
      taskId,
      labelId: { notIn: uniqueIds },
    },
  })

  const existing = await tx.taskLabelAssignment.findMany({
    where: { taskId },
    select: { labelId: true },
  })
  const existingIds = new Set(existing.map((row) => row.labelId))
  const toCreate = uniqueIds.filter((id) => !existingIds.has(id))

  if (toCreate.length > 0) {
    await tx.taskLabelAssignment.createMany({
      data: toCreate.map((labelId) => ({ taskId, labelId })),
    })
  }
}

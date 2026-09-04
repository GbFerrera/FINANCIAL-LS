import { PipelineTask } from '@/lib/pipeline/types'

export function getTaskIdentifier(task: PipelineTask) {
  const prefix = task.project.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'TASK'
  return `${prefix}-${task.id.slice(-4).toUpperCase()}`
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: 'A Fazer',
  IN_PROGRESS: 'Em Andamento',
  IN_REVIEW: 'Em Teste',
  COMPLETED: 'Concluído',
  DONE: 'Concluído',
}

export const KANBAN_COLUMNS = [
  { id: 'TODO', title: 'A Fazer' },
  { id: 'IN_PROGRESS', title: 'Em Andamento' },
  { id: 'IN_REVIEW', title: 'Em Teste' },
  { id: 'COMPLETED', title: 'Concluído' },
] as const

export function kanbanColumnStatus(columnId: string) {
  return columnId === 'COMPLETED' ? 'COMPLETED' : columnId
}

export function taskMatchesKanbanColumn(columnId: string, status: string) {
  if (columnId === 'COMPLETED') return status === 'DONE' || status === 'COMPLETED'
  return status === columnId
}

type KanbanTaskLike = { id: string; status: string; order?: number | null }

export function sortKanbanColumnTasks<T extends KanbanTaskLike>(tasks: T[]) {
  return [...tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export function reorderKanbanBoardTasks<T extends KanbanTaskLike>(
  allTasks: T[],
  sourceColumnId: string,
  destColumnId: string,
  draggableId: string,
  destinationIndex: number
): { tasks: T[]; destOrderedIds: string[]; sourceOrderedIds?: string[]; status: string } {
  const getColumnTasks = (columnId: string, pool: T[]) =>
    sortKanbanColumnTasks(pool.filter((task) => taskMatchesKanbanColumn(columnId, task.status)))

  const sourceList = getColumnTasks(sourceColumnId, allTasks)
  const movedIndex = sourceList.findIndex((task) => task.id === draggableId)
  if (movedIndex === -1) {
    throw new Error('Tarefa não encontrada na coluna de origem')
  }

  const sourceWithoutMoved = [...sourceList]
  const [movedTask] = sourceWithoutMoved.splice(movedIndex, 1)
  const status = kanbanColumnStatus(destColumnId)
  const movedUpdated = { ...movedTask, status } as T

  const destBase =
    sourceColumnId === destColumnId ? sourceWithoutMoved : getColumnTasks(destColumnId, allTasks)
  const destList = [...destBase]
  destList.splice(destinationIndex, 0, movedUpdated)

  const reindex = (list: T[]) => list.map((task, index) => ({ ...task, order: index }))

  const newDest = reindex(destList)
  const newSource = sourceColumnId !== destColumnId ? reindex(sourceWithoutMoved) : []

  const affectedIds = new Set([...newDest, ...newSource].map((task) => task.id))
  const untouched = allTasks.filter((task) => !affectedIds.has(task.id))
  const tasks = [...untouched, ...newSource, ...newDest]

  return {
    tasks,
    destOrderedIds: newDest.map((task) => task.id),
    sourceOrderedIds: sourceColumnId !== destColumnId ? newSource.map((task) => task.id) : undefined,
    status,
  }
}

export function statusLabel(status: string) {
  return TASK_STATUS_LABELS[status] || status
}

export function priorityLabel(priority: string) {
  const map: Record<string, string> = {
    LOW: 'Baixa',
    MEDIUM: 'Média',
    HIGH: 'Alta',
    URGENT: 'Urgente',
  }
  return map[priority] || priority
}

export function priorityClass(priority: string) {
  const map: Record<string, string> = {
    LOW: 'text-sky-600',
    MEDIUM: 'text-amber-600',
    HIGH: 'text-orange-600',
    URGENT: 'text-red-600 bg-red-50 border-red-200',
  }
  return map[priority] || 'text-muted-foreground'
}

export function parseTaskDay(value?: string | null) {
  if (!value) return null
  const raw = value.includes('T') ? value.split('T')[0] : value
  const [y, m, d] = raw.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function taskScheduleStart(task: PipelineTask) {
  return parseTaskDay(task.startDate) || parseTaskDay(task.dueDate) || parseTaskDay(task.createdAt)
}

export function taskScheduleEnd(task: PipelineTask) {
  return parseTaskDay(task.dueDate) || parseTaskDay(task.startDate) || parseTaskDay(task.createdAt)
}

export function initials(name?: string | null) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

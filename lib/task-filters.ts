export const UNASSIGNED_ASSIGNEE = '__unassigned__'

export type TaskFilterState = {
  search: string
  statuses: string[]
  stateGroups: string[]
  assigneeIds: string[]
  priorities: string[]
  mentionSearch: string
  milestoneIds: string[]
  sprintIds: string[]
  projectIds: string[]
  startDateFrom: string
  startDateTo: string
  dueDateFrom: string
  dueDateTo: string
  createdFrom: string
  createdTo: string
  updatedFrom: string
  updatedTo: string
}

export const EMPTY_TASK_FILTERS: TaskFilterState = {
  search: '',
  statuses: [],
  stateGroups: [],
  assigneeIds: [],
  priorities: [],
  mentionSearch: '',
  milestoneIds: [],
  sprintIds: [],
  projectIds: [],
  startDateFrom: '',
  startDateTo: '',
  dueDateFrom: '',
  dueDateTo: '',
  createdFrom: '',
  createdTo: '',
  updatedFrom: '',
  updatedTo: '',
}

export const STATUS_OPTIONS = [
  { value: 'TODO', label: 'A Fazer' },
  { value: 'IN_PROGRESS', label: 'Em Andamento' },
  { value: 'IN_REVIEW', label: 'Em Teste' },
  { value: 'COMPLETED', label: 'Concluído' },
  { value: 'DONE', label: 'Concluído (legado)' },
] as const

export const STATE_GROUP_OPTIONS = [
  { value: 'backlog', label: 'Backlog', statuses: ['TODO'] },
  { value: 'started', label: 'Iniciado', statuses: ['IN_PROGRESS', 'IN_REVIEW'] },
  { value: 'completed', label: 'Concluído', statuses: ['COMPLETED', 'DONE'] },
] as const

export const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Baixa' },
  { value: 'MEDIUM', label: 'Média' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
] as const

type TaskLike = {
  id: string
  title: string
  description?: string | null
  status: string
  priority: string
  dueDate?: string | null
  startDate?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  sprintId?: string | null
  assignee?: { id: string } | null
  milestone?: { id: string } | null
  project?: { id: string } | null
  projectId?: string
}

function parseDay(value?: string | null) {
  if (!value) return null
  const raw = value.includes('T') ? value.split('T')[0] : value
  const [y, m, d] = raw.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function inRange(day: Date | null, from?: string, to?: string) {
  if (!day) return !from && !to
  const start = from ? parseDay(from) : null
  const end = to ? parseDay(to) : null
  if (start && day < start) return false
  if (end && day > end) return false
  return true
}

function statusesFromGroups(groups: string[]) {
  const set = new Set<string>()
  for (const g of groups) {
    const opt = STATE_GROUP_OPTIONS.find((o) => o.value === g)
    opt?.statuses.forEach((s) => set.add(s))
  }
  return [...set]
}

export function countActiveTaskFilters(filters: TaskFilterState) {
  let n = 0
  if (filters.search.trim()) n++
  if (filters.mentionSearch.trim()) n++
  n += filters.statuses.length
  n += filters.stateGroups.length
  n += filters.assigneeIds.length
  n += filters.priorities.length
  n += filters.milestoneIds.length
  n += filters.sprintIds.length
  n += filters.projectIds.length
  if (filters.startDateFrom || filters.startDateTo) n++
  if (filters.dueDateFrom || filters.dueDateTo) n++
  if (filters.createdFrom || filters.createdTo) n++
  if (filters.updatedFrom || filters.updatedTo) n++
  return n
}

export function applyTaskFilters<T extends TaskLike>(tasks: T[], filters: TaskFilterState): T[] {
  const q = filters.search.trim().toLowerCase()
  const mention = filters.mentionSearch.trim().toLowerCase()
  const groupStatuses = statusesFromGroups(filters.stateGroups)

  return tasks.filter((task) => {
    if (q) {
      const title = task.title.toLowerCase()
      const desc = (task.description || '').toLowerCase()
      if (!title.includes(q) && !desc.includes(q)) return false
    }
    if (mention) {
      const desc = (task.description || '').toLowerCase()
      if (!desc.includes(mention) && !task.title.toLowerCase().includes(mention)) return false
    }
    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) return false
    if (groupStatuses.length > 0 && !groupStatuses.includes(task.status)) return false
    if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) return false

    if (filters.assigneeIds.length > 0) {
      const id = task.assignee?.id
      const ok = filters.assigneeIds.some((aid) =>
        aid === UNASSIGNED_ASSIGNEE ? !id : id === aid
      )
      if (!ok) return false
    }

    if (filters.milestoneIds.length > 0) {
      const mid = task.milestone?.id
      if (!mid || !filters.milestoneIds.includes(mid)) return false
    }

    if (filters.sprintIds.length > 0) {
      if (!task.sprintId || !filters.sprintIds.includes(task.sprintId)) return false
    }

    if (filters.projectIds.length > 0) {
      const pid = task.project?.id || task.projectId
      if (!pid || !filters.projectIds.includes(pid)) return false
    }

    if (!inRange(parseDay(task.startDate), filters.startDateFrom, filters.startDateTo)) return false
    if (!inRange(parseDay(task.dueDate), filters.dueDateFrom, filters.dueDateTo)) return false
    if (!inRange(parseDay(task.createdAt), filters.createdFrom, filters.createdTo)) return false
    if (!inRange(parseDay(task.updatedAt), filters.updatedFrom, filters.updatedTo)) return false

    return true
  })
}

function splitCsv(value: string | null | undefined) {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function searchParamsToTaskFilters(params: URLSearchParams): TaskFilterState {
  return {
    search: params.get('search') || '',
    mentionSearch: params.get('mention') || '',
    projectIds: splitCsv(params.get('projectIds')),
    statuses: splitCsv(params.get('statuses')),
    stateGroups: splitCsv(params.get('stateGroups')),
    assigneeIds: splitCsv(params.get('assigneeIds')),
    priorities: splitCsv(params.get('priorities')),
    milestoneIds: splitCsv(params.get('milestoneIds')),
    sprintIds: splitCsv(params.get('sprintIds')),
    startDateFrom: params.get('startDateFrom') || '',
    startDateTo: params.get('startDateTo') || '',
    dueDateFrom: params.get('dueDateFrom') || '',
    dueDateTo: params.get('dueDateTo') || '',
    createdFrom: params.get('createdFrom') || '',
    createdTo: params.get('createdTo') || '',
    updatedFrom: params.get('updatedFrom') || '',
    updatedTo: params.get('updatedTo') || '',
  }
}

export function taskFiltersToSearchParams(filters: TaskFilterState): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.search.trim()) params.set('search', filters.search.trim())
  if (filters.mentionSearch.trim()) params.set('mention', filters.mentionSearch.trim())
  if (filters.projectIds.length) params.set('projectIds', filters.projectIds.join(','))
  if (filters.statuses.length) params.set('statuses', filters.statuses.join(','))
  if (filters.stateGroups.length) params.set('stateGroups', filters.stateGroups.join(','))
  if (filters.assigneeIds.length) params.set('assigneeIds', filters.assigneeIds.join(','))
  if (filters.priorities.length) params.set('priorities', filters.priorities.join(','))
  if (filters.milestoneIds.length) params.set('milestoneIds', filters.milestoneIds.join(','))
  if (filters.sprintIds.length) params.set('sprintIds', filters.sprintIds.join(','))
  if (filters.startDateFrom) params.set('startDateFrom', filters.startDateFrom)
  if (filters.startDateTo) params.set('startDateTo', filters.startDateTo)
  if (filters.dueDateFrom) params.set('dueDateFrom', filters.dueDateFrom)
  if (filters.dueDateTo) params.set('dueDateTo', filters.dueDateTo)
  if (filters.createdFrom) params.set('createdFrom', filters.createdFrom)
  if (filters.createdTo) params.set('createdTo', filters.createdTo)
  if (filters.updatedFrom) params.set('updatedFrom', filters.updatedFrom)
  if (filters.updatedTo) params.set('updatedTo', filters.updatedTo)
  return params
}

import { randomBytes } from 'crypto'

export type WorkspaceCustomStatus = {
  id: string
  label: string
}

export type WorkspaceKanbanColumn = {
  id: string
  title: string
  status: string
}

export type WorkspaceSettings = {
  showCalendarAboveBoard?: boolean
  kanbanColumns?: WorkspaceKanbanColumn[]
  customStatuses?: WorkspaceCustomStatus[]
  internalProjectId?: string
}

export const BUILTIN_TASK_STATUSES = ['DRAFT', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED'] as const

export const DEFAULT_MANAGEMENT_COLUMNS: WorkspaceKanbanColumn[] = [
  { id: 'col-backlog', title: 'Backlog', status: 'TODO' },
  { id: 'col-doing', title: 'Em execução', status: 'IN_PROGRESS' },
  { id: 'col-review', title: 'Revisão', status: 'IN_REVIEW' },
  { id: 'col-done', title: 'Concluído', status: 'COMPLETED' },
]

export const TASK_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Rascunho' },
  { value: 'TODO', label: 'A Fazer' },
  { value: 'IN_PROGRESS', label: 'Em Andamento' },
  { value: 'IN_REVIEW', label: 'Em Teste' },
  { value: 'COMPLETED', label: 'Concluído' },
] as const

export const CREATE_STATUS_VALUE = '__create_status__'

export function newKanbanColumnId() {
  return `col-${randomBytes(4).toString('hex')}`
}

export function newCustomStatusId() {
  return `cst-${randomBytes(4).toString('hex')}`
}

export function isBuiltinTaskStatus(status: string) {
  return (BUILTIN_TASK_STATUSES as readonly string[]).includes(status)
}

export function taskStatusForColumn(columnStatusKey: string) {
  if (columnStatusKey === 'DONE') return 'COMPLETED'
  if (isBuiltinTaskStatus(columnStatusKey)) return columnStatusKey
  return 'TODO'
}

export function defaultManagementSettings(): WorkspaceSettings {
  return {
    showCalendarAboveBoard: true,
    kanbanColumns: DEFAULT_MANAGEMENT_COLUMNS.map((c) => ({ ...c })),
    customStatuses: [],
  }
}

export function normalizeCustomStatuses(statuses?: WorkspaceCustomStatus[]): WorkspaceCustomStatus[] {
  if (!statuses?.length) return []
  const seen = new Set<string>()
  const normalized: WorkspaceCustomStatus[] = []
  for (const row of statuses) {
    const id = row.id?.trim()
    const label = row.label?.trim()
    if (!id || !label || seen.has(id)) continue
    seen.add(id)
    normalized.push({ id, label })
  }
  return normalized
}

export function workspaceStatusOptions(customStatuses?: WorkspaceCustomStatus[]) {
  const custom = normalizeCustomStatuses(customStatuses).map((s) => ({
    value: s.id,
    label: s.label,
    custom: true as const,
  }))
  return [
    ...TASK_STATUS_OPTIONS.map((opt) => ({ ...opt, custom: false as const })),
    ...custom,
  ]
}

export function resolveWorkspaceStatusLabel(
  statusKey: string,
  customStatuses?: WorkspaceCustomStatus[]
) {
  const builtIn = TASK_STATUS_OPTIONS.find((opt) => opt.value === statusKey)
  if (builtIn) return builtIn.label
  const custom = normalizeCustomStatuses(customStatuses).find((s) => s.id === statusKey)
  return custom?.label ?? statusKey
}

export function parseWorkspaceSettings(raw: unknown): WorkspaceSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const obj = raw as Record<string, unknown>
  const settings: WorkspaceSettings = {}

  if (typeof obj.showCalendarAboveBoard === 'boolean') {
    settings.showCalendarAboveBoard = obj.showCalendarAboveBoard
  }
  if (typeof obj.internalProjectId === 'string' && obj.internalProjectId.trim()) {
    settings.internalProjectId = obj.internalProjectId.trim()
  }
  if (Array.isArray(obj.customStatuses)) {
    settings.customStatuses = obj.customStatuses
      .map((row) => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) return null
        const s = row as Record<string, unknown>
        const id = typeof s.id === 'string' ? s.id.trim() : ''
        const label = typeof s.label === 'string' ? s.label.trim() : ''
        if (!id || !label) return null
        return { id, label }
      })
      .filter(Boolean) as WorkspaceCustomStatus[]
  }
  if (Array.isArray(obj.kanbanColumns)) {
    settings.kanbanColumns = obj.kanbanColumns
      .map((col) => {
        if (!col || typeof col !== 'object' || Array.isArray(col)) return null
        const c = col as Record<string, unknown>
        const id = typeof c.id === 'string' ? c.id.trim() : ''
        const title = typeof c.title === 'string' ? c.title.trim() : ''
        const status = typeof c.status === 'string' ? c.status.trim() : ''
        if (!id || !title || !status) return null
        return { id, title, status }
      })
      .filter(Boolean) as WorkspaceKanbanColumn[]
  }

  return settings
}

export function normalizeKanbanColumns(columns?: WorkspaceKanbanColumn[]): WorkspaceKanbanColumn[] {
  if (!columns?.length) return DEFAULT_MANAGEMENT_COLUMNS.map((c) => ({ ...c }))
  const seen = new Set<string>()
  const normalized: WorkspaceKanbanColumn[] = []
  for (const col of columns) {
    const id = col.id?.trim()
    const title = col.title?.trim()
    const status = col.status?.trim()
    if (!id || !title || !status || seen.has(id)) continue
    seen.add(id)
    normalized.push({ id, title, status })
  }
  return normalized.length > 0 ? normalized : DEFAULT_MANAGEMENT_COLUMNS.map((c) => ({ ...c }))
}

export function mergeWorkspaceSettings(
  current: WorkspaceSettings,
  patch: Partial<WorkspaceSettings>
): WorkspaceSettings {
  const next: WorkspaceSettings = { ...current }
  if (patch.showCalendarAboveBoard !== undefined) {
    next.showCalendarAboveBoard = patch.showCalendarAboveBoard
  }
  if (patch.internalProjectId !== undefined) {
    next.internalProjectId = patch.internalProjectId
  }
  if (patch.customStatuses !== undefined) {
    next.customStatuses = normalizeCustomStatuses(patch.customStatuses)
  }
  if (patch.kanbanColumns !== undefined) {
    next.kanbanColumns = normalizeKanbanColumns(patch.kanbanColumns)
  }
  return next
}

export function settingsForManagementKind(
  kind: 'DEFAULT' | 'MANAGEMENT',
  raw: unknown
): WorkspaceSettings | null {
  if (kind !== 'MANAGEMENT') return null
  const parsed = parseWorkspaceSettings(raw)
  return {
    showCalendarAboveBoard: parsed.showCalendarAboveBoard ?? true,
    kanbanColumns: normalizeKanbanColumns(parsed.kanbanColumns),
    customStatuses: normalizeCustomStatuses(parsed.customStatuses),
    ...(parsed.internalProjectId ? { internalProjectId: parsed.internalProjectId } : {}),
  }
}

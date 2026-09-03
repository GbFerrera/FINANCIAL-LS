export type PipelineViewMode = 'list' | 'board' | 'calendar' | 'table' | 'timeline'

export type PipelineTask = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  estimatedMinutes: number | null
  startDate: string | null
  startTime: string | null
  endTime: string | null
  createdAt?: string | null
  updatedAt?: string | null
  sprintId?: string | null
  assignee: { id: string; name: string; email: string; avatar: string | null } | null
  milestone: { id: string; name: string; status: string } | null
  project: { id: string; name: string }
  sprint?: { id: string; name: string } | null
}

export const PIPELINE_VIEW_MODES: { id: PipelineViewMode; label: string }[] = [
  { id: 'list', label: 'Lista' },
  { id: 'board', label: 'Quadro' },
  { id: 'calendar', label: 'Agenda' },
  { id: 'table', label: 'Tabela' },
  { id: 'timeline', label: 'Cronograma' },
]

export const STATUS_GROUPS = [
  { id: 'BACKLOG', label: 'Backlog', statuses: [] as string[], dot: 'border-dashed border-muted-foreground/40' },
  { id: 'TODO', label: 'A Fazer', statuses: ['TODO'], dot: 'border-muted-foreground/50' },
  { id: 'IN_PROGRESS', label: 'Em Andamento', statuses: ['IN_PROGRESS'], dot: 'border-amber-500 bg-amber-500/20' },
  { id: 'IN_REVIEW', label: 'Em Teste', statuses: ['IN_REVIEW'], dot: 'border-yellow-500 bg-yellow-500/20' },
  { id: 'COMPLETED', label: 'Concluído', statuses: ['COMPLETED', 'DONE'], dot: 'border-emerald-500 bg-emerald-500/20' },
  { id: 'CANCELLED', label: 'Cancelado', statuses: [] as string[], dot: 'border-muted-foreground/30' },
] as const

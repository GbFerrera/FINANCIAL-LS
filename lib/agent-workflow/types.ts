export type DemandType =
  | 'feature'
  | 'bug'
  | 'bootstrap'
  | 'ops'
  | 'refactor'
  | 'improvement'
  | 'other'

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export type WorkflowStepId = 'intake' | 'triage' | 'enrichment' | 'planning' | 'confirm'

export interface PlannedChecklistItem {
  title: string
  description?: string
}

export interface PlannedChecklistGroup {
  title: string
  items: PlannedChecklistItem[]
}

export interface PlannedTaskDraft {
  clientId: string
  title: string
  description?: string
  priority: TaskPriority
  storyPoints?: number
  estimatedMinutes?: number
  checklist?: PlannedChecklistGroup[]
  selected: boolean
}

export interface TriageResult {
  demandType: DemandType
  demandTypeLabel: string
  summary: string
  suggestedTitle: string
  suggestedPriority: TaskPriority
  questions: string[]
  signals: string[]
}

export interface EnrichmentResult {
  epicTitle: string
  context: string
  objectives: string
  constraints: string
  deliverables: string
  acceptanceCriteria: string
}

export interface PlanningResult {
  epicTask: PlannedTaskDraft
  tasks: PlannedTaskDraft[]
  notes: string[]
}

export interface AgentWorkflowState {
  intake: string
  triage?: TriageResult
  enrichment?: EnrichmentResult
  planning?: PlanningResult
}

export interface CommitResult {
  createdTaskIds: string[]
  epicTaskId?: string
  count: number
}

import { z } from 'zod'

const demandTypeSchema = z.enum([
  'feature',
  'bug',
  'bootstrap',
  'ops',
  'refactor',
  'improvement',
  'other',
])

const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])

const checklistItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
})

const checklistGroupSchema = z.object({
  title: z.string().min(1),
  items: z.array(checklistItemSchema).min(1),
})

const llmTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: prioritySchema,
  storyPoints: z.number().int().min(0).max(21).optional(),
  estimatedMinutes: z.number().int().min(0).optional(),
  selected: z.boolean().optional(),
  checklist: z.array(checklistGroupSchema).optional(),
})

export const llmAnalyzeResponseSchema = z.object({
  triage: z.object({
    demandType: demandTypeSchema,
    demandTypeLabel: z.string().min(1),
    summary: z.string().min(1),
    suggestedTitle: z.string().min(1),
    suggestedPriority: prioritySchema,
    questions: z.array(z.string()).default([]),
    signals: z.array(z.string()).default([]),
  }),
  enrichment: z.object({
    epicTitle: z.string().min(1),
    context: z.string().min(1),
    objectives: z.string().min(1),
    constraints: z.string().min(1),
    deliverables: z.string().min(1),
    acceptanceCriteria: z.string().min(1),
  }),
  planning: z.object({
    epicTask: llmTaskSchema,
    tasks: z.array(llmTaskSchema).min(1).max(12),
    notes: z.array(z.string()).default([]),
  }),
})

export type LlmAnalyzeResponse = z.infer<typeof llmAnalyzeResponseSchema>

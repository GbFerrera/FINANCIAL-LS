import { randomUUID } from 'crypto'
import type {
  AgentWorkflowState,
  DemandType,
  EnrichmentResult,
  PlannedTaskDraft,
  PlanningResult,
  TaskPriority,
  TriageResult,
} from './types'

const TYPE_LABELS: Record<DemandType, string> = {
  feature: 'Nova funcionalidade',
  bug: 'Correção / bug',
  bootstrap: 'Bootstrap de produto',
  ops: 'Operação / infra',
  refactor: 'Refatoração',
  improvement: 'Melhoria',
  other: 'Demanda geral',
}

function detectDemandType(text: string): DemandType {
  const t = text.toLowerCase()
  if (/(bootstrap|novo produto|fork|repo|coolify|deploy inicial|link control)/i.test(t)) return 'bootstrap'
  if (/(bug|erro|falha|corrigir|fix|não funciona|quebr)/i.test(t)) return 'bug'
  if (/(refator|limpar código|reorganizar)/i.test(t)) return 'refactor'
  if (/(deploy|servidor|vps|docker|redis|postgres|infra|coolify)/i.test(t)) return 'ops'
  if (/(melhoria|ajuste|otimiz|ui|ux|visual)/i.test(t)) return 'improvement'
  if (/(feature|funcionalidade|implementar|criar|adicionar|novo módulo)/i.test(t)) return 'feature'
  return 'other'
}

function detectPriority(text: string): TaskPriority {
  const t = text.toLowerCase()
  if (/(urgente|crítico|critico|bloqueado|produção parada|asap)/i.test(t)) return 'URGENT'
  if (/(alta prioridade|importante|logo|hoje)/i.test(t)) return 'HIGH'
  if (/(baixa|quando der|depois|backlog)/i.test(t)) return 'LOW'
  return 'MEDIUM'
}

function firstLineTitle(text: string, fallback = 'Nova demanda'): string {
  const line = text
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean)
  if (!line) return fallback
  const cleaned = line.replace(/^[-*•]\s*/, '').slice(0, 120)
  return cleaned.length < 8 ? fallback : cleaned
}

function bulletLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[-*•]\d+[.)]?\s*/, '').replace(/^[-*•]\s*/, ''))
    .filter((l) => l.length > 2)
}

function draft(
  partial: Omit<PlannedTaskDraft, 'clientId' | 'selected'> & { selected?: boolean }
): PlannedTaskDraft {
  return {
    clientId: randomUUID(),
    selected: partial.selected ?? true,
    ...partial,
  }
}

export function runTriage(intake: string, projectName?: string): TriageResult {
  const trimmed = intake.trim()
  const demandType = detectDemandType(trimmed)
  const suggestedPriority = detectPriority(trimmed)
  const suggestedTitle = firstLineTitle(trimmed, `Demanda — ${projectName || 'projeto'}`)

  const questions: string[] = []
  if (demandType === 'bug') {
    questions.push('Qual o comportamento esperado vs. o que acontece hoje?')
    questions.push('Há passos fixos para reproduzir?')
  } else if (demandType === 'bootstrap') {
    questions.push('Qual repositório/base será usado?')
    questions.push('Onde será o deploy (Coolify/servidor)?')
  } else {
    questions.push('Quem é o usuário final impactado?')
    questions.push('Existe prazo ou dependência externa?')
  }

  const signals: string[] = []
  if (projectName) signals.push(`Projeto: ${projectName}`)
  signals.push(`Tipo detectado: ${TYPE_LABELS[demandType]}`)
  if (suggestedPriority !== 'MEDIUM') signals.push(`Prioridade sugerida: ${suggestedPriority}`)

  const summary =
    trimmed.length > 280 ? `${trimmed.slice(0, 277).trim()}…` : trimmed || 'Demanda sem detalhes.'

  return {
    demandType,
    demandTypeLabel: TYPE_LABELS[demandType],
    summary,
    suggestedTitle,
    suggestedPriority,
    questions,
    signals,
  }
}

export function runEnrichment(intake: string, triage: TriageResult): EnrichmentResult {
  const bullets = bulletLines(intake)
  const objectives =
    bullets.length > 1
      ? bullets.slice(0, Math.min(5, bullets.length)).map((b) => `- ${b}`).join('\n')
      : `- ${triage.summary}`

  return {
    epicTitle: triage.suggestedTitle,
    context: `Demanda classificada como **${triage.demandTypeLabel}**.\n\n${triage.summary}`,
    objectives,
    constraints: '- Manter escopo mínimo viável\n- Seguir padrões do Link System PM',
    deliverables:
      triage.demandType === 'bootstrap'
        ? '- Repositório configurado\n- Deploy em produção\n- Documentação no Link Brain'
        : '- Implementação concluída\n- Validação em ambiente de teste\n- Deploy ou handoff documentado',
    acceptanceCriteria:
      '- Critérios de aceite revisados com o solicitante\n- Tarefas criadas no Kanban com prioridade definida',
  }
}

function bootstrapTasks(enrichment: EnrichmentResult): PlannedTaskDraft[] {
  const phases = [
    {
      title: '1. Repositório GitHub',
      sp: 2,
      items: [
        'Criar repo e push inicial',
        'Renomear package/README',
      ],
    },
    {
      title: '2. Base do sistema',
      sp: 3,
      items: ['Ajustar env e branding', 'Validar local (migrate + dev)'],
    },
    {
      title: '3. Deploy (Coolify)',
      sp: 3,
      items: ['Configurar app + domínio', 'Smoke test produção'],
    },
    {
      title: '4. Pós-deploy',
      sp: 1,
      items: ['Documentar Link Brain', 'Vincular repo no PM'],
    },
  ]

  return phases.map((phase) =>
    draft({
      title: phase.title,
      description: enrichment.context,
      priority: 'MEDIUM',
      storyPoints: phase.sp,
      estimatedMinutes: phase.sp * 60,
      checklist: [
        {
          title: phase.title,
          items: phase.items.map((item) => ({ title: item })),
        },
      ],
    })
  )
}

function featureTasks(enrichment: EnrichmentResult): PlannedTaskDraft[] {
  return [
    draft({
      title: 'Triagem e escopo',
      description: enrichment.context,
      priority: 'MEDIUM',
      storyPoints: 1,
      estimatedMinutes: 60,
      checklist: [
        {
          title: 'Triagem',
          items: [{ title: 'Validar escopo com solicitante' }, { title: 'Registrar critérios de aceite' }],
        },
      ],
    }),
    draft({
      title: 'Implementação',
      description: enrichment.objectives,
      priority: 'MEDIUM',
      storyPoints: 3,
      estimatedMinutes: 180,
    }),
    draft({
      title: 'Testes e validação',
      description: enrichment.acceptanceCriteria,
      priority: 'MEDIUM',
      storyPoints: 1,
      estimatedMinutes: 60,
    }),
    draft({
      title: 'Deploy / entrega',
      description: enrichment.deliverables,
      priority: 'MEDIUM',
      storyPoints: 1,
      estimatedMinutes: 45,
    }),
  ]
}

function bugTasks(enrichment: EnrichmentResult): PlannedTaskDraft[] {
  return [
    draft({
      title: 'Reproduzir e diagnosticar',
      description: enrichment.context,
      priority: 'HIGH',
      storyPoints: 1,
      estimatedMinutes: 45,
    }),
    draft({
      title: 'Corrigir bug',
      description: enrichment.objectives,
      priority: 'HIGH',
      storyPoints: 2,
      estimatedMinutes: 120,
    }),
    draft({
      title: 'Validar correção',
      description: enrichment.acceptanceCriteria,
      priority: 'MEDIUM',
      storyPoints: 1,
      estimatedMinutes: 30,
    }),
  ]
}

function genericTasks(enrichment: EnrichmentResult, intake: string): PlannedTaskDraft[] {
  const bullets = bulletLines(intake)
  if (bullets.length >= 2) {
    return bullets.slice(0, 8).map((line, index) =>
      draft({
        title: line.slice(0, 100),
        description: enrichment.context,
        priority: index === 0 ? 'HIGH' : 'MEDIUM',
        storyPoints: 1,
        estimatedMinutes: 60,
      })
    )
  }
  return featureTasks(enrichment)
}

export function runPlanning(
  intake: string,
  triage: TriageResult,
  enrichment: EnrichmentResult
): PlanningResult {
  let tasks: PlannedTaskDraft[]

  switch (triage.demandType) {
    case 'bootstrap':
      tasks = bootstrapTasks(enrichment)
      break
    case 'bug':
      tasks = bugTasks(enrichment)
      break
    case 'feature':
    case 'improvement':
    case 'refactor':
    case 'ops':
      tasks = featureTasks(enrichment)
      break
    default:
      tasks = genericTasks(enrichment, intake)
  }

  const epicTask = draft({
    title: `[Epic] ${enrichment.epicTitle}`,
    description: [
      '## Contexto',
      enrichment.context,
      '',
      '## Objetivos',
      enrichment.objectives,
      '',
      '## Entregáveis',
      enrichment.deliverables,
      '',
      '## Critérios de aceite',
      enrichment.acceptanceCriteria,
    ].join('\n'),
    priority: triage.suggestedPriority,
    storyPoints: tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0),
    selected: true,
  })

  return {
    epicTask,
    tasks,
    notes: [
      'Revise títulos, prioridades e story points antes de confirmar.',
      'Desmarque tarefas que não devem ser criadas.',
      'Digite **sim** ou clique em confirmar para criar no Kanban.',
    ],
  }
}

/** Pipeline clássico (regras + templates) — fallback quando Ollama está offline */
export function runRulesAnalyze(intake: string, projectName?: string) {
  const triage = runTriage(intake, projectName)
  const enrichment = runEnrichment(intake, triage)
  const planning = runPlanning(intake, triage, enrichment)
  return { triage, enrichment, planning }
}

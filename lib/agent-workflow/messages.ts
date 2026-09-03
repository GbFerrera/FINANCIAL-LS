import type { EnrichmentResult, PlanningResult, TriageResult } from './types'

export function formatAgentAnalysisReply(
  projectName: string,
  triage: TriageResult,
  enrichment: EnrichmentResult,
  planning: PlanningResult
): string {
  const taskLines = [
    planning.epicTask.selected ? `• ${planning.epicTask.title}` : null,
    ...planning.tasks.filter((t) => t.selected).map((t) => `• ${t.title} (${t.priority}, ${t.storyPoints ?? 0} SP)`),
  ].filter(Boolean)

  return [
    `**Triagem** — ${triage.demandTypeLabel}`,
    triage.summary,
    '',
    '**Enriquecimento**',
    `Epic: ${enrichment.epicTitle}`,
    '',
    '**Planejamento** — tarefas propostas:',
    ...taskLines,
    '',
    `Projeto destino: **${projectName}**`,
    '',
    'Digite **sim** para criar essas tarefas no Kanban.',
  ].join('\n')
}

export function formatAgentSuccessReply(projectName: string, count: number, projectId: string): string {
  return [
    `Pronto! **${count}** tarefa(s) criada(s) em **${projectName}**.`,
    '',
    `[Abrir projeto](/projects/${projectId})`,
  ].join('\n')
}

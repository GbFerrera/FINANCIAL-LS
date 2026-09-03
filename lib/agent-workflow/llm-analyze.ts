import { randomUUID } from 'crypto'
import { ollamaChat, OllamaError } from '@/lib/llm/ollama'
import { getAgentLlmConfig } from '@/lib/llm/config'
import type {
  AgentWorkflowState,
  PlannedTaskDraft,
  PlanningResult,
} from './types'
import { llmAnalyzeResponseSchema, type LlmAnalyzeResponse } from './llm-schemas'

const SYSTEM_PROMPT = `Você é o Agente PM do Link System (gestão de projetos de software).
Analise a demanda do usuário e produza triagem, enriquecimento e planejamento de tarefas para Kanban.

Regras:
- Responda APENAS com JSON válido, sem markdown, sem texto extra.
- Idioma: português do Brasil.
- demandType: feature | bug | bootstrap | ops | refactor | improvement | other
- suggestedPriority / priority: LOW | MEDIUM | HIGH | URGENT
- Crie 3 a 8 tarefas práticas além do epic.
- epicTask.title deve começar com "[Epic] ".
- storyPoints: Fibonacci leve (1, 2, 3, 5, 8).
- Inclua checklists quando fizer sentido (2-5 itens por grupo).
- Seja específico ao texto da demanda; não use placeholders genéricos.`

function buildUserPrompt(intake: string, projectName: string) {
  return [
    `Projeto: ${projectName}`,
    '',
    'Demanda do usuário:',
    intake,
    '',
    'Retorne JSON com esta estrutura exata:',
    JSON.stringify(
      {
        triage: {
          demandType: 'feature',
          demandTypeLabel: 'Nova funcionalidade',
          summary: 'resumo curto',
          suggestedTitle: 'título sugerido',
          suggestedPriority: 'MEDIUM',
          questions: ['pergunta 1'],
          signals: ['sinal 1'],
        },
        enrichment: {
          epicTitle: 'título do epic',
          context: 'markdown leve',
          objectives: 'bullet list em texto',
          constraints: 'bullet list',
          deliverables: 'bullet list',
          acceptanceCriteria: 'bullet list',
        },
        planning: {
          epicTask: {
            title: '[Epic] ...',
            description: '...',
            priority: 'MEDIUM',
            storyPoints: 5,
            selected: true,
          },
          tasks: [
            {
              title: 'Tarefa 1',
              description: '...',
              priority: 'MEDIUM',
              storyPoints: 2,
              selected: true,
              checklist: [{ title: 'Grupo', items: [{ title: 'Item' }] }],
            },
          ],
          notes: ['nota para o usuário'],
        },
      },
      null,
      0
    ),
  ].join('\n')
}

function normalizeTask(
  task: LlmAnalyzeResponse['planning']['tasks'][number],
  selectedDefault = true
): PlannedTaskDraft {
  return {
    clientId: randomUUID(),
    title: task.title.trim(),
    description: task.description?.trim(),
    priority: task.priority,
    storyPoints: task.storyPoints,
    estimatedMinutes: task.estimatedMinutes,
    selected: task.selected ?? selectedDefault,
    checklist: task.checklist?.map((g) => ({
      title: g.title,
      items: g.items.map((i) => ({
        title: i.title,
        description: i.description,
      })),
    })),
  }
}

function toWorkflowState(parsed: LlmAnalyzeResponse): Pick<
  AgentWorkflowState,
  'triage' | 'enrichment' | 'planning'
> {
  const epicTask = normalizeTask(parsed.planning.epicTask, true)
  const tasks = parsed.planning.tasks.map((t) => normalizeTask(t, true))

  const planning: PlanningResult = {
    epicTask,
    tasks,
    notes: parsed.planning.notes.length
      ? parsed.planning.notes
      : ['Revise o plano e digite **sim** para criar no Kanban.'],
  }

  return {
    triage: parsed.triage,
    enrichment: parsed.enrichment,
    planning,
  }
}

function parseLlmJson(raw: string): LlmAnalyzeResponse {
  let jsonText = raw.trim()
  const fence = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) jsonText = fence[1].trim()

  const parsed = JSON.parse(jsonText)
  return llmAnalyzeResponseSchema.parse(parsed)
}

export type LlmAnalyzeMeta = {
  provider: 'ollama'
  model: string
  baseUrl: string
}

export async function analyzeDemandWithLlm(
  intake: string,
  projectName: string
): Promise<{
  triage: NonNullable<AgentWorkflowState['triage']>
  enrichment: NonNullable<AgentWorkflowState['enrichment']>
  planning: NonNullable<AgentWorkflowState['planning']>
  meta: LlmAnalyzeMeta
}> {
  const { ollama } = getAgentLlmConfig()
  const raw = await ollamaChat({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(intake, projectName),
    json: true,
  })

  let parsed: LlmAnalyzeResponse
  try {
    parsed = parseLlmJson(raw)
  } catch (e) {
    throw new OllamaError(
      `JSON inválido do modelo: ${e instanceof Error ? e.message : 'parse error'}`
    )
  }

  const workflow = toWorkflowState(parsed)
  return {
    ...workflow,
    meta: {
      provider: 'ollama',
      model: ollama.model,
      baseUrl: ollama.baseUrl,
    },
  }
}

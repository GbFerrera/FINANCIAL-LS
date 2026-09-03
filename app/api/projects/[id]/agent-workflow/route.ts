import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { commitAgentWorkflow } from '@/lib/agent-workflow/commit'
import { isWorkflowConfirmation } from '@/lib/agent-workflow/confirm'
import { analyzeDemandWithLlm } from '@/lib/agent-workflow/llm-analyze'
import {
  runEnrichment,
  runPlanning,
  runRulesAnalyze,
  runTriage,
} from '@/lib/agent-workflow/pipeline'
import type {
  AgentWorkflowState,
  EnrichmentResult,
  PlanningResult,
  TriageResult,
} from '@/lib/agent-workflow/types'
import { getAgentLlmConfig } from '@/lib/llm/config'
import { z } from 'zod'

const bodySchema = z.object({
  action: z.enum(['triage', 'enrich', 'plan', 'analyze', 'commit']),
  state: z.object({
    intake: z.string(),
    triage: z.any().optional(),
    enrichment: z.any().optional(),
    planning: z.any().optional(),
  }),
  confirmText: z.string().optional(),
  confirmed: z.boolean().optional(),
  sprintId: z.string().nullable().optional(),
})

async function assertProjectAccess(projectId: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (user?.role === 'ADMIN') return true

  const member = await prisma.projectTeam.findFirst({
    where: { projectId, userId },
    select: { id: true },
  })
  return !!member
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id: projectId } = await params
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    const allowed = await assertProjectAccess(projectId, session.user.id)
    if (!allowed) {
      return NextResponse.json({ error: 'Sem permissão neste projeto' }, { status: 403 })
    }

    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.issues }, { status: 400 })
    }

    const { action, state, confirmText, confirmed, sprintId } = parsed.data
    const intake = state.intake.trim()

    if (!intake && action !== 'commit') {
      return NextResponse.json({ error: 'Descreva a demanda na etapa de entrada' }, { status: 400 })
    }

    let nextState: AgentWorkflowState = { intake }
    let engine:
      | { provider: 'ollama'; model: string; fallback: false }
      | { provider: 'rules'; fallback: boolean; llmError?: string }
      | undefined

    if (action === 'triage') {
      nextState = { intake, triage: runTriage(intake, project.name) }
    }

    if (action === 'enrich') {
      const triage = (state.triage as TriageResult | undefined) || runTriage(intake, project.name)
      nextState = { intake, triage, enrichment: runEnrichment(intake, triage) }
    }

    if (action === 'plan') {
      const triage = state.triage as TriageResult | undefined
      const enrichment = state.enrichment as EnrichmentResult | undefined
      if (!triage || !enrichment) {
        return NextResponse.json({ error: 'Complete triagem e enriquecimento primeiro' }, { status: 400 })
      }
      nextState = {
        intake,
        triage,
        enrichment,
        planning: runPlanning(intake, triage, enrichment),
      }
    }

    if (action === 'analyze') {
      const llmConfig = getAgentLlmConfig()

      if (llmConfig.provider === 'ollama') {
        try {
          const llm = await analyzeDemandWithLlm(intake, project.name)
          nextState = {
            intake,
            triage: llm.triage,
            enrichment: llm.enrichment,
            planning: llm.planning,
          }
          engine = { provider: 'ollama', model: llm.meta.model, fallback: false }
        } catch (e) {
          if (!llmConfig.fallbackToRules) {
            const message = e instanceof Error ? e.message : 'Falha no Ollama'
            return NextResponse.json(
              {
                error: 'Ollama indisponível',
                hint: message,
              },
              { status: 502 }
            )
          }
          console.warn('[agent-workflow] Ollama indisponível, usando regras:', e)
          const rules = runRulesAnalyze(intake, project.name)
          nextState = { intake, ...rules }
          engine = {
            provider: 'rules',
            fallback: true,
            llmError: e instanceof Error ? e.message : 'Erro desconhecido',
          }
        }
      } else {
        const rules = runRulesAnalyze(intake, project.name)
        nextState = { intake, ...rules }
        engine = { provider: 'rules', fallback: false }
      }
    }

    if (action === 'commit') {
      const planning = state.planning as PlanningResult | undefined
      if (!planning) {
        return NextResponse.json({ error: 'Execute o planejamento antes de confirmar' }, { status: 400 })
      }

      const ok =
        confirmed === true || isWorkflowConfirmation(confirmText || '')

      if (!ok) {
        return NextResponse.json(
          {
            error: 'Confirmação necessária',
            hint: 'Digite "sim" para criar as tarefas ou use o botão de confirmar.',
          },
          { status: 400 }
        )
      }

      const selectedTasks = planning.tasks.filter((t) => t.selected)
      if (!planning.epicTask.selected && selectedTasks.length === 0) {
        return NextResponse.json({ error: 'Selecione ao menos uma tarefa' }, { status: 400 })
      }

      const result = await commitAgentWorkflow({
        projectId,
        epicTask: planning.epicTask,
        tasks: planning.tasks,
        sprintId: sprintId ?? null,
      })

      return NextResponse.json({
        success: true,
        result,
        message: `${result.count} tarefa(s) criada(s) no projeto.`,
      })
    }

    return NextResponse.json({ state: nextState, engine })
  } catch (error) {
    console.error('Erro no agent workflow:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingAnimation, LoadingInline, LoadingScreen } from '@/components/ui/loading-animation'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { isWorkflowConfirmation } from '@/lib/agent-workflow/confirm'
import {
  formatAgentAnalysisReply,
  formatAgentSuccessReply,
} from '@/lib/agent-workflow/messages'
import type {
  AgentWorkflowState,
  EnrichmentResult,
  PlanningResult,
  TriageResult,
} from '@/lib/agent-workflow/types'
import toast from 'react-hot-toast'
import {
  Bot,
  ChevronDown,
  Loader2,
  MessageSquarePlus,
  Search,
  Send,
  User,
  FolderOpen,
  CheckCircle2,
} from 'lucide-react'

type ProjectOption = { id: string; name: string; clientName?: string }

type LlmStatus = {
  provider: string
  fallbackToRules?: boolean
  ollama?: {
    ok: boolean
    model: string
    baseUrl: string
    error?: string
  } | null
}

type ChatMessage = {
  id: string
  role: 'user' | 'agent'
  content: string
}

const WELCOME_MESSAGE =
  'Olá! Sou o **Agente PM** do Link System.\n\n1. Escolha o **projeto** no seletor acima\n2. Descreva sua demanda aqui no chat\n3. Eu faço triagem, enriquecimento e planejamento\n4. Responda **sim** para criar as tarefas automaticamente'

export function AgentChatPanel() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [projectSearch, setProjectSearch] = useState('')
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'agent', content: WELCOME_MESSAGE },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [workflow, setWorkflow] = useState<AgentWorkflowState | null>(null)
  const [llmStatus, setLlmStatus] = useState<LlmStatus | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    fetch('/api/projects/list', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => {
        const list = (data.projects || []).map((p: { id: string; name: string; clientName?: string }) => ({
          id: p.id,
          name: p.name,
          clientName: p.clientName,
        }))
        setProjects(list)
      })
      .catch(() => toast.error('Erro ao carregar projetos'))

    fetch('/api/agent/llm-status', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setLlmStatus(data)
      })
      .catch(() => {})
  }, [session, status, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const addMessage = useCallback((role: ChatMessage['role'], content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, role, content },
    ])
  }, [])

  const callWorkflow = async (
    projectId: string,
    action: 'analyze' | 'commit',
    state: AgentWorkflowState,
    extra?: { confirmed?: boolean; confirmText?: string }
  ) => {
    const res = await fetch(`/api/projects/${projectId}/agent-workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action, state, ...extra }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || data.hint || 'Erro no agente')
    return data
  }

  const resetConversation = () => {
    setWorkflow(null)
    setInput('')
    setMessages([
      {
        id: 'welcome-reset',
        role: 'agent',
        content: 'Nova conversa iniciada. Escolha o projeto e descreva a próxima demanda.',
      },
    ])
  }

  const selectProject = (project: ProjectOption) => {
    setSelectedProjectId(project.id)
    setProjectPickerOpen(false)
    setProjectSearch('')
    setWorkflow(null)
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    addMessage('user', text)
    setInput('')

    if (!selectedProjectId || !selectedProject) {
      addMessage('agent', 'Escolha um **projeto** no seletor acima antes de continuar.')
      return
    }

    setLoading(true)
    try {
      if (workflow?.planning && isWorkflowConfirmation(text)) {
        const data = await callWorkflow(
          selectedProjectId,
          'commit',
          workflow,
          { confirmed: true, confirmText: text }
        )
        addMessage(
          'agent',
          formatAgentSuccessReply(
            selectedProject.name,
            data.result.count,
            selectedProjectId
          )
        )
        setWorkflow(null)
        toast.success(data.message)
        return
      }

      if (workflow?.planning) {
        addMessage(
          'agent',
          'Para criar as tarefas, digite **sim**. Para outra demanda, use **Nova conversa**.'
        )
        return
      }

      const intake = text
      const data = await callWorkflow(selectedProjectId, 'analyze', { intake })
      const state = data.state as AgentWorkflowState
      setWorkflow(state)

      if (state.triage && state.enrichment && state.planning) {
        let reply = formatAgentAnalysisReply(
          selectedProject.name,
          state.triage as TriageResult,
          state.enrichment as EnrichmentResult,
          state.planning as PlanningResult
        )
        if (data.engine?.provider === 'ollama' && !data.engine.fallback) {
          reply += `\n\n_Gerado com Ollama (${data.engine.model})._`
        } else if (data.engine?.fallback) {
          reply += `\n\n_Ollama offline — plano gerado por regras. ${data.engine.llmError || ''}_`
          toast.error('Ollama offline; usando modo regras')
        }
        addMessage('agent', reply)
      }
    } catch (e) {
      addMessage(
        'agent',
        e instanceof Error ? e.message : 'Não consegui processar. Tente novamente.'
      )
    } finally {
      setLoading(false)
    }
  }

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase())
  )

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[560px] flex-col bg-background">
      <div className="flex flex-wrap items-center gap-3 px-4 md:px-6 py-3 border-b border-border shrink-0 bg-card/50">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="h-5 w-5 text-primary shrink-0" />
          <span className="font-semibold text-sm hidden sm:inline">Agente PM</span>
          {llmStatus?.provider === 'ollama' && (
            <Badge
              variant={llmStatus.ollama?.ok ? 'default' : 'secondary'}
              className="text-[10px] px-1.5 py-0 h-5 font-normal"
            >
              {llmStatus.ollama?.ok
                ? `Ollama · ${llmStatus.ollama.model}`
                : 'Ollama offline'}
            </Badge>
          )}
          {llmStatus?.provider === 'rules' && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal">
              Modo regras
            </Badge>
          )}
        </div>

        <Popover open={projectPickerOpen} onOpenChange={setProjectPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="min-w-[200px] max-w-[320px] justify-between font-normal h-9"
            >
              <span className="truncate text-left">
                {selectedProject ? selectedProject.name : 'Selecionar projeto…'}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Buscar projeto..."
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <div className="max-h-[280px] overflow-y-auto p-1">
              {filteredProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => selectProject(project)}
                  className={cn(
                    'w-full text-left rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted',
                    selectedProjectId === project.id && 'bg-primary/10 text-primary'
                  )}
                >
                  <div className="font-medium truncate">{project.name}</div>
                  {project.clientName && (
                    <div className="text-xs text-muted-foreground truncate">{project.clientName}</div>
                  )}
                </button>
              ))}
              {filteredProjects.length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-4 text-center">
                  Nenhum projeto encontrado.
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <p className="text-xs text-muted-foreground hidden lg:block flex-1 min-w-0 truncate">
          Triagem → Enriquecimento → Planejamento → confirme com <strong>sim</strong>
        </p>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          {selectedProject && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/${selectedProject.id}`}>
                <FolderOpen className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Abrir projeto</span>
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={resetConversation}>
            <MessageSquarePlus className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Nova conversa</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4 min-h-0">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoadingInline size="xs" />
              {llmStatus?.ollama?.ok ? 'Gerando plano com Ollama…' : 'Processando…'}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-card/30 px-4 md:px-6 py-4">
        <div className="mx-auto max-w-3xl flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              workflow?.planning
                ? 'Digite sim para criar as tarefas...'
                : selectedProject
                  ? 'Descreva a demanda...'
                  : 'Selecione um projeto acima para começar...'
            }
            rows={2}
            disabled={!selectedProject && !workflow?.planning}
            className="min-h-[52px] max-h-32 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            className="h-[52px] w-[52px] shrink-0"
            disabled={loading || !input.trim()}
            onClick={handleSend}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
        {workflow?.planning && (
          <p className="mx-auto max-w-3xl text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Plano pronto — digite <strong>sim</strong> para criar no projeto
          </p>
        )}
      </div>
    </div>
  )
}

function ChatBubble({ role, content }: { role: 'user' | 'agent'; content: string }) {
  const isUser = role === 'user'

  const renderContent = () => {
    const parts = content.split(/(\*\*[^*]+\*\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
        return (
          <em key={i} className="text-muted-foreground not-italic text-xs">
            {part.slice(1, -1)}
          </em>
        )
      }
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (linkMatch) {
        return (
          <Link key={i} href={linkMatch[2]} className="text-primary underline underline-offset-2">
            {linkMatch[1]}
          </Link>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted/60 border border-border rounded-tl-sm'
        )}
      >
        {renderContent()}
      </div>
    </div>
  )
}

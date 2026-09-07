'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { WorkspaceCompactCard, WorkspacePage } from '@/components/workspace/WorkspacePage'
import { CreateTaskModal } from '@/components/scrum/CreateTaskModal'
import type { WorkspaceDTO } from '@/lib/workspace-utils'
import { cn } from '@/lib/utils'
import { priorityLabel, statusLabel } from '@/lib/pipeline/task-utils'
import toast from 'react-hot-toast'

type DraftTask = {
  id: string
  title: string
  description?: string | null
  status: string
  priority: string
  updatedAt?: string
  createdAt?: string
  project: { id: string; name: string }
  assignee?: { id: string; name: string; avatar?: string | null } | null
}

type Tab = 'pending' | 'approved'

export function WorkspaceDraftsView({ slug: slugProp }: { slug: string }) {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const slug = slugProp || String(params.slug || '')

  const [workspace, setWorkspace] = useState<WorkspaceDTO | null>(null)
  const [pending, setPending] = useState<DraftTask[]>([])
  const [approved, setApproved] = useState<DraftTask[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('pending')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>()
  const [editingTask, setEditingTask] = useState<DraftTask | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const loadDrafts = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${slug}/drafts`)
      if (!res.ok) throw new Error('Falha ao carregar rascunhos')
      const data = await res.json()
      setWorkspace(data.workspace)
      setPending(Array.isArray(data.pending) ? data.pending : [])
      setApproved(Array.isArray(data.approved) ? data.approved : [])
    } catch {
      setWorkspace(null)
      setPending([])
      setApproved([])
      toast.error('Não foi possível carregar os rascunhos')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    loadDrafts()
  }, [loadDrafts])

  useEffect(() => {
    if (searchParams.get('new') === '1' && workspace?.projects.length) {
      const firstProject = workspace.projects[0]?.project.id
      if (firstProject) {
        setSelectedProjectId(firstProject)
        setEditingTask(null)
        setModalOpen(true)
        router.replace(`/workspace/${slug}/drafts`, { scroll: false })
      }
    }
  }, [searchParams, workspace, slug, router])

  const projects = workspace?.projects ?? []

  const openCreate = (projectId?: string) => {
    const pid = projectId || projects[0]?.project.id
    if (!pid) {
      toast.error('Vincule um projeto a este espaço primeiro')
      return
    }
    setEditingTask(null)
    setSelectedProjectId(pid)
    setModalOpen(true)
  }

  const openEdit = (task: DraftTask) => {
    setEditingTask(task)
    setSelectedProjectId(task.project.id)
    setModalOpen(true)
  }

  const updateTaskStatus = async (taskId: string, status: 'DRAFT' | 'TODO') => {
    setActionId(taskId)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      toast.success(status === 'TODO' ? 'Rascunho aprovado' : 'Retornado para rascunhos')
      await loadDrafts()
      if (status === 'TODO') setTab('approved')
    } catch {
      toast.error('Erro ao atualizar tarefa')
    } finally {
      setActionId(null)
    }
  }

  const activeList = tab === 'pending' ? pending : approved

  const filteredTasks = useMemo(() => {
    if (projectFilter === 'all') return activeList
    return activeList.filter((t) => t.project.id === projectFilter)
  }, [activeList, projectFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, { projectName: string; tasks: DraftTask[] }>()
    for (const task of filteredTasks) {
      const entry = map.get(task.project.id)
      if (entry) entry.tasks.push(task)
      else map.set(task.project.id, { projectName: task.project.name, tasks: [task] })
    }
    return [...map.entries()]
  }, [filteredTasks])

  if (loading) {
    return (
      <WorkspacePage size="full">
        <p className="text-sm text-muted-foreground">Carregando rascunhos...</p>
      </WorkspacePage>
    )
  }

  return (
    <WorkspacePage size="full" className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground md:text-2xl">Rascunhos</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Registre ideias de tarefas para os projetos de {workspace?.name ?? 'este espaço'}. Aprove
            para enviar ao fluxo como &quot;A Fazer&quot; ou edite a qualquer momento.
          </p>
        </div>
        <Button className="h-9 shrink-0" onClick={() => openCreate()} disabled={projects.length === 0}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nova ideia
        </Button>
      </div>

      {projects.length === 0 ? (
        <WorkspaceCompactCard className="p-8 text-center">
          <Pencil className="mx-auto mb-3 h-9 w-9 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Nenhum projeto neste espaço.{' '}
            <Link href="/settings/workspaces" className="font-medium text-foreground underline underline-offset-2">
              Vincule projetos
            </Link>{' '}
            para começar a registrar rascunhos.
          </p>
        </WorkspaceCompactCard>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => setTab('pending')}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
                  tab === 'pending'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                Pendentes
                <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] tabular-nums">
                  {pending.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTab('approved')}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
                  tab === 'approved'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Aprovados
                <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] tabular-nums">
                  {approved.length}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="h-8 w-[200px] text-xs">
                  <SelectValue placeholder="Todos os projetos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os projetos</SelectItem>
                  {projects.map(({ project }) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {grouped.length === 0 ? (
            <WorkspaceCompactCard className="flex flex-col items-center gap-3 p-10 text-center">
              <Pencil className="h-9 w-9 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {tab === 'pending' ? 'Nenhum rascunho pendente' : 'Nenhum rascunho aprovado ainda'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tab === 'pending'
                    ? 'Crie uma nova ideia de tarefa para o time avaliar.'
                    : 'Aprove rascunhos pendentes para vê-los aqui como tarefas prontas.'}
                </p>
              </div>
              {tab === 'pending' && (
                <Button size="sm" onClick={() => openCreate()}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Criar rascunho
                </Button>
              )}
            </WorkspaceCompactCard>
          ) : (
            <div className="space-y-4">
              {grouped.map(([projectId, { projectName, tasks: projectTasks }]) => (
                <WorkspaceCompactCard key={projectId} className="overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-2.5">
                    <h2 className="text-sm font-semibold text-foreground">{projectName}</h2>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => openCreate(projectId)}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Adicionar
                    </Button>
                  </div>
                  <div className="divide-y divide-border">
                    {projectTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <button
                          type="button"
                          onClick={() => openEdit(task)}
                          className="min-w-0 flex-1 text-left transition-opacity hover:opacity-80"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{task.title}</p>
                            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {statusLabel(task.status)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {priorityLabel(task.priority)}
                            </span>
                          </div>
                          {task.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {task.description.replace(/<[^>]+>/g, '').slice(0, 160)}
                            </p>
                          )}
                          {task.assignee && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Responsável: {task.assignee.name}
                            </p>
                          )}
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => openEdit(task)}
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            Editar
                          </Button>
                          {tab === 'pending' ? (
                            <Button
                              size="sm"
                              className="h-8 text-xs"
                              disabled={actionId === task.id}
                              onClick={() => updateTaskStatus(task.id, 'TODO')}
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Aprovar
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 text-xs"
                              disabled={actionId === task.id}
                              onClick={() => updateTaskStatus(task.id, 'DRAFT')}
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              Reabrir
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            asChild
                          >
                            <Link href={`/projects/${task.project.id}?task=${task.id}`}>
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </WorkspaceCompactCard>
              ))}
            </div>
          )}
        </>
      )}

      <CreateTaskModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingTask(null)
        }}
        projectId={selectedProjectId}
        defaultStatus="DRAFT"
        editingTask={editingTask as any}
        onSuccess={() => {
          setModalOpen(false)
          setEditingTask(null)
          loadDrafts()
        }}
      />
    </WorkspacePage>
  )
}

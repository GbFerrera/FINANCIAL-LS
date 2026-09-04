"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import { Archive, ArchiveRestore } from "lucide-react"
import { KanbanBoard } from "@/components/projects/KanbanBoard"
import { PipelineHeader } from "@/components/pipeline/PipelineHeader"
import { PipelineListView } from "@/components/pipeline/PipelineListView"
import { PipelineTableView } from "@/components/pipeline/PipelineTableView"
import { PipelineCalendarView } from "@/components/pipeline/PipelineCalendarView"
import { PipelineTimelineView } from "@/components/pipeline/PipelineTimelineView"
import { TaskFilterBadges } from "@/components/tasks/TaskFiltersPanel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ProjectCreateTaskModal } from "@/components/projects/ProjectCreateTaskModal"
import { LoadingAnimation, LoadingInline, LoadingScreen, PageLoadingGate } from '@/components/ui/loading-animation'
import {
  EMPTY_TASK_FILTERS,
  TaskFilterState,
  UNASSIGNED_ASSIGNEE,
  searchParamsToTaskFilters,
  taskFiltersToSearchParams,
} from "@/lib/task-filters"
import { PipelineTask, PipelineViewMode } from "@/lib/pipeline/types"
import { useTaskUpdates } from "@/hooks/useTaskUpdates"
import { OPEN_TASK_EVENT } from "@/lib/active-task-view"
import { applyPipelineTaskEvent } from "@/lib/task-socket-client"
import type { TaskUpdateEvent } from "@/lib/task-socket-types"

type ProjectOption = { id: string; name: string }
type MilestoneOption = { id: string; name: string }

const VALID_VIEWS: PipelineViewMode[] = ["list", "board", "calendar", "table", "timeline"]

function parseView(raw: string | null): PipelineViewMode {
  if (raw && VALID_VIEWS.includes(raw as PipelineViewMode)) return raw as PipelineViewMode
  return "board"
}

function PipelinePageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [taskFilters, setTaskFilters] = useState<TaskFilterState>(EMPTY_TASK_FILTERS)
  const [view, setView] = useState<PipelineViewMode>("board")
  const [filterUsers, setFilterUsers] = useState<{ id: string; label: string }[]>([])
  const [filterSprints, setFilterSprints] = useState<{ id: string; label: string }[]>([])
  const [filterMilestones, setFilterMilestones] = useState<{ id: string; label: string }[]>([])
  const [tasks, setTasks] = useState<PipelineTask[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [createPickOpen, setCreatePickOpen] = useState(false)
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [createProjectId, setCreateProjectId] = useState("")
  const [createMilestones, setCreateMilestones] = useState<MilestoneOption[]>([])
  const [editTaskOpen, setEditTaskOpen] = useState(false)
  const [editProjectId, setEditProjectId] = useState("")
  const [editMilestones, setEditMilestones] = useState<MilestoneOption[]>([])
  const [editingTask, setEditingTask] = useState<any>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [archiveLoading, setArchiveLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() || "")
    const legacyId = params.get("projectId")
    if (legacyId && !params.get("projectIds")) {
      params.set("projectIds", legacyId)
    }
    setTaskFilters(searchParamsToTaskFilters(params))
    setView(parseView(params.get("view")))
    setShowArchived(params.get("archivedOnly") === "true")
  }, [searchParams])

  const fetchProjects = async (): Promise<ProjectOption[]> => {
    const res = await fetch("/api/projects?limit=1000&page=1", { method: "GET" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({} as { error?: string }))
      throw new Error(err.error || "Falha ao buscar projetos")
    }
    const data = await res.json().catch(() => ({} as { projects?: unknown }))
    const list: ProjectOption[] = (Array.isArray((data as any).projects) ? ((data as any).projects as any[]) : []).map(
      (p: any) => ({ id: String(p.id), name: String(p.name) })
    )
    setProjects(list)
    return list
  }

  const fetchTasks = async (filters: TaskFilterState) => {
    const params = taskFiltersToSearchParams(filters)
    if (showArchived) params.set("archivedOnly", "true")
    const qs = params.toString() ? `?${params.toString()}` : ""
    const res = await fetch(`/api/tasks${qs}`, { method: "GET" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({} as { error?: string }))
      throw new Error(err.error || "Falha ao buscar tarefas")
    }
    const data = await res.json().catch(() => ({} as { tasks?: PipelineTask[] }))
    setTasks(Array.isArray(data.tasks) ? (data.tasks as PipelineTask[]) : [])
  }

  const fetchFilterOptions = async (projectList: ProjectOption[]) => {
    const [teamRes, sprintsRes] = await Promise.all([
      fetch("/api/team?limit=200"),
      fetch("/api/sprints/all"),
    ])

    if (teamRes.ok) {
      const teamData = await teamRes.json().catch(() => ({} as { users?: { id: string; name: string }[] }))
      const users = Array.isArray(teamData.users) ? teamData.users : []
      setFilterUsers(users.map((u) => ({ id: u.id, label: u.name })))
    }

    if (sprintsRes.ok) {
      const sprintsData = await sprintsRes.json().catch(() => [])
      const list = Array.isArray(sprintsData) ? sprintsData : []
      setFilterSprints(list.map((s: { id: string; name: string }) => ({ id: s.id, label: s.name })))
    }

    const projectIds =
      taskFilters.projectIds.length > 0 ? taskFilters.projectIds : projectList.map((p) => p.id)

    if (projectIds.length === 0) {
      setFilterMilestones([])
      return
    }

    const milestoneResults = await Promise.all(
      projectIds.map((id) =>
        fetch(`/api/projects/${id}/milestones`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => [])
      )
    )

    const milestoneMap = new Map<string, string>()
    milestoneResults.flat().forEach((m: { id: string; name: string }) => {
      if (m?.id && m?.name) milestoneMap.set(m.id, m.name)
    })
    setFilterMilestones([...milestoneMap.entries()].map(([id, label]) => ({ id, label })))
  }

  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/auth/signin")
      return
    }

    let cancelled = false
    const run = async () => {
      try {
        setInitialLoading(true)
        const list = await fetchProjects()
        if (!cancelled) {
          await fetchFilterOptions(list)
          await fetchTasks(taskFilters)
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao carregar pipeline")
      } finally {
        if (!cancelled) setInitialLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [session, status])

  useEffect(() => {
    if (status !== "authenticated") return
    if (initialLoading) return
    fetchTasks(taskFilters).catch((e) =>
      toast.error(e instanceof Error ? e.message : "Erro ao carregar tarefas")
    )
  }, [taskFilters, status, initialLoading, showArchived])

  useEffect(() => {
    if (status !== "authenticated" || initialLoading || projects.length === 0) return
    fetchFilterOptions(projects).catch(() => {})
  }, [taskFilters.projectIds, projects, status, initialLoading])

  const isAdmin = session?.user?.role === "ADMIN"

  const filterLabelMap = useMemo(() => {
    const map: Record<string, string> = {}
    filterUsers.forEach((u) => {
      map[u.id] = u.label
    })
    projects.forEach((p) => {
      map[p.id] = p.name
    })
    filterSprints.forEach((s) => {
      map[s.id] = s.label
    })
    filterMilestones.forEach((m) => {
      map[m.id] = m.label
    })
    map[UNASSIGNED_ASSIGNEE] = "Sem responsável"
    return map
  }, [filterUsers, projects, filterSprints, filterMilestones])

  const handleRemoteTaskUpdate = useCallback((event: TaskUpdateEvent) => {
    setTasks((prev) => applyPipelineTaskEvent(prev, event))

    if (event.task && editingTask?.id === event.taskId) {
      setEditingTask((prev: { id: string; title?: string; priority?: string; status?: string; startDate?: string | null; dueDate?: string | null } | null) =>
        prev
          ? {
              ...prev,
              title: event.task!.title,
              priority: event.task!.priority,
              status: event.task!.status,
              ...(event.task!.startDate !== undefined && {
                startDate: event.task!.startDate
                  ? event.task!.startDate.split('T')[0]
                  : null,
              }),
              ...(event.task!.dueDate !== undefined && {
                dueDate: event.task!.dueDate
                  ? event.task!.dueDate.split('T')[0]
                  : null,
              }),
            }
          : prev
      )
    }
  }, [editingTask?.id])

  useTaskUpdates({
    joinPipeline: true,
    enabled: status === "authenticated",
    onTaskUpdate: handleRemoteTaskUpdate,
  })

  const syncURL = (nextFilters: TaskFilterState, nextView: PipelineViewMode, archived: boolean) => {
    const params = taskFiltersToSearchParams(nextFilters)
    if (nextView !== "board") params.set("view", nextView)
    if (archived) params.set("archivedOnly", "true")
    const qs = params.toString()
    router.replace(qs ? `/pipeline?${qs}` : "/pipeline")
  }

  const handleFiltersChange = (next: TaskFilterState) => {
    setTaskFilters(next)
    syncURL(next, view, showArchived)
  }

  const handleViewChange = (next: PipelineViewMode) => {
    setView(next)
    syncURL(taskFilters, next, showArchived)
  }

  const clearAllFilters = () => {
    setTaskFilters(EMPTY_TASK_FILTERS)
    syncURL(EMPTY_TASK_FILTERS, view, showArchived)
  }

  const toggleArchivedView = () => {
    const next = !showArchived
    setShowArchived(next)
    setSelectionMode(false)
    setSelectedTaskIds([])
    syncURL(taskFilters, view, next)
  }

  const clearSelection = () => setSelectedTaskIds([])

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => {
      if (prev) setSelectedTaskIds([])
      return !prev
    })
  }

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => (prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]))
  }

  const isSelectableTask = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId)
    if (!task) return false
    if (showArchived) return true
    return task.status === "COMPLETED" || task.status === "DONE"
  }

  const selectAllVisibleTasks = () => {
    setSelectedTaskIds(
      tasks
        .filter((task) => (showArchived ? true : task.status === "COMPLETED" || task.status === "DONE"))
        .map((task) => task.id)
    )
  }

  const startArchiveSelection = () => {
    setSelectionMode(true)
    setSelectedTaskIds([])
  }

  const fetchMilestones = async (projectId: string) => {
    const res = await fetch(`/api/projects/${projectId}/milestones`, { method: "GET" })
    if (!res.ok) return []
    const data = await res.json().catch(() => [])
    return Array.isArray(data) ? (data as MilestoneOption[]) : []
  }

  const openCreateForProject = async (projectId: string) => {
    setCreateProjectId(projectId)
    setCreateMilestones([])
    setCreateTaskOpen(true)
    setCreateMilestones(await fetchMilestones(projectId).catch(() => []))
  }

  const openCreate = () => {
    if (taskFilters.projectIds.length === 1) {
      openCreateForProject(taskFilters.projectIds[0])
      return
    }
    setCreatePickOpen(true)
  }

  const handleTaskUpdate = async (taskId: string, newStatus: string) => {
    if (newStatus === "COMPLETED" && !isAdmin) {
      toast.error("Apenas administradores podem marcar tarefas como concluídas")
      return
    }
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({} as { error?: string }))
      throw new Error(err.error || "Erro ao atualizar status")
    }
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)))
  }

  const openEditTask = async (taskId: string, projectId: string) => {
    try {
      if (!projectId) {
        toast.error("Projeto da tarefa não encontrado")
        return
      }
      setEditProjectId(projectId)
      setEditMilestones([])
      const [taskRes, milestones] = await Promise.all([
        fetch(`/api/tasks/${taskId}`, { method: "GET" }),
        fetchMilestones(projectId).catch(() => []),
      ])
      if (!taskRes.ok) {
        const err = await taskRes.json().catch(() => ({} as { error?: string }))
        throw new Error(err.error || "Falha ao buscar detalhes da tarefa")
      }
      const full = await taskRes.json().catch(() => null)
      if (full) {
        setEditingTask({
          id: full.id,
          title: full.title,
          description: full.description ?? null,
          status: full.status,
          priority: full.priority,
          storyPoints: full.storyPoints ?? null,
          assigneeId: full.assignee?.id ?? full.assigneeId ?? null,
          milestoneId: full.milestoneId ?? full.milestone?.id ?? null,
          dueDate: full.dueDate ? new Date(full.dueDate).toISOString().split("T")[0] : null,
          startDate: full.startDate ? new Date(full.startDate).toISOString().split("T")[0] : null,
          startTime: full.startTime ?? null,
          estimatedMinutes: full.estimatedMinutes ?? null,
          hasBonus: (full as any).hasBonus ?? undefined,
        } as any)
      }
      setEditMilestones(milestones)
      setEditTaskOpen(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao abrir edição")
      setEditTaskOpen(false)
      setEditingTask(null)
    }
  }

  const handleTaskClick = (taskId: string) => {
    if (selectionMode) {
      if (isSelectableTask(taskId)) toggleTaskSelection(taskId)
      return
    }
    const task = tasks.find((t) => t.id === taskId)
    if (!task?.project?.id) {
      toast.error("Projeto da tarefa não encontrado")
      return
    }
    openEditTask(taskId, task.project.id)
  }

  useEffect(() => {
    const handler = async (event: Event) => {
      const detail = (event as CustomEvent<{ taskId: string; projectId?: string }>).detail
      if (!detail?.taskId) return

      let projectId = detail.projectId
      if (!projectId) {
        const local = tasks.find((t) => t.id === detail.taskId)
        projectId = local?.project?.id
      }
      if (!projectId) {
        const res = await fetch(`/api/tasks/${detail.taskId}`)
        if (res.ok) {
          const full = await res.json().catch(() => null)
          projectId = full?.projectId || full?.project?.id
        }
      }
      if (projectId) {
        void openEditTask(detail.taskId, projectId)
      }
    }

    window.addEventListener(OPEN_TASK_EVENT, handler)
    return () => window.removeEventListener(OPEN_TASK_EVENT, handler)
  }, [tasks])

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Excluir esta tarefa permanentemente? Esta ação não pode ser desfeita.")) return

    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({} as { error?: string }))
      if (!res.ok) throw new Error(data.error || "Erro ao excluir tarefa")

      toast.success("Tarefa excluída")
      if (editingTask?.id === taskId) {
        setEditTaskOpen(false)
        setEditingTask(null)
      }
      await fetchTasks(taskFilters)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir tarefa")
    }
  }

  const handleArchiveSingleTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (task && task.status !== "COMPLETED" && task.status !== "DONE") {
      toast.error("Apenas tarefas concluídas podem ser arquivadas")
      return
    }
    if (!confirm("Arquivar esta tarefa? Ela sairá do quadro ativo.")) return

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: true }),
      })
      const data = await res.json().catch(() => ({} as { error?: string }))
      if (!res.ok) throw new Error(data.error || "Erro ao arquivar tarefa")

      toast.success("Tarefa arquivada")
      if (editingTask?.id === taskId) {
        setEditTaskOpen(false)
        setEditingTask(null)
      }
      await fetchTasks(taskFilters)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao arquivar tarefa")
    }
  }

  const handleRestoreSingleTask = async (taskId: string) => {
    if (!confirm("Restaurar esta tarefa para o quadro ativo?")) return

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: false }),
      })
      const data = await res.json().catch(() => ({} as { error?: string }))
      if (!res.ok) throw new Error(data.error || "Erro ao restaurar tarefa")

      toast.success("Tarefa restaurada")
      if (editingTask?.id === taskId) {
        setEditTaskOpen(false)
        setEditingTask(null)
      }
      await fetchTasks(taskFilters)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao restaurar tarefa")
    }
  }

  const handleArchiveTasks = async (scope: "selected" | "completed", archived: boolean) => {
    if (scope === "selected" && selectedTaskIds.length === 0) {
      toast.error("Selecione ao menos uma tarefa")
      return
    }
    try {
      setArchiveLoading(true)
      const response = await fetch("/api/tasks/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          archived,
          taskIds: scope === "selected" ? selectedTaskIds : undefined,
          projectIds: taskFilters.projectIds,
        }),
      })
      const data = await response.json().catch(() => ({} as { error?: string; updatedCount?: number; skippedCount?: number }))
      if (!response.ok) throw new Error(data.error || "Erro ao atualizar arquivamento das tarefas")
      clearSelection()
      if (scope === "selected") setSelectionMode(false)
      const updatedCount = Number(data.updatedCount || 0)
      if (updatedCount > 0) {
        toast.success(archived ? `${updatedCount} tarefa(s) arquivada(s)` : `${updatedCount} tarefa(s) restaurada(s)`)
      } else {
        toast(data.message || "Nenhuma tarefa elegível encontrada")
      }
      await fetchTasks(taskFilters)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao arquivar tarefas")
    } finally {
      setArchiveLoading(false)
    }
  }

  return (
    <PageLoadingGate loading={status === "loading" || initialLoading} fillHeight>
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-5 md:px-8">
      <PipelineHeader
        taskCount={tasks.length}
        view={view}
        onViewChange={handleViewChange}
        filters={taskFilters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={clearAllFilters}
        filterOptions={{
          users: filterUsers,
          projects: projects.map((p) => ({ id: p.id, label: p.name })),
          sprints: filterSprints,
          milestones: filterMilestones,
          showModuleFilter: true,
        }}
        onAddTask={openCreate}
        showArchived={showArchived}
        onToggleArchived={toggleArchivedView}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden pb-4 pt-2">
        <div className="shrink-0 px-1">
          <TaskFilterBadges filters={taskFilters} onChange={handleFiltersChange} labels={filterLabelMap} />
        </div>

        {selectionMode && view === "board" && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 mx-1">
            <Button variant="outline" size="sm" onClick={selectAllVisibleTasks} disabled={tasks.length === 0}>
              Selecionar todas
            </Button>
            <Button variant="outline" size="sm" onClick={clearSelection} disabled={selectedTaskIds.length === 0}>
              Limpar seleção
            </Button>
            <Badge variant="secondary">{selectedTaskIds.length} selecionada(s)</Badge>
            <Button variant="outline" size="sm" onClick={toggleSelectionMode}>
              Cancelar seleção
            </Button>
            {selectedTaskIds.length > 0 && (
              <Button size="sm" onClick={() => handleArchiveTasks("selected", !showArchived)} disabled={archiveLoading}>
                {showArchived ? <ArchiveRestore className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
                {showArchived ? "Restaurar selecionadas" : "Arquivar selecionadas"}
              </Button>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-hidden px-1">
        {view === "list" && (
          <PipelineListView tasks={tasks} onTaskClick={handleTaskClick} onAddTask={openCreate} className="h-full" />
        )}

        {view === "board" && (
          <KanbanBoard
            className="h-full"
            tasks={tasks as any}
            onTaskUpdate={handleTaskUpdate}
            onTaskClick={handleTaskClick}
            onTaskDelete={isAdmin ? handleDeleteTask : undefined}
            onTaskArchive={isAdmin ? handleArchiveSingleTask : undefined}
            onTaskRestore={isAdmin ? handleRestoreSingleTask : undefined}
            selectionMode={selectionMode}
            selectedTaskIds={selectedTaskIds}
            onToggleTaskSelection={toggleTaskSelection}
            disableDrag={selectionMode || showArchived}
            showArchived={showArchived}
            archiveLoading={archiveLoading}
            onArchiveCompleted={() => handleArchiveTasks("completed", true)}
            onStartArchiveSelection={startArchiveSelection}
            onToggleArchivedView={toggleArchivedView}
            canCompleteTasks={isAdmin}
          />
        )}

        {view === "calendar" && (
          <PipelineCalendarView tasks={tasks} onTaskClick={handleTaskClick} onAddTask={openCreate} className="h-full" />
        )}

        {view === "table" && <PipelineTableView tasks={tasks} onTaskClick={handleTaskClick} className="h-full" />}

        {view === "timeline" && <PipelineTimelineView tasks={tasks} onTaskClick={handleTaskClick} className="h-full" />}
        </div>
      </div>

      <Dialog open={createPickOpen} onOpenChange={setCreatePickOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Nova tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Projeto</Label>
            <Select value={createProjectId} onValueChange={setCreateProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um projeto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatePickOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!createProjectId) {
                  toast.error("Selecione um projeto")
                  return
                }
                setCreatePickOpen(false)
                openCreateForProject(createProjectId)
              }}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {createProjectId && (
        <ProjectCreateTaskModal
          isOpen={createTaskOpen}
          onClose={() => setCreateTaskOpen(false)}
          projectId={createProjectId}
          milestones={createMilestones}
          onSuccess={async () => {
            setCreateTaskOpen(false)
            await fetchTasks(taskFilters)
          }}
        />
      )}

      {editProjectId && (
        <ProjectCreateTaskModal
          isOpen={editTaskOpen}
          onClose={() => {
            setEditTaskOpen(false)
            setEditingTask(null)
          }}
          projectId={editProjectId}
          milestones={editMilestones}
          editingTask={editingTask}
          onEditingTaskSync={(patch) => {
            setEditingTask((prev) => (prev ? { ...prev, ...patch } : prev))
          }}
          onSuccess={async () => {
            await fetchTasks(taskFilters)
          }}
        />
      )}
    </div>
    </PageLoadingGate>
  )
}

export default function PipelinePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-0 items-center justify-center">
          <LoadingAnimation size="md" />
        </div>
      }
    >
      <PipelinePageContent />
    </Suspense>
  )
}

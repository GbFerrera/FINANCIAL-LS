"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import { Archive, ArchiveRestore, Filter, Plus, X } from "lucide-react"
import { KanbanBoard } from "@/components/projects/KanbanBoard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ProjectCreateTaskModal } from "@/components/projects/ProjectCreateTaskModal"

type ProjectOption = { id: string; name: string }
type MilestoneOption = { id: string; name: string }

type BoardTask = {
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
  assignee: { id: string; name: string; email: string; avatar: string | null } | null
  milestone: { id: string; name: string; status: string } | null
  project: { id: string; name: string }
}

export default function PipelinePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([])
  const [tasks, setTasks] = useState<BoardTask[]>([])
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
  const [projectSearch, setProjectSearch] = useState("")

  useEffect(() => {
    const rawIds = searchParams?.get("projectIds")
    const legacyId = searchParams?.get("projectId")
    const ids = rawIds
      ? rawIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : legacyId
        ? [legacyId]
        : []
    setSelectedProjectIds(ids)

    const rawStatuses = searchParams?.get("statuses")
    const statuses = rawStatuses
      ? rawStatuses
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : []
    setSelectedStatuses(statuses)

    const rawPriorities = searchParams?.get("priorities")
    const priorities = rawPriorities
      ? rawPriorities
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : []
    setSelectedPriorities(priorities)
  }, [searchParams])

  const fetchProjects = async () => {
    const res = await fetch("/api/projects?limit=1000&page=1", { method: "GET" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({} as { error?: string }))
      throw new Error(err.error || "Falha ao buscar projetos")
    }
    const data = await res.json().catch(() => ({} as { projects?: unknown }))
    const list: any[] = Array.isArray((data as any).projects) ? ((data as any).projects as any[]) : []
    setProjects(list.map((p: any) => ({ id: String(p.id), name: String(p.name) })))
  }

  const fetchTasks = async (
    projectIds: string[],
    statuses: string[] = [],
    priorities: string[] = []
  ) => {
    const params = new URLSearchParams()
    if (projectIds.length > 0) {
      params.set("projectIds", projectIds.join(","))
    }
    if (statuses.length > 0) {
      params.set("statuses", statuses.join(","))
    }
    if (priorities.length > 0) {
      params.set("priorities", priorities.join(","))
    }
    if (showArchived) {
      params.set("archivedOnly", "true")
    }
    const qs = params.toString() ? `?${params.toString()}` : ""
    const res = await fetch(`/api/tasks${qs}`, { method: "GET" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({} as { error?: string }))
      throw new Error(err.error || "Falha ao buscar tarefas")
    }
    const data = await res.json().catch(() => ({} as { tasks?: BoardTask[] }))
    setTasks(Array.isArray(data.tasks) ? data.tasks : [])
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
        await fetchProjects()
        if (!cancelled) await fetchTasks(selectedProjectIds, selectedStatuses, selectedPriorities)
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
    let cancelled = false
    const run = async () => {
      try {
        await fetchTasks(selectedProjectIds, selectedStatuses, selectedPriorities)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao carregar tarefas")
      } finally {
        if (cancelled) return
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [selectedProjectIds, selectedStatuses, selectedPriorities, status, initialLoading, showArchived])

  const mappedTasks = useMemo(() => {
    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      project: t.project,
      dueDate: t.dueDate,
      estimatedMinutes: t.estimatedMinutes,
      startDate: t.startDate,
      startTime: t.startTime,
      endTime: t.endTime,
      assignee: t.assignee,
      milestone: t.milestone,
    }))
  }, [tasks])

  const isAdmin = session?.user?.role === "ADMIN"

  const STATUS_OPTIONS = [
    { value: "TODO", label: "A Fazer" },
    { value: "IN_PROGRESS", label: "Em Andamento" },
    { value: "IN_REVIEW", label: "Em Teste" },
    { value: "COMPLETED", label: "Concluído" },
  ] as const

  const PRIORITY_OPTIONS = [
    { value: "LOW", label: "Baixa" },
    { value: "MEDIUM", label: "Média" },
    { value: "HIGH", label: "Alta" },
    { value: "URGENT", label: "Urgente" },
  ] as const

  const activeFilterCount =
    selectedProjectIds.length + selectedStatuses.length + selectedPriorities.length

  const availableProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase()
    return projects
      .filter((p) => !selectedProjectIds.includes(p.id))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  }, [projects, selectedProjectIds, projectSearch])

  const selectedProjectBadges = useMemo(() => {
    return selectedProjectIds
      .map((id) => projects.find((p) => p.id === id))
      .filter(Boolean) as ProjectOption[]
  }, [projects, selectedProjectIds])

  const syncURL = (opts: {
    projectIds?: string[]
    statuses?: string[]
    priorities?: string[]
  }) => {
    const pIds = opts.projectIds ?? selectedProjectIds
    const sts = opts.statuses ?? selectedStatuses
    const prs = opts.priorities ?? selectedPriorities
    const params = new URLSearchParams()
    if (pIds.length > 0) params.set("projectIds", pIds.join(","))
    if (sts.length > 0) params.set("statuses", sts.join(","))
    if (prs.length > 0) params.set("priorities", prs.join(","))
    const qs = params.toString()
    router.replace(qs ? `/pipeline?${qs}` : "/pipeline")
  }

  const addProjectFilter = (projectId: string) => {
    if (!projectId || selectedProjectIds.includes(projectId)) return
    setSelectedProjectIds((prev) => {
      const next = [...prev, projectId]
      syncURL({ projectIds: next })
      return next
    })
  }

  const removeProjectFilter = (projectId: string) => {
    setSelectedProjectIds((prev) => {
      const next = prev.filter((id) => id !== projectId)
      syncURL({ projectIds: next })
      return next
    })
  }

  const clearProjectFilters = () => {
    setSelectedProjectIds([])
    syncURL({ projectIds: [] })
  }

  const toggleStatus = (statusValue: string) => {
    setSelectedStatuses((prev) => {
      const next = prev.includes(statusValue) ? prev.filter((s) => s !== statusValue) : [...prev, statusValue]
      syncURL({ statuses: next })
      return next
    })
  }

  const togglePriority = (priority: string) => {
    setSelectedPriorities((prev) => {
      const next = prev.includes(priority) ? prev.filter((p) => p !== priority) : [...prev, priority]
      syncURL({ priorities: next })
      return next
    })
  }

  const clearAllFilters = () => {
    setSelectedProjectIds([])
    setSelectedStatuses([])
    setSelectedPriorities([])
    router.replace("/pipeline")
  }

  const clearSelection = () => {
    setSelectedTaskIds([])
  }

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => {
      const next = !prev
      if (!next) {
        setSelectedTaskIds([])
      }
      return next
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

  const toggleArchivedView = () => {
    setShowArchived((prev) => !prev)
    setSelectionMode(false)
    setSelectedTaskIds([])
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
    const ms = await fetchMilestones(projectId).catch(() => [])
    setCreateMilestones(ms)
  }

  const openCreate = () => {
    if (selectedProjectIds.length === 1) {
      openCreateForProject(selectedProjectIds[0])
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
      setEditingTask(null)
      setEditTaskOpen(true)

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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao abrir edição")
      setEditTaskOpen(false)
    }
  }

  const handleTaskClick = (taskId: string) => {
    if (selectionMode) {
      if (isSelectableTask(taskId)) {
        toggleTaskSelection(taskId)
      }
      return
    }
    const task = tasks.find((t) => t.id === taskId)
    if (!task?.project?.id) {
      toast.error("Projeto da tarefa não encontrado")
      return
    }
    openEditTask(taskId, task.project.id)
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
          projectIds: selectedProjectIds,
        }),
      })

      const data = await response.json().catch(() => ({} as { error?: string; updatedCount?: number; skippedCount?: number }))
      if (!response.ok) {
        throw new Error(data.error || "Erro ao atualizar arquivamento das tarefas")
      }

      clearSelection()
      if (scope === "selected") {
        setSelectionMode(false)
      }

      const updatedCount = Number(data.updatedCount || 0)
      const skippedCount = Number(data.skippedCount || 0)
      if (updatedCount > 0) {
        toast.success(
          archived
            ? `${updatedCount} tarefa(s) arquivada(s) com sucesso`
            : `${updatedCount} tarefa(s) restaurada(s) com sucesso`
        )
      } else {
        toast(data.message || "Nenhuma tarefa elegível encontrada")
      }

      if (skippedCount > 0) {
        toast(`${skippedCount} tarefa(s) não puderam ser processadas`)
      }

      await fetchTasks(selectedProjectIds, selectedStatuses, selectedPriorities)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao arquivar tarefas")
    } finally {
      setArchiveLoading(false)
    }
  }

  if (status === "loading" || initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-card shadow rounded-lg p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              {showArchived ? "Tarefas concluídas arquivadas" : "Kanban geral de todas as tarefas"}
            </p>
          </div>
          <div className="w-full sm:w-auto flex items-center gap-2 flex-wrap justify-end">
            <Popover modal={false}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="whitespace-nowrap gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 px-1.5">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[380px] p-0 z-[200]">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <span className="text-sm font-semibold">Filtrar tarefas</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={clearAllFilters}
                    disabled={activeFilterCount === 0}
                  >
                    Limpar tudo
                  </Button>
                </div>
                <div className="max-h-[min(420px,70vh)] overflow-y-auto p-4 space-y-5">
                  <section>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Projetos
                      </h3>
                      {selectedProjectIds.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={clearProjectFilters}
                        >
                          Limpar
                        </Button>
                      )}
                    </div>
                    <div className="space-y-3">
                      <Input
                        placeholder="Buscar projeto..."
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        className="h-9"
                      />
                      <div className="rounded-md border max-h-44 overflow-y-auto">
                        {availableProjects.length === 0 ? (
                          <p className="p-3 text-sm text-muted-foreground text-center">
                            {projects.length === 0
                              ? "Sem projetos cadastrados"
                              : selectedProjectIds.length === projects.length
                                ? "Todos os projetos já estão no filtro"
                                : projectSearch.trim()
                                  ? "Nenhum projeto com esse nome — limpe a busca"
                                  : "Nenhum projeto disponível"}
                          </p>
                        ) : (
                          availableProjects.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-b-0 transition-colors"
                              onClick={() => addProjectFilter(p.id)}
                            >
                              {p.name}
                            </button>
                          ))
                        )}
                      </div>
                      {selectedProjectBadges.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedProjectBadges.map((p) => (
                            <Badge
                              key={p.id}
                              variant="secondary"
                              className="pl-2 pr-1 py-1 gap-1 font-normal max-w-full"
                            >
                              <span className="truncate max-w-[220px]">{p.name}</span>
                              <button
                                type="button"
                                className="rounded-sm p-0.5 hover:bg-muted-foreground/20 shrink-0"
                                aria-label={`Remover ${p.name}`}
                                onClick={() => removeProjectFilter(p.id)}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      {selectedProjectIds.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Nenhum projeto selecionado — exibe todos.
                        </p>
                      )}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Prioridade
                    </h3>
                    <div className="space-y-2">
                      {PRIORITY_OPTIONS.map((opt) => {
                        const checked = selectedPriorities.includes(opt.value)
                        return (
                          <div key={opt.value} className="flex items-center gap-2">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => togglePriority(opt.value)}
                              id={`filter-priority-${opt.value}`}
                            />
                            <Label
                              htmlFor={`filter-priority-${opt.value}`}
                              className="text-sm cursor-pointer font-normal"
                            >
                              {opt.label}
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Status
                    </h3>
                    <div className="space-y-2">
                      {STATUS_OPTIONS.map((opt) => {
                        const checked = selectedStatuses.includes(opt.value)
                        return (
                          <div key={opt.value} className="flex items-center gap-2">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleStatus(opt.value)}
                              id={`filter-status-${opt.value}`}
                            />
                            <Label
                              htmlFor={`filter-status-${opt.value}`}
                              className="text-sm cursor-pointer font-normal"
                            >
                              {opt.label}
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                </div>
              </PopoverContent>
            </Popover>
            <Button onClick={openCreate} className="whitespace-nowrap">
              <Plus className="h-4 w-4 mr-2" />
              Nova tarefa
            </Button>
          </div>
        </div>
        {selectionMode && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllVisibleTasks}
              disabled={tasks.length === 0 || selectedTaskIds.length === tasks.length}
            >
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
              <Button
                size="sm"
                onClick={() => handleArchiveTasks("selected", !showArchived)}
                disabled={archiveLoading}
              >
                {showArchived ? <ArchiveRestore className="h-4 w-4 mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
                {showArchived ? "Restaurar selecionadas" : "Arquivar selecionadas"}
              </Button>
            )}
          </div>
        )}
      </div>

      <KanbanBoard
        tasks={mappedTasks as any}
        onTaskUpdate={handleTaskUpdate}
        onTaskClick={handleTaskClick}
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
            await fetchTasks(selectedProjectIds, selectedStatuses, selectedPriorities)
          }}
        />
      )}

      {editProjectId && (
        <ProjectCreateTaskModal
          isOpen={editTaskOpen}
          onClose={() => setEditTaskOpen(false)}
          projectId={editProjectId}
          milestones={editMilestones}
          editingTask={editingTask}
          onSuccess={async () => {
            setEditTaskOpen(false)
            await fetchTasks(selectedProjectIds, selectedStatuses, selectedPriorities)
          }}
        />
      )}
    </div>
  )
}

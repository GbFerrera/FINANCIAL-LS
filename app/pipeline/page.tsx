"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import { Plus } from "lucide-react"
import { KanbanBoard } from "@/components/projects/KanbanBoard"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
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

  const fetchTasks = async (projectIds: string[]) => {
    const qs =
      projectIds.length > 0
        ? `?projectIds=${encodeURIComponent(projectIds.join(","))}`
        : ""
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
        if (!cancelled) await fetchTasks(selectedProjectIds)
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
        await fetchTasks(selectedProjectIds)
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
  }, [selectedProjectIds, status, initialLoading])

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

  const filterLabel = useMemo(() => {
    if (selectedProjectIds.length === 0) return "Todos os projetos"
    if (selectedProjectIds.length === 1) {
      const p = projects.find((x) => x.id === selectedProjectIds[0])
      return p?.name || "1 projeto"
    }
    return `${selectedProjectIds.length} projetos`
  }, [projects, selectedProjectIds])

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds((prev) => {
      const next = prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
      const url = next.length > 0 ? `/pipeline?projectIds=${encodeURIComponent(next.join(","))}` : "/pipeline"
      router.replace(url)
      return next
    })
  }

  const clearProjects = () => {
    setSelectedProjectIds([])
    router.replace("/pipeline")
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
    const task = tasks.find((t) => t.id === taskId)
    if (!task?.project?.id) {
      toast.error("Projeto da tarefa não encontrado")
      return
    }
    openEditTask(taskId, task.project.id)
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
            <p className="text-sm text-muted-foreground">Kanban geral de todas as tarefas</p>
          </div>
          <div className="w-full sm:w-auto flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-[360px] justify-between">
                  <span className="truncate">{filterLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[360px] p-2">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-sm font-medium">Projetos</span>
                  <Button variant="ghost" size="sm" onClick={clearProjects}>
                    Limpar
                  </Button>
                </div>
                <div className="max-h-[320px] overflow-y-auto px-2 py-1 space-y-2">
                  {projects.map((p) => {
                    const checked = selectedProjectIds.includes(p.id)
                    return (
                      <div key={p.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleProject(p.id)}
                          id={`project-${p.id}`}
                        />
                        <Label htmlFor={`project-${p.id}`} className="text-sm cursor-pointer">
                          {p.name}
                        </Label>
                      </div>
                    )
                  })}
                  {projects.length === 0 && <div className="text-sm text-muted-foreground">Sem projetos</div>}
                </div>
              </PopoverContent>
            </Popover>
            <Button onClick={openCreate} className="whitespace-nowrap">
              <Plus className="h-4 w-4 mr-2" />
              Nova tarefa
            </Button>
          </div>
        </div>
      </div>

      <KanbanBoard tasks={mappedTasks as any} onTaskUpdate={handleTaskUpdate} onTaskClick={handleTaskClick} />

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
            await fetchTasks(selectedProjectIds)
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
            await fetchTasks(selectedProjectIds)
          }}
        />
      )}
    </div>
  )
}

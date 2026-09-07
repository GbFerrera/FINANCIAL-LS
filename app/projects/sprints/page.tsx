'use client'

import { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { StatsCard } from '@/components/ui/stats-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingAnimation, PageLoadingGate } from '@/components/ui/loading-animation'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel
} from '@/components/ui/alert-dialog'
import { toast } from 'react-hot-toast'
import { Calendar as UiCalendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from "@/lib/utils"
import { 
  Target, 
  Calendar as CalendarIcon, 
  Search,
  Eye,
  Trash,
  CheckCircle2,
  Plus,
  ChevronDown,
  ChevronRight,
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
} from 'lucide-react'
import Link from 'next/link'
import { format, differenceInDays, isWithinInterval, startOfDay, endOfDay, parse, startOfWeek, getDay, isSameDay, eachDayOfInterval, isWeekend, isBefore, isAfter } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CreateSprintModal } from '@/components/scrum/CreateSprintModal'
import { isSprintArchivable, sprintArchiveBlockedReason } from '@/lib/sprint-archive'
import { Calendar as RBCalendar, dateFnsLocalizer, View, Views } from 'react-big-calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface Sprint {
  id: string
  name: string
  description?: string
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  startDate: string
  endDate: string
  goal?: string
  capacity?: number
  isArchived?: boolean
  archivedAt?: string | null
  project?: {
    id: string
    name: string
    client: {
      name: string
    }
  }
  projects?: Array<{
    id: string
    name: string
    client: {
      id: string
      name: string
    }
  }>
  tasks: Array<{
    id: string
    title: string
    storyPoints?: number
    status: string
    dueDate?: string
  }>
}

type SprintEvent = {
  id: string
  title: string
  start: Date
  end: Date
  status: string
  projectId: string
}

const CustomEvent = ({ event }: { event: SprintEvent }) => {
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-xs">{event.title}</span>
      <span className="text-[10px] opacity-90">
        {format(event.start, 'dd/MM')} - {format(event.end, 'dd/MM')}
      </span>
    </div>
  )
}

function SprintsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const locales = { 'pt-BR': ptBR }
  const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
  })

  const [sprints, setSprints] = useState<Sprint[]>([])
  const [filteredSprints, setFilteredSprints] = useState<Sprint[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState((searchParams && searchParams.get('search')) || '')
  const [statusFilter, setStatusFilter] = useState<string>((searchParams && searchParams.get('status')) || 'all')
  const [showArchived, setShowArchived] = useState(false)
  const [archiveLoading, setArchiveLoading] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'mkt' | 'dev' | 'all'>('dev')
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined)
  const [showCreateSprint, setShowCreateSprint] = useState(false)
  const [showEditSprint, setShowEditSprint] = useState(false)
  const [sprintToEdit, setSprintToEdit] = useState<Sprint | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    goal: '',
    capacity: ''
  })
  const [deleteTarget, setDeleteTarget] = useState<Sprint | null>(null)
  const [expandedProjects, setExpandedProjects] = useState<string[]>([])
  const [showCalendarDialog, setShowCalendarDialog] = useState(false)
  const calendarAutoOpened = useRef(false)
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [calendarView, setCalendarView] = useState<View>(Views.MONTH)

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    )
  }

  const groupedSprints = useMemo(() => {
    const groups: Record<string, { project: any, sprints: Sprint[] }> = {}
    
    filteredSprints.forEach(sprint => {
      let assigned = false
      
      if (sprint.project) {
        assigned = true
        const pid = sprint.project.id
        if (!groups[pid]) {
          groups[pid] = { project: sprint.project, sprints: [] }
        }
        groups[pid].sprints.push(sprint)
      }
      
      if (sprint.projects && sprint.projects.length > 0) {
        assigned = true
        sprint.projects.forEach(p => {
          const pid = p.id
          if (!groups[pid]) {
            groups[pid] = { project: p, sprints: [] }
          }
          if (!groups[pid].sprints.some(s => s.id === sprint.id)) {
            groups[pid].sprints.push(sprint)
          }
        })
      }
      
      if (!assigned) {
        const pid = 'unassigned'
        if (!groups[pid]) {
          groups[pid] = { 
            project: { id: 'unassigned', name: 'Sem Projeto', client: { name: '-' } }, 
            sprints: [] 
          }
        }
        groups[pid].sprints.push(sprint)
      }
    })
    
    const arr = Object.values(groups).map(group => ({
      ...group,
      sprints: group.sprints.sort((a, b) => {
        const now = new Date()
        const aActive = a.status === 'ACTIVE' || isWithinInterval(now, { start: startOfDay(new Date(a.startDate)), end: endOfDay(new Date(a.endDate)) })
        const bActive = b.status === 'ACTIVE' || isWithinInterval(now, { start: startOfDay(new Date(b.startDate)), end: endOfDay(new Date(b.endDate)) })
        if (aActive !== bActive) return aActive ? -1 : 1
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      })
    }))
    
    return arr.sort((ga, gb) => {
      const now = new Date()
      const gaActive = ga.sprints.some(s => s.status === 'ACTIVE' || isWithinInterval(now, { start: startOfDay(new Date(s.startDate)), end: endOfDay(new Date(s.endDate)) }))
      const gbActive = gb.sprints.some(s => s.status === 'ACTIVE' || isWithinInterval(now, { start: startOfDay(new Date(s.startDate)), end: endOfDay(new Date(s.endDate)) }))
      if (gaActive !== gbActive) return gaActive ? -1 : 1
      const gaMin = Math.min(...ga.sprints.map(s => new Date(s.startDate).getTime()))
      const gbMin = Math.min(...gb.sprints.map(s => new Date(s.startDate).getTime()))
      return gaMin - gbMin
    })
  }, [filteredSprints])

  const sprintStats = useMemo(() => {
    const active = filteredSprints.filter((s) => s.status === 'ACTIVE').length
    const planning = filteredSprints.filter((s) => s.status === 'PLANNING').length
    const completed = filteredSprints.filter((s) => s.status === 'COMPLETED').length
    const projects = new Set(
      filteredSprints.flatMap((s) => [
        s.project?.id,
        ...(s.projects?.map((p) => p.id) ?? []),
      ].filter(Boolean))
    ).size
    return {
      total: filteredSprints.length,
      active,
      planning,
      completed,
      projects,
    }
  }, [filteredSprints])

  useEffect(() => {
    if (!loading && !calendarAutoOpened.current) {
      calendarAutoOpened.current = true
      setShowCalendarDialog(true)
    }
  }, [loading])

  useEffect(() => {
    if (groupedSprints.length > 0) {
      const firstId = groupedSprints[0].project.id
      setExpandedProjects(prev => {
        if (prev.includes(firstId)) return prev
        return [...prev, firstId]
      })
    }
  }, [groupedSprints])

  const sprintEvents = useMemo<SprintEvent[]>(() => {
    return filteredSprints.map(s => ({
      id: s.id,
      title: s.name,
      start: startOfDay(new Date(s.startDate)),
      end: endOfDay(new Date(s.endDate)),
      status: s.status,
      projectId: s.project?.id || (s.projects && s.projects.length > 0 ? s.projects[0].id : '')
    }))
  }, [filteredSprints])

  const eventStyleGetter = (event: SprintEvent) => {
    let className = 'border-none rounded-md text-[11px] font-medium shadow-sm'
    if (event.status === 'PLANNING') className += ' !bg-amber-500/90 !text-white'
    else if (event.status === 'ACTIVE') className += ' !bg-emerald-600/90 !text-white'
    else if (event.status === 'COMPLETED') className += ' !bg-primary/80 !text-primary-foreground'
    else if (event.status === 'CANCELLED') className += ' !bg-rose-600/90 !text-white'
    else className += ' !bg-muted-foreground/70 !text-white'
    return { className, style: { border: 'none' } }
  }

  const tasksByDate = useMemo(() => {
    const tasksPerDate: Record<string, Map<string, any>> = {}
    
    sprints.forEach(sprint => {
      if (sprint.tasks) {
        sprint.tasks.forEach(task => {
          if (task.dueDate) {
            const dateKey = format(new Date(task.dueDate), 'yyyy-MM-dd')
            if (!tasksPerDate[dateKey]) {
              tasksPerDate[dateKey] = new Map()
            }
            tasksPerDate[dateKey].set(task.id, task)
          }
        })
      }
    })
    
    // Convert maps to arrays
    const result: Record<string, any[]> = {}
    Object.keys(tasksPerDate).forEach(key => {
      result[key] = Array.from(tasksPerDate[key].values())
    })
    
    return result
  }, [sprints])

  const { components } = useMemo(() => ({
    components: {
      event: CustomEvent,
      month: {
        dateHeader: ({ date, label }: any) => {
          const dateKey = format(date, 'yyyy-MM-dd')
          const tasks = tasksByDate[dateKey] || []
          const count = tasks.length
          const isToday = isSameDay(date, new Date())
          
          return (
            <div className="flex flex-col px-1">
              <span className={`text-xs font-semibold ${isToday ? 'text-blue-600' : ''}`}>{label}</span>
              {count > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="mt-1 flex justify-center cursor-pointer hover:opacity-80 transition-opacity">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
                          {count}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="p-0 border-none bg-transparent shadow-none" sideOffset={5}>
                      <div className="bg-popover text-popover-foreground rounded-md border shadow-md p-3 w-[300px] z-50 relative">
                        <div className="font-semibold text-sm mb-2 pb-1 border-b">Tarefas ({count})</div>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {tasks.map((task: any) => (
                            <div key={task.id} className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded hover:bg-muted transition-colors border border-border/50">
                              <div className="flex flex-col min-w-0 text-left">
                                <span className="text-xs font-medium truncate">{task.title}</span>
                                <span className={
                                  task.status === 'COMPLETED' ? 'text-green-600 dark:text-green-400 text-[10px] font-medium' :
                                  task.status === 'IN_PROGRESS' ? 'text-blue-600 dark:text-blue-400 text-[10px] font-medium' :
                                  'text-amber-600 dark:text-amber-400 text-[10px] font-medium'
                                }>
                                  {task.status === 'TODO' ? 'A Fazer' :
                                   task.status === 'IN_PROGRESS' ? 'Em Progresso' :
                                   task.status === 'COMPLETED' ? 'Concluído' : task.status}
                                </span>
                              </div>
                              {task.storyPoints && (
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                                  {task.storyPoints} pts
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )
        }
      }
    }
  }), [tasksByDate])
  useEffect(() => {
    fetchSprints()
  }, [showArchived])

  useEffect(() => {
    filterSprints()
    
    // Atualizar URL com os parâmetros
    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    
    const queryString = params.toString()
    router.push(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false })
  }, [sprints, searchTerm, statusFilter])

  const fetchSprints = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true)
      const params = new URLSearchParams()
      if (showArchived) params.set('archivedOnly', 'true')
      const response = await fetch(`/api/sprints/all${params.toString() ? `?${params}` : ''}`)
      if (response.ok) {
        const data = await response.json()
        setSprints(data)
      } else {
        console.error('Erro na resposta:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Erro ao carregar sprints:', error)
    } finally {
      if (!options?.silent) setLoading(false)
    }
  }

  // --- Filtering Logic for MKT/DEV ---
  const isMktSprint = (s: Sprint) => {
    const byName = s.name.toLowerCase().includes("mkt") || s.name.startsWith("[MKT]")
    const byProject = (s.projects || []).some((p) => {
      const n = p.name.toLowerCase()
      const c = (p.client?.name || "").toLowerCase()
      return n.includes("mkt") || c.includes("software house") || c.includes("soft house")
    })
    return byName || byProject
  }

  const isDevSprint = (s: Sprint) => !isMktSprint(s)

  const filterSprints = () => {
    let filtered = sprints || []

    // 1. Filter by View Mode (MKT vs Dev vs All)
    if (viewMode === 'mkt') {
      filtered = filtered.filter(isMktSprint)
    } else if (viewMode === 'dev') {
      filtered = filtered.filter(isDevSprint)
    }
    // 'all' includes everything, so no filter needed

    // 2. Filter by Search Term
    if (searchTerm) {
      filtered = filtered.filter(sprint => {
        const searchLower = searchTerm.toLowerCase()
        return sprint.name.toLowerCase().includes(searchLower) ||
          sprint.project?.name.toLowerCase().includes(searchLower) ||
          sprint.project?.client.name.toLowerCase().includes(searchLower) ||
          (sprint.projects && sprint.projects.some(p => 
            p.name.toLowerCase().includes(searchLower) ||
            p.client.name.toLowerCase().includes(searchLower)
          ))
      })
    }

    // 3. Filter by Status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(sprint => sprint.status === statusFilter)
    }

    // 4. Filter by Date
    if (dateFilter) {
      filtered = filtered.filter(sprint => 
        isWithinInterval(dateFilter, { 
          start: startOfDay(new Date(sprint.startDate)), 
          end: endOfDay(new Date(sprint.endDate)) 
        })
      )
    }

    setFilteredSprints(filtered)
  }

  useEffect(() => {
    filterSprints()
  }, [sprints, searchTerm, statusFilter, viewMode, dateFilter])

  const openEdit = (sprint: Sprint) => {
    setSprintToEdit(sprint)
    setEditForm({
      name: sprint.name || '',
      description: sprint.description || '',
      startDate: sprint.startDate ? format(new Date(sprint.startDate), 'yyyy-MM-dd') : '',
      endDate: sprint.endDate ? format(new Date(sprint.endDate), 'yyyy-MM-dd') : '',
      goal: sprint.goal || '',
      capacity: sprint.capacity != null ? String(sprint.capacity) : ''
    })
    setShowEditSprint(true)
  }

  const submitEdit = async () => {
    if (!sprintToEdit) return
    try {
      const body = {
        name: editForm.name,
        description: editForm.description,
        startDate: editForm.startDate ? editForm.startDate + 'T12:00:00.000Z' : undefined,
        endDate: editForm.endDate ? editForm.endDate + 'T12:00:00.000Z' : undefined,
        goal: editForm.goal,
        capacity: editForm.capacity !== '' ? Number(editForm.capacity) : undefined
      }
      const res = await fetch(`/api/sprints/${sprintToEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!res.ok) throw new Error('Falha ao atualizar sprint')
      toast.success('Sprint atualizada')
      setShowEditSprint(false)
      setSprintToEdit(null)
      fetchSprints({ silent: true })
    } catch (e) {
      toast.error('Erro ao atualizar sprint')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const deletedId = deleteTarget.id
    try {
      const res = await fetch(`/api/sprints/${deletedId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao deletar sprint')
      setSprints((prev) => prev.filter((s) => s.id !== deletedId))
      toast.success('Sprint deletada')
      setDeleteTarget(null)
    } catch (e) {
      toast.error('Erro ao deletar sprint')
    }
  }

  const handleArchiveSprint = async (sprint: Sprint, archived: boolean) => {
    try {
      setArchiveLoading(sprint.id)
      const res = await fetch('/api/sprints/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sprintIds: [sprint.id], archived }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao arquivar sprint')
      if (data.updatedCount === 0) {
        toast.error(data.message || 'Sprint não elegível para arquivar')
        return
      }

      setSprints((prev) => prev.filter((s) => s.id !== sprint.id))
      toast.success(archived ? 'Sprint arquivada' : 'Sprint restaurada')
    } catch (e) {
      toast.error(archived ? 'Erro ao arquivar sprint' : 'Erro ao restaurar sprint')
    } finally {
      setArchiveLoading(null)
    }
  }

  const getSprintMetrics = (sprint: Sprint) => {
    const totalStoryPoints = sprint.tasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0)
    const completedStoryPoints = sprint.tasks
      .filter(task => task.status === 'COMPLETED')
      .reduce((sum, task) => sum + (task.storyPoints || 0), 0)
    
    const progress = totalStoryPoints > 0 ? Math.round((completedStoryPoints / totalStoryPoints) * 100) : 0
    const completedTasks = sprint.tasks.filter(t => t.status === 'COMPLETED').length
    
    return {
      totalStoryPoints,
      completedStoryPoints,
      progress,
      totalTasks: sprint.tasks.length,
      completedTasks
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return 'border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300'
      case 'ACTIVE':
        return 'border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
      case 'COMPLETED':
        return 'border-border bg-muted/60 text-foreground'
      case 'CANCELLED':
        return 'border-rose-200/80 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300'
      default:
        return 'border-border bg-muted text-muted-foreground'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return 'Planejamento'
      case 'ACTIVE':
        return 'Ativa'
      case 'COMPLETED':
        return 'Concluída'
      case 'CANCELLED':
        return 'Cancelada'
      default:
        return 'Planejamento'
    }
  }

  const getSprintTimeInfo = (sprint: Sprint) => {
    const today = startOfDay(new Date())
    const startDate = startOfDay(new Date(sprint.startDate))
    const endDate = startOfDay(new Date(sprint.endDate))
    
    // Calculate total duration (inclusive)
    let totalDays = 0
    let totalBusinessDays = 0
    
    try {
      if (startDate <= endDate) {
        const allDays = eachDayOfInterval({ start: startDate, end: endDate })
        totalDays = allDays.length
        totalBusinessDays = allDays.filter(d => !isWeekend(d)).length
      }
    } catch (e) {
      console.error('Error calculating sprint duration', e)
    }
    
    let remainingDays = 0
    let remainingBusinessDays = 0
    let statusText = ''
    let isDelayed = false
    
    if (sprint.status === 'COMPLETED' || sprint.status === 'CANCELLED') {
      return { totalDays, totalBusinessDays, statusText: null, remainingDays: 0, remainingBusinessDays: 0, isDelayed: false }
    }
    
    if (isBefore(today, startDate)) {
      const daysToStart = differenceInDays(startDate, today)
      statusText = `Inicia em ${daysToStart} dia${daysToStart !== 1 ? 's' : ''}`
    } else if (isAfter(today, endDate)) {
      const daysOverdue = differenceInDays(today, endDate)
      statusText = `Atrasada ${daysOverdue} dia${daysOverdue !== 1 ? 's' : ''}`
      isDelayed = true
    } else {
      // Active sprint (today is within start and end)
      try {
        const remainingInterval = eachDayOfInterval({ start: today, end: endDate })
        remainingDays = remainingInterval.length
        remainingBusinessDays = remainingInterval.filter(d => !isWeekend(d)).length
        statusText = `${remainingDays} dia${remainingDays !== 1 ? 's' : ''} restante${remainingDays !== 1 ? 's' : ''}`
      } catch (e) {
        console.error('Error calculating remaining days', e)
      }
    }
    
    return {
      totalDays,
      totalBusinessDays,
      remainingDays,
      remainingBusinessDays,
      statusText,
      isDelayed
    }
  }

  return (
    <PageLoadingGate loading={loading}>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {showArchived ? 'Sprints arquivadas' : 'Sprints'}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {showArchived
              ? 'Histórico de sprints concluídas ou canceladas'
              : 'Planeje ciclos, acompanhe progresso e abra o quadro de cada sprint'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border border-border/80 bg-muted/30 p-0.5">
            {(['mkt', 'dev', 'all'] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setViewMode(mode)}
                className={cn(
                  'h-8 rounded-sm px-3 text-xs font-medium text-muted-foreground',
                  viewMode === mode && 'bg-background text-foreground shadow-sm'
                )}
              >
                {mode === 'mkt' ? 'MKT' : mode === 'dev' ? 'Dev' : 'Todos'}
              </Button>
            ))}
          </div>
          <Button onClick={() => setShowCreateSprint(true)} disabled={showArchived}>
            <Plus className="mr-2 h-4 w-4" />
            Nova sprint
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard title="Sprints visíveis" value={sprintStats.total} change={{ value: `${sprintStats.projects} projetos`, type: 'neutral' }} />
        <StatsCard title="Ativas" value={sprintStats.active} change={{ value: 'Em execução', type: 'neutral' }} />
        <StatsCard title="Planejamento" value={sprintStats.planning} change={{ value: 'A iniciar', type: 'neutral' }} />
        <StatsCard title="Concluídas" value={sprintStats.completed} change={{ value: showArchived ? 'Modo arquivo' : 'Finalizadas', type: 'neutral' }} />
      </div>

      {/* Toolbar */}
      <div className="rounded-lg border border-border bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar sprint, projeto ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 border-border/80 bg-background pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-9 justify-start font-normal',
                    !dateFilter && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  {dateFilter ? format(dateFilter, 'PPP', { locale: ptBR }) : 'Filtrar por data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <UiCalendar
                  mode="single"
                  selected={dateFilter}
                  onSelect={(date) => {
                    setDateFilter(date)
                    if (date) setCalendarDate(date)
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {dateFilter && (
              <Button variant="ghost" size="icon-sm" onClick={() => setDateFilter(undefined)} aria-label="Limpar data">
                <Trash className="h-4 w-4" />
              </Button>
            )}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="PLANNING">Planejamento</SelectItem>
                <SelectItem value="ACTIVE">Ativa</SelectItem>
                <SelectItem value="COMPLETED">Concluída</SelectItem>
                <SelectItem value="CANCELLED">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showArchived ? 'default' : 'outline'}
              size="sm"
              className="h-9"
              onClick={() => setShowArchived((v) => !v)}
            >
              <Archive className="mr-2 h-4 w-4" />
              {showArchived ? 'Ver ativas' : 'Arquivadas'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setShowCalendarDialog(true)}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              Agenda
            </Button>
          </div>
        </div>
      </div>

      {dateFilter && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Tarefas em {format(dateFilter, "dd 'de' MMMM", { locale: ptBR })}
            </h3>
          </div>
          <div className="space-y-2">
            {filteredSprints.flatMap(sprint =>
              sprint.tasks
                .filter(task => task.dueDate && isSameDay(new Date(task.dueDate), dateFilter))
                .map(task => ({ ...task, sprintName: sprint.name, projectName: sprint.project?.name || 'Sem Projeto' }))
            ).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tarefa agendada para este dia.</p>
            ) : (
              filteredSprints.flatMap(sprint =>
                sprint.tasks
                  .filter(task => task.dueDate && isSameDay(new Date(task.dueDate), dateFilter))
                  .map(task => ({ ...task, sprintName: sprint.name, projectName: sprint.project?.name || 'Sem Projeto', sprintId: sprint.id, projectId: sprint.project?.id }))
              ).map(task => (
                <div key={task.id} className="flex items-center justify-between gap-3 rounded-md border border-border/80 bg-card px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {task.sprintName} · {task.projectName}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {task.storyPoints != null && (
                      <Badge variant="outline" className="text-[10px]">{task.storyPoints} SP</Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px]">
                      {task.status === 'TODO' ? 'A fazer' :
                       task.status === 'IN_PROGRESS' ? 'Em andamento' :
                       task.status === 'COMPLETED' ? 'Concluído' : task.status}
                    </Badge>
                    <Link href={`/projects/${task.projectId || 'unknown'}/scrum?sprint=${task.sprintId}`}>
                      <Button variant="ghost" size="icon-sm" aria-label="Ver sprint">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <Dialog open={showCalendarDialog} onOpenChange={setShowCalendarDialog}>
        <DialogContent className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-[96vw] flex-col gap-3 p-4 sm:max-w-[96vw]">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {viewMode === 'mkt' ? 'Calendário MKT' : viewMode === 'dev' ? 'Calendário Dev' : 'Calendário de sprints'}
            </DialogTitle>
          </DialogHeader>
          <style>{`
            .rbc-today { background-color: hsl(var(--muted) / 0.55) !important; }
            .rbc-calendar { color: hsl(var(--foreground)); font-size: 14px; height: 100% !important; }
            .rbc-off-range-bg { background-color: hsl(var(--muted) / 0.25) !important; }
            .rbc-month-view, .rbc-time-view, .rbc-agenda-view, .rbc-month-row, .rbc-day-bg, .rbc-header {
              border-color: hsl(var(--border)) !important;
            }
            .rbc-header { padding: 10px 0; font-weight: 600; font-size: 13px; }
            .rbc-toolbar button {
              color: hsl(var(--foreground));
              border-color: hsl(var(--border));
              border-radius: 6px;
              font-size: 13px;
              padding: 6px 12px;
            }
            .rbc-toolbar button:hover {
              background-color: hsl(var(--muted));
            }
            .rbc-toolbar button.rbc-active {
              background-color: hsl(var(--primary));
              color: hsl(var(--primary-foreground));
              border-color: hsl(var(--primary));
            }
            .rbc-toolbar-label { color: hsl(var(--foreground)); font-weight: 600; font-size: 16px; }
            .rbc-event { padding: 3px 6px !important; font-size: 12px; }
            .rbc-month-row { min-height: 100px; }
          `}</style>
          <div className="min-h-0 flex-1">
            <RBCalendar
              components={components}
              localizer={localizer}
              events={sprintEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              view={calendarView}
              onView={(v) => setCalendarView(v)}
              date={calendarDate}
              onNavigate={(d) => setCalendarDate(d)}
              culture="pt-BR"
              onSelectEvent={(event: SprintEvent) => {
                if (event.projectId) {
                  setShowCalendarDialog(false)
                  router.push(`/projects/${event.projectId}/scrum?sprint=${event.id}`)
                } else {
                  toast.error('Sprint sem projeto associado')
                }
              }}
              messages={{
                next: 'Próximo',
                previous: 'Anterior',
                today: 'Hoje',
                month: 'Mês',
                week: 'Semana',
                day: 'Dia',
                agenda: 'Agenda',
                date: 'Data',
                time: 'Hora',
                event: 'Sprint',
                noEventsInRange: 'Não há sprints neste período.',
                allDay: 'Dia todo'
              }}
              eventPropGetter={eventStyleGetter}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Lista por projeto */}
      <div className="space-y-3">
        {groupedSprints.map(({ project, sprints }) => {
          const isExpanded = expandedProjects.includes(project.id)

          return (
            <div key={project.id} className="overflow-hidden rounded-lg border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                onClick={() => toggleProject(project.id)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-foreground">{project.name}</h3>
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {project.client?.name || 'Sem cliente'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {sprints.length} sprint{sprints.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 text-[11px] tabular-nums">
                  {sprints.length}
                </Badge>
              </button>

              {isExpanded && (
                <div className="space-y-2 border-t border-border bg-muted/20 p-3">
                  {sprints.map((sprint) => {
                    const metrics = getSprintMetrics(sprint)
                    const timeInfo = getSprintTimeInfo(sprint)
                    const startDate = new Date(sprint.startDate)
                    const endDate = new Date(sprint.endDate)
                    const today = new Date()
                    const isCurrent = isWithinInterval(today, { start: startOfDay(startDate), end: endOfDay(endDate) })

                    return (
                      <div
                        key={sprint.id}
                        className={cn(
                          'rounded-md border border-border/80 bg-card p-3 transition-colors hover:border-border',
                          isCurrent && 'ring-1 ring-primary/20'
                        )}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <h4 className="truncate text-sm font-semibold text-foreground">{sprint.name}</h4>
                              <Badge variant="outline" className={cn('border text-[10px] font-medium', getStatusColor(sprint.status))}>
                                {getStatusLabel(sprint.status)}
                              </Badge>
                            </div>
                            {sprint.goal && (
                              <p className="mb-2 line-clamp-1 text-xs text-muted-foreground" title={sprint.goal}>
                                {sprint.goal}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <CalendarIcon className="h-3.5 w-3.5" />
                                {format(startDate, 'dd/MM', { locale: ptBR })} – {format(endDate, 'dd/MM/yyyy', { locale: ptBR })}
                              </span>
                              {timeInfo.statusText && (
                                <span className={cn(isCurrent && 'font-medium text-primary', timeInfo.isDelayed && 'text-destructive')}>
                                  {timeInfo.statusText}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="w-full min-w-[180px] lg:max-w-xs lg:flex-1">
                            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>{metrics.completedTasks}/{metrics.totalTasks} tarefas · {metrics.completedStoryPoints}/{metrics.totalStoryPoints} SP</span>
                              <span className="font-medium text-foreground">{metrics.progress}%</span>
                            </div>
                            <Progress value={metrics.progress} className="h-1.5" />
                          </div>

                          <div className="flex shrink-0 items-center justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" aria-label="Ações da sprint">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                {!showArchived && (
                                  <>
                                    <DropdownMenuItem asChild>
                                      <Link
                                        href={`/projects/${sprint.project?.id || (sprint.projects && sprint.projects[0]?.id) || 'unknown'}/scrum?sprint=${sprint.id}`}
                                        className="cursor-pointer"
                                      >
                                        <Eye className="mr-2 h-4 w-4" />
                                        Ver quadro
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openEdit(sprint)}>
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Editar
                                    </DropdownMenuItem>
                                    {(() => {
                                      const blocked = sprintArchiveBlockedReason(sprint)
                                      return (
                                        <DropdownMenuItem
                                          disabled={!!blocked || archiveLoading === sprint.id}
                                          title={blocked ?? undefined}
                                          onClick={() => {
                                            if (blocked) return
                                            handleArchiveSprint(sprint, true)
                                          }}
                                        >
                                          <Archive className="mr-2 h-4 w-4" />
                                          Arquivar
                                        </DropdownMenuItem>
                                      )
                                    })()}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => setDeleteTarget(sprint)}
                                    >
                                      <Trash className="mr-2 h-4 w-4" />
                                      Excluir
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {showArchived && (
                                  <DropdownMenuItem
                                    disabled={archiveLoading === sprint.id}
                                    onClick={() => handleArchiveSprint(sprint, false)}
                                  >
                                    <ArchiveRestore className="mr-2 h-4 w-4" />
                                    Restaurar
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filteredSprints.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <Target className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <h3 className="text-base font-medium text-foreground">
            {showArchived
              ? 'Nenhuma sprint arquivada'
              : searchTerm || statusFilter !== 'all'
                ? 'Nenhuma sprint encontrada'
                : 'Nenhuma sprint criada'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {showArchived
              ? 'Arquive sprints concluídas para organizar a lista'
              : searchTerm || statusFilter !== 'all'
                ? 'Ajuste os filtros ou limpe a busca'
                : 'Crie uma sprint ou vincule ciclos aos seus projetos'}
          </p>
          {!showArchived && !searchTerm && statusFilter === 'all' && (
            <Button className="mt-4" onClick={() => setShowCreateSprint(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova sprint
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Sprint</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá a sprint &quot;{deleteTarget?.name}&quot; e desvinculará suas tarefas. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateSprintModal
        isOpen={showCreateSprint}
        onClose={() => setShowCreateSprint(false)}
        onSuccess={() => {
          fetchSprints()
          setShowCreateSprint(false)
        }}
      />
      <Dialog open={showEditSprint} onOpenChange={setShowEditSprint}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Sprint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nome</Label>
              <Input id="edit-name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="edit-description">Descrição</Label>
              <Textarea id="edit-description" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-start">Início</Label>
                <Input id="edit-start" type="date" value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="edit-end">Fim</Label>
                <Input id="edit-end" type="date" value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-goal">Objetivo</Label>
              <Input id="edit-goal" value={editForm.goal} onChange={(e) => setEditForm({ ...editForm, goal: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="edit-capacity">Capacidade (SP)</Label>
              <Input id="edit-capacity" type="number" min="0" value={editForm.capacity} onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowEditSprint(false)}>Cancelar</Button>
              <Button onClick={submitEdit}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </PageLoadingGate>
  )
}

export default function SprintsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <LoadingAnimation size="md" />
        </div>
      }
    >
      <SprintsPageContent />
    </Suspense>
  )
}

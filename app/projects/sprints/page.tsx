'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingAnimation, LoadingInline, LoadingScreen, PageLoadingGate } from '@/components/ui/loading-animation'
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
  TrendingUp, 
  Search,
  Eye,
  Trash,
  Play,
  Pause,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(true)
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
    let className = 'bg-gray-500 text-white border-none rounded'
    if (event.status === 'PLANNING') className = 'bg-amber-500 text-white border-none rounded'
    else if (event.status === 'ACTIVE') className = 'bg-emerald-600 text-white border-none rounded'
    else if (event.status === 'COMPLETED') className = 'bg-[#161f46] text-white border-none rounded'
    else if (event.status === 'CANCELLED') className = 'bg-rose-600 text-white border-none rounded'
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
        return 'bg-amber-100 text-amber-800 border border-amber-200'
      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200'
      case 'COMPLETED':
        return 'bg-[#161f46]/10 text-[#161f46] border border-[#161f46]/20'
      case 'CANCELLED':
        return 'bg-rose-100 text-rose-800 border border-rose-200'
      default:
        return 'bg-gray-100 text-gray-800 border border-muted'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return <CalendarIcon className="w-4 h-4" />
      case 'ACTIVE':
        return <Play className="w-4 h-4" />
      case 'COMPLETED':
        return <CheckCircle2 className="w-4 h-4" />
      case 'CANCELLED':
        return <Pause className="w-4 h-4" />
      default:
        return <CalendarIcon className="w-4 h-4" />
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {showArchived ? 'Sprints Arquivadas' : 'Todas as Sprints'}
          </h1>
          <p className="text-muted-foreground">
            {showArchived
              ? 'Sprints concluídas ou canceladas que foram arquivadas'
              : 'Visualize e gerencie todas as sprints dos seus projetos'}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="bg-muted p-1 rounded-lg flex gap-1">
            <Button
              variant={viewMode === 'mkt' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('mkt')}
              className="text-xs h-8"
            >
              MKT
            </Button>
            <Button
              variant={viewMode === 'dev' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('dev')}
              className="text-xs h-8"
            >
              Dev
            </Button>
            <Button
              variant={viewMode === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('all')}
              className="text-xs h-8"
            >
              Todos
            </Button>
          </div>
          <Button
            onClick={() => setShowCreateSprint(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-10"
            disabled={showArchived}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Sprint
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar sprints, projetos ou clientes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !dateFilter && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFilter ? format(dateFilter, "PPP", { locale: ptBR }) : <span>Filtrar por data</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
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
                <Button 
                  variant="ghost" 
                  onClick={() => setDateFilter(undefined)}
                  className="h-9 w-9 p-0"
                >
                  <Trash className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              )}

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm h-10 bg-background"
              >
                <option value="all">Todos os Status</option>
                <option value="PLANNING">Planejamento</option>
                <option value="ACTIVE">Ativa</option>
                <option value="COMPLETED">Concluída</option>
                <option value="CANCELLED">Cancelada</option>
              </select>
              <Button
                variant={showArchived ? 'default' : 'outline'}
                size="sm"
                className="h-10"
                onClick={() => setShowArchived((v) => !v)}
              >
                <Archive className="w-4 h-4 mr-2" />
                {showArchived ? 'Ver ativas' : 'Arquivadas'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {dateFilter && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">
                Tarefas do Dia: {format(dateFilter, "dd 'de' MMMM", { locale: ptBR })}
              </h3>
            </div>
            
            <div className="grid gap-3">
              {filteredSprints.flatMap(sprint => 
                sprint.tasks
                  .filter(task => task.dueDate && isSameDay(new Date(task.dueDate), dateFilter))
                  .map(task => ({ ...task, sprintName: sprint.name, projectName: sprint.project?.name || 'Sem Projeto' }))
              ).length === 0 ? (
                <p className="text-sm text-muted-foreground pl-7">Nenhuma tarefa agendada para este dia nas sprints selecionadas.</p>
              ) : (
                filteredSprints.flatMap(sprint => 
                  sprint.tasks
                    .filter(task => task.dueDate && isSameDay(new Date(task.dueDate), dateFilter))
                    .map(task => ({ ...task, sprintName: sprint.name, projectName: sprint.project?.name || 'Sem Projeto', sprintId: sprint.id, projectId: sprint.project?.id }))
                ).map(task => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-background rounded-lg border shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        task.status === 'COMPLETED' ? 'bg-green-500' : 
                        task.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-amber-500'
                      }`} />
                      <div>
                        <p className="font-medium text-sm">{task.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{task.sprintName}</span>
                          <span>•</span>
                          <span>{task.projectName}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {task.storyPoints && (
                        <Badge variant="outline" className="text-[10px] h-5">
                          {task.storyPoints} SP
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {task.status === 'TODO' ? 'A Fazer' :
                         task.status === 'IN_PROGRESS' ? 'Em Progresso' :
                         task.status === 'COMPLETED' ? 'Concluído' : task.status}
                      </Badge>
                      <Link href={`/projects/${task.projectId || 'unknown'}/scrum?sprint=${task.sprintId}`}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Eye className="w-3 h-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div 
          className="flex flex-row items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <CalendarIcon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-base font-semibold leading-none">
                {viewMode === 'mkt' ? 'Agenda MKT' : viewMode === 'dev' ? 'Agenda de Desenvolvimento' : 'Agenda Geral'}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {isCalendarExpanded 
                  ? 'Visualize a distribuição das sprints no calendário'
                  : 'Clique para expandir e visualizar o calendário'}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 shrink-0 text-muted-foreground"
          >
            {isCalendarExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
        {isCalendarExpanded && (
          <CardContent className="p-0 border-t transition-all duration-200 ease-in-out">
            <style>{`
              .rbc-today {
                background-color: hsl(var(--muted)) !important;
              }
              .dark .rbc-today {
                background-color: #ffffff !important;
              }
              .dark .rbc-today .rbc-button-link {
                color: #2563eb !important;
              }
              .rbc-calendar {
                color: hsl(var(--foreground));
              }
              .rbc-off-range-bg {
                background-color: hsl(var(--muted) / 0.3) !important;
              }
              .rbc-month-view, .rbc-time-view, .rbc-agenda-view, .rbc-month-row, .rbc-day-bg, .rbc-header {
                border-color: hsl(var(--border)) !important;
              }
              .rbc-header {
                padding: 8px 0;
                font-weight: 600;
              }
              .rbc-toolbar button {
                color: hsl(var(--foreground));
                border-color: hsl(var(--border));
              }
              .rbc-toolbar button:hover {
                background-color: hsl(var(--accent));
                color: hsl(var(--accent-foreground));
              }
              .rbc-toolbar button.rbc-active {
                background-color: hsl(var(--primary));
                color: hsl(var(--primary-foreground));
                border-color: hsl(var(--primary));
              }
              .rbc-toolbar button.rbc-active:hover {
                background-color: hsl(var(--primary) / 0.9);
              }
              .rbc-toolbar-label {
                color: hsl(var(--foreground));
                font-weight: 600;
              }
            `}</style>
            <div className="h-[500px] p-4">
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
          </CardContent>
        )}
      </Card>

      {/* Lista de Sprints Agrupada por Projeto */}
      <div className="space-y-4">
        {groupedSprints.map(({ project, sprints }) => {
          const isExpanded = expandedProjects.includes(project.id)
          
          return (
            <div key={project.id} className="border rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden">
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleProject(project.id)}
              >
                <div className="flex items-center gap-4">
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      {project.name}
                      <Badge variant="secondary" className="text-xs font-normal">
                        {project.client?.name || 'Cliente não definido'}
                      </Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {sprints.length} sprint{sprints.length !== 1 ? 's' : ''} encontrada{sprints.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              {isExpanded && (
                <div className="p-4 border-t bg-muted/10">
                   <div className="flex flex-col gap-3">
                    {sprints.map(sprint => {
                      const metrics = getSprintMetrics(sprint)
                      const timeInfo = getSprintTimeInfo(sprint)
                      const startDate = new Date(sprint.startDate)
                      const endDate = new Date(sprint.endDate)
                      const today = new Date()
                      const isCurrent = isWithinInterval(today, { start: startOfDay(startDate), end: endOfDay(endDate) })
                      
                      return (
                        <Card 
                          key={sprint.id} 
                          className={`hover:shadow-md transition-all bg-background border-l-4 ${isCurrent ? 'border-l-primary ring-1 ring-primary/20' : 'border-l-transparent'}`}
                        >
                          <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center gap-4">
                            {/* Info Principal */}
                            <div className="flex-1 min-w-[200px]">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-base font-semibold line-clamp-1">{sprint.name}</h3>
                                <Badge className={`${getStatusColor(sprint.status)} text-[10px] px-1.5 py-0 h-5`}>
                                  {getStatusLabel(sprint.status)}
                                </Badge>
                              </div>
                              {sprint.goal && (
                                <p className="text-xs text-muted-foreground line-clamp-1 mb-2" title={sprint.goal}>
                                  {sprint.goal}
                                </p>
                              )}
                              
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${isCurrent ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-muted/50 border-border/50 text-muted-foreground'}`}>
                                    <CalendarIcon className="w-3.5 h-3.5" />
                                    <span className="text-sm font-medium">
                                      {format(startDate, 'dd/MM', { locale: ptBR })} - {format(endDate, 'dd/MM', { locale: ptBR })}
                                    </span>
                                  </div>
                                </div>
                                
                                {timeInfo.statusText && (
                                  <div className="flex flex-col gap-0.5 ml-1">
                                    <span className={`text-xs ${isCurrent ? 'text-primary font-medium' : (timeInfo.isDelayed ? 'text-destructive font-medium' : 'text-muted-foreground')}`}>
                                      {timeInfo.statusText}
                                      {isCurrent && timeInfo.remainingBusinessDays > 0 && (
                                        <span className="opacity-80"> ({timeInfo.remainingBusinessDays} úteis)</span>
                                      )}
                                    </span>
                                    {timeInfo.totalDays > 0 && (
                                      <span className="text-[10px] text-muted-foreground opacity-80">
                                        Duração: {timeInfo.totalDays} dias ({timeInfo.totalBusinessDays} úteis)
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Métricas e Progresso */}
                            <div className="flex-1 w-full md:w-auto flex flex-col gap-2 min-w-[200px]">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <div className="flex gap-3">
                                  <span className="flex items-center gap-1" title="Tarefas">
                                    <Target className="w-3 h-3" /> {metrics.completedTasks}/{metrics.totalTasks}
                                  </span>
                                  <span className="flex items-center gap-1" title="Story Points">
                                    <TrendingUp className="w-3 h-3" /> {metrics.completedStoryPoints}/{metrics.totalStoryPoints} SP
                                  </span>
                                </div>
                                <span>{metrics.progress}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className="bg-[#161f46] h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${metrics.progress}%` }}
                                />
                              </div>
                            </div>

                            {/* Ações */}
                            <div className="flex items-center w-full md:w-auto justify-end border-t md:border-t-0 pt-2 md:pt-0 mt-2 md:mt-0">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                    aria-label="Ações da sprint"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
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
                                          <Eye className="w-4 h-4 mr-2" />
                                          Ver quadro
                                        </Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openEdit(sprint)}>
                                        <Pencil className="w-4 h-4 mr-2" />
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
                                            <Archive className="w-4 h-4 mr-2" />
                                            Arquivar
                                          </DropdownMenuItem>
                                        )
                                      })()}
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => setDeleteTarget(sprint)}
                                      >
                                        <Trash className="w-4 h-4 mr-2" />
                                        Excluir
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {showArchived && (
                                    <DropdownMenuItem
                                      disabled={archiveLoading === sprint.id}
                                      onClick={() => handleArchiveSprint(sprint, false)}
                                    >
                                      <ArchiveRestore className="w-4 h-4 mr-2" />
                                      Restaurar
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                   </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filteredSprints.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {showArchived
                ? 'Nenhuma sprint arquivada'
                : searchTerm || statusFilter !== 'all'
                  ? 'Nenhuma sprint encontrada'
                  : 'Nenhuma sprint criada'}
            </h3>
            <p className="text-muted-foreground">
              {showArchived
                ? 'Arquive sprints concluídas ou canceladas para organizar a lista'
                : searchTerm || statusFilter !== 'all'
                  ? 'Tente ajustar os filtros de busca'
                  : 'Crie sprints nos seus projetos para vê-las aqui'}
            </p>
          </CardContent>
        </Card>
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
              <Button onClick={submitEdit} className="bg-blue-600 hover:bg-blue-700">Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
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
    </PageLoadingGate>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Calendar, Target, Users, Filter, BarChart3, Clock, ChevronDown, ChevronRight, CheckSquare, Square, ArrowRight } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { TaskCard } from './TaskCard'
import { SprintHeader } from './SprintHeader'
import { CreateTaskModal } from './CreateTaskModal'
import { CreateSprintModal } from './CreateSprintModal'
import { EditSprintStatusModal } from './EditSprintStatusModal'
import { SprintTimeline } from './SprintTimeline'

interface Task {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  storyPoints?: number
  assignee?: {
    id: string
    name: string
    email: string
    avatar?: string
  }
  dueDate?: string
  startDate?: string
  startTime?: string
  estimatedMinutes?: number
  order: number
  projectId?: string
  milestoneId?: string
}

interface Sprint {
  id: string
  name: string
  description?: string
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  startDate: string
  endDate: string
  goal?: string
  capacity?: number
  tasks: Task[]
}

interface SprintBoardProps {
  projectId: string
  sprintId?: string
}

export function SprintBoard({ projectId, sprintId }: SprintBoardProps) {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [backlog, setBacklog] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [showCreateSprint, setShowCreateSprint] = useState(false)
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [sprintProjects, setSprintProjects] = useState<any[]>([])
  const [showEditSprintStatus, setShowEditSprintStatus] = useState(false)
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null)
  const [milestones, setMilestones] = useState<any[]>([])
  const [selectedMilestone, setSelectedMilestone] = useState<string>('all')
  const [filteredBacklog, setFilteredBacklog] = useState<Task[]>([])
  const [expandedCollaborators, setExpandedCollaborators] = useState<{[key: string]: boolean}>({})
  const [showDailyProgress, setShowDailyProgress] = useState(false)
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [selectionMode, setSelectionMode] = useState(false)

  useEffect(() => {
    fetchData()
  }, [projectId, sprintId])

  // Filtrar backlog por milestone
  useEffect(() => {
    if (selectedMilestone === 'all') {
      setFilteredBacklog(backlog)
    } else if (selectedMilestone === 'none') {
      setFilteredBacklog(backlog.filter(task => !task.milestoneId))
    } else {
      setFilteredBacklog(backlog.filter(task => task.milestoneId === selectedMilestone))
    }
  }, [backlog, selectedMilestone])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Buscar sprints - se sprintId específico, buscar apenas essa sprint
      if (sprintId) {
        // Buscar sprint específica
        const sprintResponse = await fetch(`/api/sprints/${sprintId}`)
        if (sprintResponse.ok) {
          const sprintData = await sprintResponse.json()
          setSprints([sprintData]) // Mostrar apenas a sprint específica
        }
      } else {
        // Buscar todas as sprints do projeto
        const sprintsResponse = await fetch(`/api/sprints?projectId=${projectId}`)
        if (sprintsResponse.ok) {
          const sprintsData = await sprintsResponse.json()
          setSprints(Array.isArray(sprintsData) ? sprintsData : [])
        }
      }
      
      // Buscar projetos da sprint e backlog se sprintId for fornecido
      let currentSprintProjects: any[] = []
      if (sprintId) {
        const sprintProjectsResponse = await fetch(`/api/sprints/${sprintId}/projects`)
        if (sprintProjectsResponse.ok) {
          const projectsData = await sprintProjectsResponse.json()
          currentSprintProjects = projectsData
          setSprintProjects(projectsData)
        }

        // Buscar backlog de todos os projetos da sprint
        const backlogResponse = await fetch(`/api/sprints/${sprintId}/backlog`)
        if (backlogResponse.ok) {
          const backlogData = await backlogResponse.json()
          let filteredBacklog = Array.isArray(backlogData) ? backlogData : []
          
          // Filtrar apenas tarefas que precisam ser feitas
          filteredBacklog = filteredBacklog.filter(task => 
            task.status === 'TODO' || task.status === 'IN_PROGRESS' || task.status === 'IN_REVIEW'
          )
          
          setBacklog(filteredBacklog)
        }
      } else {
        setSprintProjects([])
        
        // Se não há sprintId, buscar backlog do projeto específico
        const backlogResponse = await fetch(`/api/backlog?projectId=${projectId}`)
        if (backlogResponse.ok) {
          const backlogData = await backlogResponse.json()
          const filteredBacklog = Array.isArray(backlogData) ? backlogData : []
          setBacklog(filteredBacklog)
        }
      }

      // Buscar milestones dos projetos
      let allMilestones: any[] = []
      
      if (sprintId && currentSprintProjects.length > 0) {
        // Se há sprint específica com múltiplos projetos, buscar milestones de todos
        for (const project of currentSprintProjects) {
          const milestonesResponse = await fetch(`/api/milestones?projectId=${project.id}`)
          if (milestonesResponse.ok) {
            const milestonesData = await milestonesResponse.json()
            if (Array.isArray(milestonesData)) {
              allMilestones = [...allMilestones, ...milestonesData]
            }
          }
        }
      } else if (projectId) {
        // Se é projeto único, buscar milestones apenas desse projeto
        const milestonesResponse = await fetch(`/api/milestones?projectId=${projectId}`)
        if (milestonesResponse.ok) {
          const milestonesData = await milestonesResponse.json()
          if (Array.isArray(milestonesData)) {
            allMilestones = milestonesData
          }
        }
      }
      
      setMilestones(allMilestones)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return
    }
    const parse = (id: string) => {
      if (id === 'backlog') return { sprintId: null as string | null, column: null as string | null }
      if (id.includes('|')) {
        const [sid, col] = id.split('|')
        return { sprintId: sid, column: col }
      }
      return { sprintId: id, column: null }
    }
    const src = parse(source.droppableId)
    const dst = parse(destination.droppableId)
    let destinationIndex = destination.index
    if (dst.sprintId) {
      const sprint = sprints.find(s => s.id === dst.sprintId)
      if (sprint) {
        const all = [...sprint.tasks].sort((a, b) => a.order - b.order)
        const inCol = all.filter(t => t.status === dst.column)
        if (inCol.length === 0) {
          destinationIndex = all.length
        } else if (destination.index >= inCol.length) {
          const last = inCol[inCol.length - 1]
          const lastIdx = all.findIndex(t => t.id === last.id)
          destinationIndex = lastIdx + 1
        } else {
          const target = inCol[destination.index]
          const targetIdx = all.findIndex(t => t.id === target.id)
          destinationIndex = targetIdx
        }
      }
    }
    const prevSprints = sprints.map(s => ({ ...s, tasks: s.tasks.map(t => ({ ...t })) }))
    const prevBacklog = backlog.map(t => ({ ...t }))
    try {
      let nextSprints = sprints.map(s => ({ ...s, tasks: s.tasks.map(t => ({ ...t })) }))
      let nextBacklog = backlog.map(t => ({ ...t }))
      let movedTask: Task | null = null
      if (src.sprintId) {
        const sIdx = nextSprints.findIndex(s => s.id === src.sprintId)
        if (sIdx !== -1) {
          const idx = nextSprints[sIdx].tasks.findIndex(t => t.id === draggableId)
          if (idx !== -1) {
            movedTask = nextSprints[sIdx].tasks[idx]
            nextSprints[sIdx].tasks.splice(idx, 1)
            nextSprints[sIdx].tasks = nextSprints[sIdx].tasks
              .sort((a, b) => a.order - b.order)
              .map((t, i) => ({ ...t, order: i }))
          }
        }
      } else {
        const bIdx = nextBacklog.findIndex(t => t.id === draggableId)
        if (bIdx !== -1) {
          movedTask = nextBacklog[bIdx]
          nextBacklog.splice(bIdx, 1)
        }
      }
      if (dst.sprintId) {
        const dIdx = nextSprints.findIndex(s => s.id === dst.sprintId)
        if (dIdx !== -1 && movedTask) {
          const all = [...nextSprints[dIdx].tasks].sort((a, b) => a.order - b.order)
          const newStatus = (dst.column || movedTask.status) as Task['status']
          const taskToInsert = { ...movedTask, status: newStatus }
          all.splice(destinationIndex, 0, taskToInsert)
          nextSprints[dIdx].tasks = all.map((t, i) => ({ ...t, order: i }))
        }
        setBacklog(nextBacklog)
      } else {
        if (movedTask) {
          nextBacklog = [{ ...movedTask }, ...nextBacklog]
          setBacklog(nextBacklog)
        }
      }
      setSprints(nextSprints)
      const moveRes = fetch('/api/tasks/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: draggableId,
          destinationSprintId: dst.sprintId,
          destinationIndex,
          sourceSprintId: src.sprintId
        })
      })
      const patchRes = dst.column && dst.column !== null
        ? fetch(`/api/tasks/${draggableId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: dst.column })
          })
        : Promise.resolve(new Response())
      const [moveOk, patchOk] = await Promise.all([moveRes, patchRes])
      if (!moveOk.ok || !patchOk.ok) {
        setSprints(prevSprints)
        setBacklog(prevBacklog)
      }
    } catch {
      setSprints(prevSprints)
      setBacklog(prevBacklog)
    }
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setShowCreateTask(true)
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.')) {
      return
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Erro ao excluir tarefa')
      }

      toast.success('Tarefa excluída com sucesso!')
      fetchData() // Recarregar dados
    } catch (error) {
      console.error('Erro ao excluir tarefa:', error)
      toast.error('Erro ao excluir tarefa')
    }
  }

  const handleEditSprint = (sprint: Sprint) => {
    setEditingSprint(sprint)
    setShowEditSprintStatus(true)
  }

  // Funções para seleção múltipla de tarefas
  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    )
  }

  const selectAllTasks = () => {
    setSelectedTasks(filteredBacklog.map(task => task.id))
  }

  const clearSelection = () => {
    setSelectedTasks([])
  }

  const moveSelectedTasksToSprint = async (targetSprintId: string) => {
    if (selectedTasks.length === 0) return

    try {
      // Buscar a sprint de destino para saber quantas tarefas já tem
      const targetSprint = sprints.find(s => s.id === targetSprintId)
      let destinationIndex = targetSprint ? targetSprint.tasks.length : 0

      // Mover cada tarefa selecionada para a sprint
      for (const taskId of selectedTasks) {
        const response = await fetch(`/api/tasks/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId,
            destinationSprintId: targetSprintId,
            destinationIndex: destinationIndex,
            sourceSprintId: null // Vem do backlog
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('Erro na API:', errorData)
          throw new Error(errorData.error || 'Erro ao mover tarefa')
        }

        destinationIndex++ // Incrementar para próxima tarefa
      }

      toast.success(`${selectedTasks.length} tarefas movidas para a sprint`)
      clearSelection()
      setSelectionMode(false)
      fetchData() // Recarregar dados
    } catch (error) {
      console.error('Erro ao mover tarefas:', error)
      toast.error(`Erro ao mover tarefas: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
  }

  const getSprintProgress = (sprint: Sprint) => {
    const completedTasks = sprint.tasks.filter(task => task.status === 'COMPLETED').length
    const totalTasks = sprint.tasks.length
    return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  }

  const getSprintStoryPoints = (sprint: Sprint) => {
    const totalPoints = sprint.tasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0)
    const completedPoints = sprint.tasks
      .filter(task => task.status === 'COMPLETED')
      .reduce((sum, task) => sum + (task.storyPoints || 0), 0)
    
    return { total: totalPoints, completed: completedPoints }
  }

  // Função para gerar os dias da sprint (sem problemas de fuso horário)
  const getSprintDays = (sprint: Sprint) => {
    const startDateStr = sprint.startDate.split('T')[0] // YYYY-MM-DD
    const endDateStr = sprint.endDate.split('T')[0] // YYYY-MM-DD
    
    const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number)
    const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number)
    
    const startDate = new Date(startYear, startMonth - 1, startDay) // Mês é 0-indexed
    const endDate = new Date(endYear, endMonth - 1, endDay)
    
    const days = []
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      days.push(new Date(date))
    }
    
    return days
  }

  // Função para calcular progresso diário por colaborador
  const getDailyProgressByCollaborator = (sprint: Sprint) => {
    const days = getSprintDays(sprint)
    
    return days.map(day => {
      const dayStr = day.toISOString().split('T')[0]
      
      // Buscar tarefas para este dia
      const tasksForDay = sprint.tasks.filter(task => {
        const taskStartDate = task.startDate ? task.startDate.split('T')[0] : null
        const taskDueDate = task.dueDate ? task.dueDate.split('T')[0] : null
        return taskStartDate === dayStr || taskDueDate === dayStr
      })
      
      // Agrupar por colaborador
      const collaborators = [...new Set(tasksForDay.map(task => task.assignee?.id).filter(Boolean))]
      
      const collaboratorProgress = collaborators.map(collaboratorId => {
        const collaboratorTasks = tasksForDay.filter(task => task.assignee?.id === collaboratorId)
        const collaborator = collaboratorTasks[0]?.assignee
        
        const completedTasks = collaboratorTasks.filter(task => task.status === 'COMPLETED')
        const inProgressTasks = collaboratorTasks.filter(task => task.status === 'IN_PROGRESS')
        const todoTasks = collaboratorTasks.filter(task => task.status === 'TODO')
        
        return {
          collaboratorId,
          collaboratorName: collaborator?.name || 'Sem responsável',
          collaboratorEmail: collaborator?.email || '',
          tasks: collaboratorTasks,
          total: collaboratorTasks.length,
          completed: completedTasks.length,
          inProgress: inProgressTasks.length,
          todo: todoTasks.length,
          completedTasks,
          inProgressTasks,
          todoTasks
        }
      }).filter(c => c.total > 0)
      
      return {
        date: day,
        dateStr: dayStr,
        collaborators: collaboratorProgress,
        totalTasks: tasksForDay.length
      }
    }).filter(day => day.collaborators.length > 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quadro Scrum</h1>
          <p className="text-muted-foreground">Gerencie suas sprints e backlog</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowCreateTask(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Tarefa
          </Button>
          <Button
            onClick={() => setShowCreateSprint(true)}
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Sprint
          </Button>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-6">
          {/* Mensagem quando não há dados */}
          {(sprints || []).length === 0 && (backlog || []).length === 0 && (
            <Card className="border-dashed border-2 border-gray-300">
              <CardContent className="p-8 text-center">
                <div className="text-muted-foreground">
                  <Target className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Bem-vindo ao Scrum!</h3>
                  <p className="text-sm mb-4">
                    Comece criando sua primeira tarefa ou sprint para organizar seu projeto.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={() => setShowCreateTask(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Primeira Tarefa
                    </Button>
                    <Button
                      onClick={() => setShowCreateSprint(true)}
                      variant="outline"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Primeira Sprint
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sprints Ativas */}
          {(sprints || [])
            .filter(sprint => sprint.status === 'ACTIVE')
            .map(sprint => {
              const progress = getSprintProgress(sprint)
              const storyPoints = getSprintStoryPoints(sprint)
              
              return (
                <Card key={sprint.id} className="border-border bg-background shadow-sm">
                  <CardHeader>
                    <SprintHeader
                      sprint={sprint}
                      progress={progress}
                      storyPoints={storyPoints}
                      onEdit={() => handleEditSprint(sprint)}
                    />
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {[
                        { key: 'TODO', label: 'A Fazer' },
                        { key: 'IN_PROGRESS', label: 'Em Progresso' },
                        { key: 'IN_REVIEW', label: 'Testar' },
                        { key: 'COMPLETED', label: 'Concluído' }
                      ].map((col) => {
                        const tasksInColumn = sprint.tasks
                          .filter(t => t.status === col.key)
                          .sort((a, b) => a.order - b.order)
                          .sort((a, b) => a.order - b.order)
                        
                        return (
                          <div key={col.key} className="bg-slate-100/50 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-1.5">
                            <div className="px-3 py-3 flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-foreground/80">{col.label}</span>
                              <Badge variant="secondary" className="text-xs font-mono bg-background/80 shadow-sm">{tasksInColumn.length}</Badge>
                            </div>
                            <Droppable droppableId={`${sprint.id}|${col.key}`} direction="vertical">
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className="min-h-[160px] px-3 pb-3 space-y-3"
                                >
                                  {tasksInColumn.map((task, index) => (
                                    <Draggable key={task.id} draggableId={task.id} index={index}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={`${snapshot.isDragging ? 'rotate-3 shadow-lg z-50' : ''}`}
                                        >
                                          <TaskCard 
                                            task={task} 
                                            onEdit={handleEditTask}
                                            onDelete={handleDeleteTask}
                                            onClick={() => handleEditTask(task)}
                                          />
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                  
                  {/* Visualização Diária por Colaborador */}
                  <CardContent className="pt-0">
                    <div className="border-t pt-4">
                      <div 
                        className="flex items-center gap-2 mb-4 cursor-pointer hover:bg-card p-2 rounded-md -m-2"
                        onClick={() => setShowDailyProgress(!showDailyProgress)}
                      >
                        {showDailyProgress ? (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                        <Users className="w-5 h-5 text-blue-600" />
                        <h3 className="font-semibold text-foreground">Progresso Diário por Colaborador</h3>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {showDailyProgress ? 'Clique para fechar' : 'Clique para expandir'}
                        </Badge>
                      </div>
                      
                      {showDailyProgress && (() => {
                        const dailyProgress = getDailyProgressByCollaborator(sprint)
                        
                        if (dailyProgress.length === 0) {
                          return (
                            <div className="text-center py-4 text-muted-foreground">
                              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">Nenhuma tarefa agendada com datas específicas</p>
                            </div>
                          )
                        }
                        
                        return (
                          <div className="space-y-4">
                            {dailyProgress.map((day: any) => (
                              <div key={day.dateStr} className="bg-card rounded-lg border p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <Calendar className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-medium text-foreground">
                                    {day.date.toLocaleDateString('pt-BR', { 
                                      weekday: 'long', 
                                      day: '2-digit', 
                                      month: '2-digit' 
                                    })}
                                  </span>
                                  {day.dateStr === new Date().toISOString().split('T')[0] && (
                                    <Badge variant="default" className="bg-blue-600">Hoje</Badge>
                                  )}
                                  <Badge variant="outline" className="ml-auto text-xs">
                                    {day.totalTasks} tarefas
                                  </Badge>
                                </div>
                                
                                <div className="space-y-3">
                                  {day.collaborators.map((collaborator: any) => {
                                    const collaboratorKey = `${day.dateStr}-${collaborator.collaboratorId}`
                                    const isExpanded = expandedCollaborators[collaboratorKey]
                                    
                                    return (
                                      <div key={collaborator.collaboratorId} className="bg-card rounded-md p-3">
                                        <div 
                                          className="flex items-center justify-between cursor-pointer"
                                          onClick={() => setExpandedCollaborators(prev => ({
                                            ...prev,
                                            [collaboratorKey]: !prev[collaboratorKey]
                                          }))}
                                        >
                                          <div className="flex items-center gap-2">
                                            {isExpanded ? (
                                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                            ) : (
                                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                            )}
                                            <Users className="w-4 h-4 text-blue-600" />
                                            <span className="font-medium text-sm text-foreground">
                                              {collaborator.collaboratorName}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">
                                              {collaborator.total} tarefas
                                            </Badge>
                                            <div className="text-xs text-muted-foreground">
                                              {collaborator.total > 0 ? Math.round((collaborator.completed / collaborator.total) * 100) : 0}%
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {/* Resumo sempre visível */}
                                        <div className="mt-2 flex items-center gap-4 text-xs">
                                          {collaborator.completed > 0 && (
                                            <span className="text-green-600">✓ {collaborator.completed}</span>
                                          )}
                                          {collaborator.inProgress > 0 && (
                                            <span className="text-blue-600">⚡ {collaborator.inProgress}</span>
                                          )}
                                          {collaborator.todo > 0 && (
                                            <span className="text-muted-foreground">○ {collaborator.todo}</span>
                                          )}
                                        </div>
                                        
                                        {/* Barra de progresso */}
                                        <div className="mt-2">
                                          <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div 
                                              className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                                              style={{ 
                                                width: `${collaborator.total > 0 ? (collaborator.completed / collaborator.total) * 100 : 0}%` 
                                              }}
                                            ></div>
                                          </div>
                                        </div>
                                        
                                        {/* Detalhes das tarefas (expansível) */}
                                        {isExpanded && (
                                          <div className="mt-3 space-y-2 border-t pt-3">
                                            {collaborator.tasks
                                              .sort((a: Task, b: Task) => {
                                                // Ordenar por horário de início (startTime)
                                                if (a.startTime && b.startTime) {
                                                  return a.startTime.localeCompare(b.startTime)
                                                }
                                                // Tarefas com horário primeiro
                                                if (a.startTime && !b.startTime) return -1
                                                if (!a.startTime && b.startTime) return 1
                                                
                                                // Se não tem horário, ordenar por status
                                                const statusOrder = { 'IN_PROGRESS': 0, 'TODO': 1, 'IN_REVIEW': 2, 'COMPLETED': 3 }
                                                const aStatus = statusOrder[a.status] ?? 4
                                                const bStatus = statusOrder[b.status] ?? 4
                                                if (aStatus !== bStatus) return aStatus - bStatus
                                                
                                                // Por último, ordenar por título
                                                return a.title.localeCompare(b.title)
                                              })
                                              .map((task: Task) => (
                                              <div key={task.id} className="flex items-center justify-between text-xs bg-card rounded p-2">
                                                <div className="flex items-center gap-2">
                                                  <div className={`w-2 h-2 rounded-full ${
                                                    task.status === 'COMPLETED' ? 'bg-green-500' :
                                                    task.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                                                    'bg-gray-400'
                                                  }`}></div>
                                                  <span className="font-medium truncate max-w-[200px]">
                                                    {task.title}
                                                  </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <Badge 
                                                    variant={task.priority === 'URGENT' ? 'destructive' : 'outline'} 
                                                    className="text-xs"
                                                  >
                                                    {task.priority}
                                                  </Badge>
                                                  {task.startTime && (
                                                    <span className="text-muted-foreground">{task.startTime}</span>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  </CardContent>
                </Card>
              )
            })}

         

          {/* Sprints em Planejamento */}
          {(sprints || [])
            .filter(sprint => sprint.status === 'PLANNING')
            .map(sprint => {
              const progress = getSprintProgress(sprint)
              const storyPoints = getSprintStoryPoints(sprint)
              
              return (
                <Card key={sprint.id} className="border-dashed border-border bg-background/50 shadow-sm">
                  <CardHeader>
                    <SprintHeader
                      sprint={sprint}
                      progress={progress}
                      storyPoints={storyPoints}
                      onEdit={() => handleEditSprint(sprint)}
                    />
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {[
                        { key: 'TODO', label: 'A Fazer' },
                        { key: 'IN_PROGRESS', label: 'Em Progresso' },
                        { key: 'IN_REVIEW', label: 'Testar' },
                        { key: 'COMPLETED', label: 'Concluído' }
                      ].map((col) => {
                        const tasksInColumn = sprint.tasks
                          .filter(t => t.status === col.key)
                          .sort((a, b) => a.order - b.order)
                          .sort((a, b) => a.order - b.order)
                        
                        return (
                          <div key={col.key} className="bg-slate-100/50 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-1.5">
                            <div className="px-3 py-3 flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-foreground/80">{col.label}</span>
                              <Badge variant="secondary" className="text-xs font-mono bg-background/80 shadow-sm">{tasksInColumn.length}</Badge>
                            </div>
                            <Droppable droppableId={`${sprint.id}|${col.key}`} direction="vertical">
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className="min-h-[160px] px-3 pb-3 space-y-3"
                                >
                                  {tasksInColumn.map((task, index) => (
                                    <Draggable key={task.id} draggableId={task.id} index={index}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={`${snapshot.isDragging ? 'rotate-3 shadow-lg z-50' : ''}`}
                                        >
                                          <TaskCard 
                                            task={task} 
                                            onEdit={handleEditTask}
                                            onDelete={handleDeleteTask}
                                            onClick={() => handleEditTask(task)}
                                          />
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )
            })}

          {/* Backlog */}
          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 flex-wrap">
                <Target className="w-5 h-5" />
                Backlog
                {sprintId && (
                  <Badge variant="outline" className="ml-2 text-blue-600 border-blue-200">
                    Filtrado: Tarefas pendentes
                  </Badge>
                )}
                <Badge variant="secondary" className="ml-2">
                  {filteredBacklog.length} tarefas
                </Badge>
              </CardTitle>
              
              {/* Filtro por Milestone */}
              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Filtrar por milestone:</span>
                </div>
                <Select value={selectedMilestone} onValueChange={setSelectedMilestone}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Todas as milestones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as milestones</SelectItem>
                    <SelectItem value="none">Sem milestone</SelectItem>
                    {milestones.map((milestone) => (
                      <SelectItem key={milestone.id} value={milestone.id}>
                        {milestone.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="text-xs">
                  {filteredBacklog.length} de {backlog.length} tarefas
                </Badge>
              </div>

              {/* Controles de Seleção Múltipla */}
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                <Button
                  variant={selectionMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectionMode(!selectionMode)
                    if (!selectionMode) clearSelection()
                  }}
                  className="flex items-center gap-2"
                >
                  {selectionMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  {selectionMode ? 'Cancelar Seleção' : 'Selecionar Tarefas'}
                </Button>

                {selectionMode && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllTasks}
                      disabled={selectedTasks.length === filteredBacklog.length}
                    >
                      Selecionar Todas
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSelection}
                      disabled={selectedTasks.length === 0}
                    >
                      Limpar Seleção
                    </Button>

                    {selectedTasks.length > 0 && sprints.filter(s => s.status === 'ACTIVE').length > 0 && (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {selectedTasks.length} selecionadas
                        </Badge>
                        <Button
                          size="sm"
                          onClick={() => {
                            const activeSprint = sprints.find(s => s.status === 'ACTIVE')
                            if (activeSprint) {
                              moveSelectedTasksToSprint(activeSprint.id)
                            }
                          }}
                          className="flex items-center gap-2"
                        >
                          <ArrowRight className="w-4 h-4" />
                          Mover para Sprint Ativa
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {sprintId && sprintProjects.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground mb-2">
                    <strong>Projetos incluídos nesta sprint:</strong>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sprintProjects.map((project: any) => (
                      <Badge key={project.id} variant="outline" className="text-xs">
                        {project.name} - {project.client.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <Droppable droppableId="backlog" direction="horizontal">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex gap-4 min-h-[200px] overflow-x-auto pb-4"
                  >
                    {filteredBacklog.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">
                            {selectedMilestone === 'all' 
                              ? (sprintId ? 'Nenhuma tarefa pendente no backlog' : 'Nenhuma tarefa no backlog')
                              : 'Nenhuma tarefa encontrada para esta milestone'
                            }
                          </p>
                          <p className="text-xs text-gray-400">
                            {selectedMilestone === 'all'
                              ? (sprintId 
                                  ? 'Todas as tarefas estão concluídas ou não há tarefas pendentes' 
                                  : 'Clique em "Nova Tarefa" para começar'
                                )
                              : 'Tente selecionar outra milestone ou "Todas as milestones"'
                            }
                          </p>
                        </div>
                      </div>
                    ) : (
                      filteredBacklog
                        .sort((a, b) => a.order - b.order)
                        .map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={selectionMode}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`${
                                snapshot.isDragging ? 'rotate-3 shadow-lg' : ''
                              } ${selectionMode ? 'cursor-pointer' : ''}`}
                              onClick={selectionMode ? () => toggleTaskSelection(task.id) : undefined}
                            >
                              <div className="relative">
                                {selectionMode && (
                                  <div className="absolute top-2 left-2 z-10">
                                    {selectedTasks.includes(task.id) ? (
                                      <CheckSquare className="w-5 h-5 text-blue-600 bg-card rounded border-2 border-blue-600" />
                                    ) : (
                                      <Square className="w-5 h-5 text-gray-400 bg-card rounded border-2 border-gray-300" />
                                    )}
                                  </div>
                                )}
                                <div className={`${selectionMode && selectedTasks.includes(task.id) ? 'ring-2 ring-blue-500 ring-offset-2' : ''} rounded-lg`}>
                                  <TaskCard 
                                    task={task} 
                                    onEdit={handleEditTask}
                                    onDelete={handleDeleteTask}
                                    onClick={!selectionMode ? () => handleEditTask(task) : undefined}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </CardContent>
          </Card>

          {/* Sprints Concluídas */}
          {(sprints || [])
            .filter(sprint => sprint.status === 'COMPLETED')
            .slice(0, 3)
            .map(sprint => {
              const progress = getSprintProgress(sprint)
              const storyPoints = getSprintStoryPoints(sprint)
              
              return (
                <Card key={sprint.id} className="border-muted bg-card opacity-75 text-gray-400">
                  <CardHeader>
                    <SprintHeader
                      sprint={sprint}
                      progress={progress}
                      storyPoints={storyPoints}
                      onEdit={() => handleEditSprint(sprint)}
                      isCompleted
                    />
                  </CardHeader>
                </Card>
              )
            })}
        </div>
      </DragDropContext>

      {/* Modais */}
      <CreateTaskModal
        isOpen={showCreateTask}
        onClose={() => {
          setShowCreateTask(false)
          setEditingTask(null)
        }}
        projectId={projectId}
        sprintId={selectedSprintId}
        onSuccess={fetchData}
        editingTask={editingTask}
        sprintProjects={sprintProjects}
        milestones={milestones}
      />

      <CreateSprintModal
        isOpen={showCreateSprint}
        onClose={() => setShowCreateSprint(false)}
        onSuccess={fetchData}
      />

      <EditSprintStatusModal
        isOpen={showEditSprintStatus}
        onClose={() => {
          setShowEditSprintStatus(false)
          setEditingSprint(null)
        }}
        sprint={editingSprint}
        onSuccess={fetchData}
      />
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Calendar, Target, Users, Filter } from 'lucide-react'
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

    // Se moveu para a mesma posição, não faz nada
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    try {
      const sourceSprintId = source.droppableId === 'backlog' ? null : source.droppableId
      const destinationSprintId = destination.droppableId === 'backlog' ? null : destination.droppableId

      // Chamar API para mover a tarefa
      await fetch('/api/tasks/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: draggableId,
          destinationSprintId,
          destinationIndex: destination.index,
          sourceSprintId
        })
      })

      // Atualizar estado local
      fetchData()
    } catch (error) {
      console.error('Erro ao mover tarefa:', error)
      // Recarregar dados em caso de erro
      fetchData()
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
          <h1 className="text-2xl font-bold text-gray-900">Quadro Scrum</h1>
          <p className="text-gray-600">Gerencie suas sprints e backlog</p>
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
                <div className="text-gray-500">
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
                <Card key={sprint.id} className="border-green-200 bg-green-50">
                  <CardHeader>
                    <SprintHeader
                      sprint={sprint}
                      progress={progress}
                      storyPoints={storyPoints}
                      onEdit={() => handleEditSprint(sprint)}
                    />
                  </CardHeader>
                  <CardContent>
                    <Droppable droppableId={sprint.id} direction="horizontal">
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="flex gap-4 min-h-[200px] overflow-x-auto pb-4"
                        >
                          {sprint.tasks
                            .sort((a, b) => a.order - b.order)
                            .map((task, index) => (
                              <Draggable key={task.id} draggableId={task.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`${
                                      snapshot.isDragging ? 'rotate-3 shadow-lg' : ''
                                    }`}
                                  >
                                    <TaskCard 
                                      task={task} 
                                      onEdit={handleEditTask}
                                      onDelete={handleDeleteTask}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
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
                <Card key={sprint.id} className="border-yellow-200 bg-yellow-50">
                  <CardHeader>
                    <SprintHeader
                      sprint={sprint}
                      progress={progress}
                      storyPoints={storyPoints}
                      onEdit={() => handleEditSprint(sprint)}
                    />
                  </CardHeader>
                  <CardContent>
                    <Droppable droppableId={sprint.id} direction="horizontal">
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="flex gap-4 min-h-[200px] overflow-x-auto pb-4"
                        >
                          {sprint.tasks
                            .sort((a, b) => a.order - b.order)
                            .map((task, index) => (
                              <Draggable key={task.id} draggableId={task.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`${
                                      snapshot.isDragging ? 'rotate-3 shadow-lg' : ''
                                    }`}
                                  >
                                    <TaskCard 
                                      task={task} 
                                      onEdit={handleEditTask}
                                      onDelete={handleDeleteTask}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </CardContent>
                </Card>
              )
            })}

          {/* Backlog */}
          <Card className="border-gray-200">
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
                  <Filter className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Filtrar por milestone:</span>
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

              {sprintId && sprintProjects.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600 mb-2">
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
                      <div className="flex-1 flex items-center justify-center text-gray-500">
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
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`${
                                snapshot.isDragging ? 'rotate-3 shadow-lg' : ''
                              }`}
                            >
                              <TaskCard 
                                task={task} 
                                onEdit={handleEditTask}
                                onDelete={handleDeleteTask}
                              />
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
                <Card key={sprint.id} className="border-gray-300 bg-gray-50 opacity-75">
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

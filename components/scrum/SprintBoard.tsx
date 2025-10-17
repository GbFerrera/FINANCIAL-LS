'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, Calendar, Target, Users } from 'lucide-react'
import { TaskCard } from './TaskCard'
import { SprintHeader } from './SprintHeader'
import { CreateTaskModal } from './CreateTaskModal'
import { CreateSprintModal } from './CreateSprintModal'

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
  order: number
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
}

export function SprintBoard({ projectId }: SprintBoardProps) {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [backlog, setBacklog] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [showCreateSprint, setShowCreateSprint] = useState(false)
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [projectId])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Buscar sprints
      const sprintsResponse = await fetch(`/api/sprints?projectId=${projectId}`)
      if (sprintsResponse.ok) {
        const sprintsData = await sprintsResponse.json()
        setSprints(Array.isArray(sprintsData) ? sprintsData : [])
      }
      
      // Buscar backlog
      const backlogResponse = await fetch(`/api/backlog?projectId=${projectId}`)
      if (backlogResponse.ok) {
        const backlogData = await backlogResponse.json()
        setBacklog(Array.isArray(backlogData) ? backlogData : [])
      }
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
                      onEdit={() => {}}
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
                                    <TaskCard task={task} />
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
                      onEdit={() => {}}
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
                                    <TaskCard task={task} />
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
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Backlog
                <Badge variant="secondary" className="ml-2">
                  {backlog.length} tarefas
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Droppable droppableId="backlog" direction="horizontal">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex gap-4 min-h-[200px] overflow-x-auto pb-4"
                  >
                    {backlog.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-gray-500">
                        <div className="text-center">
                          <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Nenhuma tarefa no backlog</p>
                          <p className="text-xs text-gray-400">Clique em "Nova Tarefa" para começar</p>
                        </div>
                      </div>
                    ) : (
                      backlog
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
                              <TaskCard task={task} />
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
                      onEdit={() => {}}
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
        onClose={() => setShowCreateTask(false)}
        projectId={projectId}
        sprintId={selectedSprintId}
        onSuccess={fetchData}
      />

      <CreateSprintModal
        isOpen={showCreateSprint}
        onClose={() => setShowCreateSprint(false)}
        projectId={projectId}
        onSuccess={fetchData}
      />
    </div>
  )
}

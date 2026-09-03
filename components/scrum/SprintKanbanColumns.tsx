'use client'

import { Draggable } from '@hello-pangea/dnd'
import { KanbanColumn, useKanbanColumnCollapse } from '@/components/kanban/KanbanColumn'
import { KANBAN_COLUMNS } from '@/lib/pipeline/task-utils'
import { TaskCard } from './TaskCard'
import { cn } from '@/lib/utils'

const SPRINT_COLUMNS = KANBAN_COLUMNS

type SprintTask = {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  storyPoints?: number
  assignee?: { id: string; name: string; email: string; avatar?: string }
  dueDate?: string
  startDate?: string
  startTime?: string
  estimatedMinutes?: number
  order: number
  project?: { id: string; name: string }
  coverImageUrl?: string
}

type SprintKanbanColumnsProps = {
  sprintId: string
  tasks: SprintTask[]
  onEdit: (task: SprintTask) => void
  onDelete: (taskId: string) => void
}

export function SprintKanbanColumns({ sprintId, tasks, onEdit, onDelete }: SprintKanbanColumnsProps) {
  const { isCollapsed, toggle } = useKanbanColumnCollapse(`kanban-sprint-${sprintId}`)

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      {SPRINT_COLUMNS.map((col) => {
        const columnKey = `${sprintId}|${col.id}`
        const tasksInColumn = tasks
          .filter((t) => t.status === col.id)
          .sort((a, b) => a.order - b.order)

        return (
          <KanbanColumn
            key={col.id}
            columnId={columnKey}
            title={col.title}
            count={tasksInColumn.length}
            collapsed={isCollapsed(columnKey)}
            onToggleCollapse={() => toggle(columnKey)}
            droppableId={columnKey}
            variant="grid"
          >
            {() => (
              <>
                {tasksInColumn.map((task, index) => (
                  <Draggable key={task.id} draggableId={task.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={cn(snapshot.isDragging && 'z-50 rotate-1 scale-[1.02] shadow-xl')}
                      >
                        <TaskCard
                          task={task}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          onClick={() => onEdit(task)}
                          size="compact"
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
              </>
            )}
          </KanbanColumn>
        )
      })}
    </div>
  )
}

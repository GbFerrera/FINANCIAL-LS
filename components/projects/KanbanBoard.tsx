
import { useState, useEffect } from "react";
import { DragDropContext, Draggable, DropResult } from "@hello-pangea/dnd";
import { Archive, ArchiveRestore, CheckSquare, MoreVertical, Square } from "lucide-react";
import { TaskCard } from "../scrum/TaskCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { KanbanColumn, useKanbanColumnCollapse } from "@/components/kanban/KanbanColumn";
import { KANBAN_COLUMNS } from "@/lib/pipeline/task-utils";

interface ProjectTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  estimatedMinutes: number | null;
  startDate: string | null;
  startTime: string | null;
  endTime: string | null;
  assignee: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  } | null;
  milestone: {
    id: string;
    name: string;
    status: string;
  } | null;
  project?: {
    id: string;
    name: string;
  } | null;
  coverImageUrl?: string | null;
}

interface KanbanBoardProps {
  tasks: ProjectTask[];
  onTaskUpdate: (taskId: string, newStatus: string) => Promise<void>;
  onTaskClick: (taskId: string) => void;
  onTaskEdit?: (task: any) => void;
  onTaskDelete?: (taskId: string) => void;
  onTaskArchive?: (taskId: string) => void;
  onTaskRestore?: (taskId: string) => void;
  selectionMode?: boolean;
  selectedTaskIds?: string[];
  onToggleTaskSelection?: (taskId: string) => void;
  disableDrag?: boolean;
  showArchived?: boolean;
  archiveLoading?: boolean;
  onArchiveCompleted?: () => void;
  onStartArchiveSelection?: () => void;
  onToggleArchivedView?: () => void;
  canCompleteTasks?: boolean;
  collapseStorageKey?: string;
  className?: string;
}

const COLUMNS = KANBAN_COLUMNS;

export function KanbanBoard({
  tasks,
  onTaskUpdate,
  onTaskClick,
  onTaskEdit,
  onTaskDelete,
  onTaskArchive,
  onTaskRestore,
  selectionMode = false,
  selectedTaskIds = [],
  onToggleTaskSelection,
  disableDrag = false,
  showArchived = false,
  archiveLoading = false,
  onArchiveCompleted,
  onStartArchiveSelection,
  onToggleArchivedView,
  canCompleteTasks = true,
  collapseStorageKey = "kanban-columns-pipeline",
  className,
}: KanbanBoardProps) {
  const [boardTasks, setBoardTasks] = useState<ProjectTask[]>(tasks);
  const { isCollapsed, toggle } = useKanbanColumnCollapse(collapseStorageKey);

  useEffect(() => {
    setBoardTasks(tasks);
  }, [tasks]);

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const newStatus = destination.droppableId;
    if (newStatus === "COMPLETED" && !canCompleteTasks) {
      toast.error("Apenas administradores podem marcar tarefas como concluídas");
      return;
    }
    const originalTasks = [...boardTasks];

    const updatedTasks = boardTasks.map((task) => {
      if (task.id === draggableId) {
        return { ...task, status: newStatus };
      }
      return task;
    });

    setBoardTasks(updatedTasks);

    try {
      await onTaskUpdate(draggableId, newStatus);
    } catch {
      setBoardTasks(originalTasks);
      toast.error("Erro ao atualizar status da tarefa");
    }
  };

  const mapToCardTask = (task: ProjectTask, index: number) => ({
    id: task.id,
    title: task.title,
    description: task.description || undefined,
    status: task.status as 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED',
    priority: task.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    storyPoints: undefined,
    project: task.project ? { id: task.project.id, name: task.project.name } : undefined,
    assignee: task.assignee ? {
      id: task.assignee.id,
      name: task.assignee.name,
      email: task.assignee.email,
      avatar: task.assignee.avatar || undefined
    } : undefined,
    dueDate: task.dueDate || undefined,
    startDate: task.startDate || undefined,
    startTime: task.startTime || undefined,
    estimatedMinutes: task.estimatedMinutes || undefined,
    order: index,
    coverImageUrl: task.coverImageUrl || undefined,
  });

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden px-1 pb-2 snap-x overscroll-contain">
        {COLUMNS.map((column) => {
          const columnTasks = boardTasks.filter((task) => {
            if (column.id === 'COMPLETED' && (task.status === 'DONE' || task.status === 'COMPLETED')) return true;
            return task.status === column.id;
          });

          const completedMenu = column.id === "COMPLETED" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {!showArchived && (
                  <DropdownMenuItem onClick={onArchiveCompleted} disabled={archiveLoading}>
                    <Archive className="mr-2 h-4 w-4" />
                    Arquivar todas concluídas
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onStartArchiveSelection}>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  {showArchived ? "Selecionar para restaurar" : "Selecionar para arquivar"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleArchivedView}>
                  {showArchived ? (
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                  ) : (
                    <Archive className="mr-2 h-4 w-4" />
                  )}
                  {showArchived ? "Voltar para ativas" : "Ver todas arquivadas"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null;

          return (
            <KanbanColumn
              key={column.id}
              columnId={column.id}
              title={column.title}
              count={columnTasks.length}
              collapsed={isCollapsed(column.id)}
              onToggleCollapse={() => toggle(column.id)}
              droppableId={column.id}
              headerActions={completedMenu}
              className="h-full snap-center"
            >
              {(_, snapshot) => (
                <>
                  {columnTasks.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={disableDrag}>
                      {(provided, dragSnapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={provided.draggableProps.style}
                          className={cn(
                            "w-full shrink-0 outline-none",
                            dragSnapshot.isDragging && "z-50 rotate-1 scale-[1.02] shadow-xl"
                          )}
                          onClick={(e) => {
                            if (selectionMode && column.id === "COMPLETED") {
                              e.preventDefault();
                              e.stopPropagation();
                              onToggleTaskSelection?.(task.id);
                            }
                          }}
                        >
                          <div className="relative">
                            {selectionMode && column.id === "COMPLETED" && (
                              <div className="absolute top-2 left-2 z-10">
                                {selectedTaskIds.includes(task.id) ? (
                                  <CheckSquare className="h-5 w-5 rounded border-2 border-primary bg-card text-primary" />
                                ) : (
                                  <Square className="h-5 w-5 rounded border-2 border-border bg-card text-muted-foreground" />
                                )}
                              </div>
                            )}
                            <div
                              className={cn(
                                selectionMode && column.id === "COMPLETED" && selectedTaskIds.includes(task.id)
                                  ? "rounded-lg ring-2 ring-primary ring-offset-2"
                                  : ""
                              )}
                            >
                              <TaskCard
                                task={mapToCardTask(task, index)}
                                onClick={() => onTaskClick(task.id)}
                                onEdit={selectionMode ? undefined : onTaskEdit ? () => onTaskEdit(task) : undefined}
                                onDelete={selectionMode ? undefined : onTaskDelete ? () => onTaskDelete(task.id) : undefined}
                                onArchive={selectionMode || showArchived ? undefined : onTaskArchive ? () => onTaskArchive(task.id) : undefined}
                                onRestore={selectionMode || !showArchived ? undefined : onTaskRestore ? () => onTaskRestore(task.id) : undefined}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {columnTasks.length === 0 && !snapshot.isDraggingOver && (
                    <div className="mx-1 flex h-24 items-center justify-center rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground/50">
                      Solte aqui
                    </div>
                  )}
                </>
              )}
            </KanbanColumn>
          );
        })}
        </div>
      </div>
    </DragDropContext>
  );
}

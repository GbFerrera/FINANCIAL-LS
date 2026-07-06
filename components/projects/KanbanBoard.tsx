
import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Archive, ArchiveRestore, CheckSquare, MoreVertical, Square } from "lucide-react";
import { TaskCard } from "../scrum/TaskCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

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
}

interface KanbanBoardProps {
  tasks: ProjectTask[];
  onTaskUpdate: (taskId: string, newStatus: string) => Promise<void>;
  onTaskClick: (taskId: string) => void;
  onTaskEdit?: (task: any) => void;
  onTaskDelete?: (taskId: string) => void;
  selectionMode?: boolean;
  selectedTaskIds?: string[];
  onToggleTaskSelection?: (taskId: string) => void;
  disableDrag?: boolean;
  showArchived?: boolean;
  archiveLoading?: boolean;
  onArchiveCompleted?: () => void;
  onStartArchiveSelection?: () => void;
  onToggleArchivedView?: () => void;
}

const COLUMNS = [
  { 
    id: "TODO", 
    title: "A Fazer", 
    color: "bg-secondary/50 border-secondary",
    headerColor: "bg-secondary text-secondary-foreground"
  },
  { 
    id: "IN_PROGRESS", 
    title: "Em Andamento", 
    color: "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900",
    headerColor: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
  },
  { 
    id: "IN_REVIEW", 
    title: "Em Teste", 
    color: "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900",
    headerColor: "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300"
  },
  { 
    id: "COMPLETED", 
    title: "Concluído", 
    color: "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900",
    headerColor: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
  },
];

export function KanbanBoard({
  tasks,
  onTaskUpdate,
  onTaskClick,
  onTaskEdit,
  onTaskDelete,
  selectionMode = false,
  selectedTaskIds = [],
  onToggleTaskSelection,
  disableDrag = false,
  showArchived = false,
  archiveLoading = false,
  onArchiveCompleted,
  onStartArchiveSelection,
  onToggleArchivedView,
}: KanbanBoardProps) {
  const [boardTasks, setBoardTasks] = useState<ProjectTask[]>(tasks);

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
    const originalTasks = [...boardTasks];
    
    // Atualização otimista
    const updatedTasks = boardTasks.map((task) => {
      if (task.id === draggableId) {
        return { ...task, status: newStatus };
      }
      return task;
    });

    setBoardTasks(updatedTasks);

    try {
      await onTaskUpdate(draggableId, newStatus);
    } catch (error) {
      // Reverter em caso de erro
      setBoardTasks(originalTasks);
      toast.error("Erro ao atualizar status da tarefa");
    }
  };

  // Helper to map ProjectTask to TaskCard's Task interface
  const mapToCardTask = (task: ProjectTask, index: number) => {
    return {
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
    };
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-240px)] min-h-[500px] px-1 snap-x">
        {COLUMNS.map((column) => {
          const columnTasks = boardTasks.filter((task) => {
              if (column.id === 'COMPLETED' && (task.status === 'DONE' || task.status === 'COMPLETED')) return true;
              return task.status === column.id;
          });

          return (
            <div 
              key={column.id} 
              className={cn(
                "flex-shrink-0 w-80 flex flex-col rounded-xl border p-1.5 h-full transition-colors duration-200 snap-center",
                column.color
              )}
            >
              <div className={cn("px-3 py-3 flex items-center justify-between mb-2 rounded-lg", column.headerColor)}>
                <span className="text-sm font-bold">{column.title}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs font-mono bg-background/50 backdrop-blur-sm shadow-sm border-0">
                    {columnTasks.length}
                  </Badge>
                  {column.id === "COMPLETED" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-current hover:bg-background/20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
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
                  )}
                </div>
              </div>
              
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={cn(
                      "flex-1 px-1 pb-2 space-y-3 overflow-y-auto transition-all duration-200 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent rounded-lg",
                      snapshot.isDraggingOver ? "bg-black/5 dark:bg-white/5 ring-2 ring-inset ring-primary/20" : ""
                    )}
                  >
                    {columnTasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={disableDrag}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              ...provided.draggableProps.style,
                            }}
                            className={cn(
                              "outline-none transition-transform",
                              snapshot.isDragging ? "rotate-2 z-50 scale-105 shadow-2xl" : ""
                            )}
                            onClick={(e) => {
                              if (selectionMode && column.id === "COMPLETED") {
                                e.preventDefault()
                                e.stopPropagation()
                                onToggleTaskSelection?.(task.id)
                              }
                            }}
                          >
                            <div className="relative">
                              {selectionMode && column.id === "COMPLETED" && (
                                <div className="absolute top-2 left-2 z-10">
                                  {selectedTaskIds.includes(task.id) ? (
                                    <CheckSquare className="w-5 h-5 text-blue-600 bg-card rounded border-2 border-blue-600" />
                                  ) : (
                                    <Square className="w-5 h-5 text-gray-400 bg-card rounded border-2 border-gray-300" />
                                  )}
                                </div>
                              )}
                              <div
                                className={cn(
                                  "rounded-lg",
                                  selectionMode && column.id === "COMPLETED" && selectedTaskIds.includes(task.id)
                                    ? "ring-2 ring-blue-500 ring-offset-2"
                                    : ""
                                )}
                              >
                                <TaskCard 
                                  task={mapToCardTask(task, index)}
                                  onClick={() => onTaskClick(task.id)}
                                  onEdit={selectionMode ? undefined : onTaskEdit ? () => onTaskEdit(task) : undefined}
                                  onDelete={selectionMode ? undefined : onTaskDelete ? () => onTaskDelete(task.id) : undefined}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {columnTasks.length === 0 && !snapshot.isDraggingOver && (
                      <div className="h-24 flex items-center justify-center text-muted-foreground/40 border-2 border-dashed border-muted-foreground/10 rounded-lg m-2">
                        <span className="text-xs">Solte uma tarefa aqui</span>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}

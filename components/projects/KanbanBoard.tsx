
import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { TaskCard } from "../scrum/TaskCard";
import { Badge } from "@/components/ui/badge";
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
}

interface KanbanBoardProps {
  tasks: ProjectTask[];
  onTaskUpdate: (taskId: string, newStatus: string) => Promise<void>;
  onTaskClick: (taskId: string) => void;
  onTaskEdit?: (task: any) => void;
  onTaskDelete?: (taskId: string) => void;
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

export function KanbanBoard({ tasks, onTaskUpdate, onTaskClick, onTaskEdit, onTaskDelete }: KanbanBoardProps) {
  const [boardTasks, setBoardTasks] = useState<ProjectTask[]>(tasks);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setBoardTasks(tasks);
  }, [tasks]);

  const onDragEnd = async (result: DropResult) => {
    setIsDragging(false);
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

  const onDragStart = () => {
    setIsDragging(true);
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
    <DragDropContext onDragEnd={onDragEnd} onDragStart={onDragStart}>
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
                <Badge variant="secondary" className="text-xs font-mono bg-background/50 backdrop-blur-sm shadow-sm border-0">
                  {columnTasks.length}
                </Badge>
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
                      <Draggable key={task.id} draggableId={task.id} index={index}>
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
                          >
                            <TaskCard 
                              task={mapToCardTask(task, index)}
                              onClick={() => onTaskClick(task.id)}
                              onEdit={onTaskEdit ? () => onTaskEdit(task) : undefined}
                              onDelete={onTaskDelete ? () => onTaskDelete(task.id) : undefined}
                            />
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

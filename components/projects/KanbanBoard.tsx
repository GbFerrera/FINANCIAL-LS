
import { useState, useEffect, useRef, useCallback } from "react";
import {
  DragDropContext,
  Draggable,
  DraggableProvidedDragHandleProps,
  Droppable,
  DropResult,
} from "@hello-pangea/dnd";
import { Archive, ArchiveRestore, CheckSquare, MoreVertical, Plus, Square } from "lucide-react";
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
import {
  KANBAN_COLUMNS,
  KanbanColumnDef,
  reorderKanbanBoardTasks,
  reorderKanbanBoardTasksCustom,
  sortKanbanColumnTasks,
  taskMatchesCustomKanbanColumn,
  taskMatchesKanbanColumn,
} from "@/lib/pipeline/task-utils";
import type { TaskLabelDTO } from "@/lib/task-labels";

const COLUMN_DRAG_TYPE = "column";
const COLUMN_DRAG_PREFIX = "column::";

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
  order?: number | null
  kanbanColumnId?: string | null
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
  labels?: TaskLabelDTO[];
}

interface KanbanBoardProps {
  tasks: ProjectTask[];
  onTaskUpdate?: (taskId: string, newStatus: string) => Promise<void>;
  onTasksChange?: (tasks: ProjectTask[]) => void;
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
  columns?: KanbanColumnDef[];
  onAddColumn?: () => void;
  onColumnTitleClick?: (columnId: string) => void;
  onColumnsReorder?: (columns: KanbanColumnDef[]) => void | Promise<void>;
  allowColumnReorder?: boolean;
  highlightColumnId?: string | null;
  scrollToColumnId?: string | null;
  className?: string;
}

export function KanbanBoard({
  tasks,
  onTasksChange,
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
  columns,
  onAddColumn,
  onColumnTitleClick,
  onColumnsReorder,
  allowColumnReorder = false,
  highlightColumnId,
  scrollToColumnId,
  className,
}: KanbanBoardProps) {
  const boardColumns = columns?.length ? columns : [...KANBAN_COLUMNS];
  const useCustomColumns = Boolean(columns?.length);
  const [boardTasks, setBoardTasks] = useState<ProjectTask[]>(tasks);
  const { isCollapsed, toggle } = useKanbanColumnCollapse(collapseStorageKey);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevColumnCountRef = useRef(boardColumns.length);

  useEffect(() => {
    setBoardTasks(tasks);
  }, [tasks]);

  const scrollBoardToEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    if (boardColumns.length > prevColumnCountRef.current || scrollToColumnId) {
      scrollBoardToEnd();
    }
    prevColumnCountRef.current = boardColumns.length;
  }, [boardColumns.length, scrollToColumnId, scrollBoardToEnd]);

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId, type } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    if (type === COLUMN_DRAG_TYPE) {
      if (!onColumnsReorder || disableDrag) return;
      const nextColumns = [...boardColumns];
      const [removed] = nextColumns.splice(source.index, 1);
      nextColumns.splice(destination.index, 0, removed);
      try {
        await onColumnsReorder(nextColumns);
      } catch {
        toast.error("Erro ao reordenar colunas");
      }
      return;
    }

    const destColumnId = destination.droppableId;
    const destColumn = boardColumns.find((c) => c.id === destColumnId);
    const destIsCompleted = destColumn
      ? destColumn.status === "COMPLETED"
      : destColumnId === "COMPLETED";
    if (destIsCompleted && !canCompleteTasks) {
      toast.error("Apenas administradores podem marcar tarefas como concluídas");
      return;
    }

    const originalTasks = [...boardTasks];

    let nextTasks: ProjectTask[];
    let destOrderedIds: string[];
    let sourceOrderedIds: string[] | undefined;
    let status: string;
    let kanbanColumnId: string | undefined;

    try {
      if (useCustomColumns) {
        const reordered = reorderKanbanBoardTasksCustom(
          boardTasks,
          boardColumns,
          source.droppableId,
          destColumnId,
          draggableId,
          destination.index
        );
        nextTasks = reordered.tasks as ProjectTask[];
        destOrderedIds = reordered.destOrderedIds;
        sourceOrderedIds = reordered.sourceOrderedIds;
        status = reordered.status;
        kanbanColumnId = reordered.kanbanColumnId;
      } else {
        const reordered = reorderKanbanBoardTasks(
          boardTasks,
          source.droppableId,
          destColumnId,
          draggableId,
          destination.index
        );
        nextTasks = reordered.tasks as ProjectTask[];
        destOrderedIds = reordered.destOrderedIds;
        sourceOrderedIds = reordered.sourceOrderedIds;
        status = reordered.status;
      }
    } catch {
      toast.error("Não foi possível reordenar a tarefa");
      return;
    }

    setBoardTasks(nextTasks);

    try {
      const res = await fetch("/api/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: draggableId,
          status,
          ...(kanbanColumnId ? { kanbanColumnId } : {}),
          orderedTaskIds: destOrderedIds,
          sourceOrderedTaskIds: sourceOrderedIds,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(err.error || "Erro ao reordenar tarefa");
      }

      onTasksChange?.(nextTasks);
    } catch (error) {
      setBoardTasks(originalTasks);
      toast.error(error instanceof Error ? error.message : "Erro ao reordenar tarefa");
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
    labels: task.labels ?? [],
  });

  const renderColumn = (
    column: KanbanColumnDef,
    columnDragHandleProps?: DraggableProvidedDragHandleProps | null
  ) => {
    const columnTasks = sortKanbanColumnTasks(
      boardTasks.filter((task) =>
        useCustomColumns
          ? taskMatchesCustomKanbanColumn(column, task, boardColumns)
          : taskMatchesKanbanColumn(column.id, task.status)
      )
    );

    const isCompletedColumn = useCustomColumns
      ? column.status === "COMPLETED"
      : column.id === "COMPLETED";

    const completedMenu = isCompletedColumn ? (
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
        columnId={column.id}
        title={column.title}
        count={columnTasks.length}
        collapsed={isCollapsed(column.id)}
        onToggleCollapse={() => toggle(column.id)}
        droppableId={column.id}
        headerActions={completedMenu}
        columnDragHandleProps={columnDragHandleProps}
        onTitleClick={
          onColumnTitleClick ? () => onColumnTitleClick(column.id) : undefined
        }
        highlighted={highlightColumnId === column.id}
        className="max-h-full self-stretch snap-center"
      >
        {(_, snapshot) => (
          <>
            {columnTasks.map((task, index) => (
              <Draggable
                key={task.id}
                draggableId={task.id}
                index={index}
                type="task"
                isDragDisabled={disableDrag}
              >
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
                      if (selectionMode && isCompletedColumn) {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleTaskSelection?.(task.id);
                      }
                    }}
                  >
                    <div className="relative">
                      {selectionMode && isCompletedColumn && (
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
                          selectionMode && isCompletedColumn && selectedTaskIds.includes(task.id)
                            ? "rounded-lg ring-2 ring-primary ring-offset-2"
                            : ""
                        )}
                      >
                        <TaskCard
                          task={mapToCardTask(task, index)}
                          size="compact"
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
  };

  const addColumnCard = onAddColumn ? (
    <button
      type="button"
      onClick={onAddColumn}
      className="flex h-full max-h-full w-72 min-w-72 shrink-0 snap-center flex-col items-center justify-center gap-2 self-stretch rounded-xl border-2 border-dashed border-border/70 bg-muted/5 px-4 py-6 text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-current">
        <Plus className="h-5 w-5" />
      </span>
      <span className="text-sm font-medium">Nova coluna</span>
    </button>
  ) : null;

  const useColumnLayout = useCustomColumns && (allowColumnReorder || onAddColumn);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
        {useColumnLayout ? (
          <Droppable droppableId="kanban-columns" direction="horizontal" type={COLUMN_DRAG_TYPE}>
            {(columnsProvided) => (
              <div
                ref={(node) => {
                  columnsProvided.innerRef(node);
                  scrollRef.current = node;
                }}
                {...columnsProvided.droppableProps}
                className="flex min-h-0 flex-1 basis-0 items-stretch gap-4 overflow-x-auto px-1 pb-2 snap-x"
              >
                {boardColumns.map((column, index) =>
                  allowColumnReorder ? (
                    <Draggable
                      key={column.id}
                      draggableId={`${COLUMN_DRAG_PREFIX}${column.id}`}
                      index={index}
                      type={COLUMN_DRAG_TYPE}
                      isDragDisabled={disableDrag}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn(
                            "flex shrink-0 self-stretch",
                            snapshot.isDragging && "z-40 opacity-95 shadow-lg"
                          )}
                        >
                          {renderColumn(column, provided.dragHandleProps)}
                        </div>
                      )}
                    </Draggable>
                  ) : (
                    <div key={column.id} className="flex shrink-0 self-stretch">
                      {renderColumn(column)}
                    </div>
                  )
                )}
                {addColumnCard}
                {columnsProvided.placeholder}
              </div>
            )}
          </Droppable>
        ) : (
          <div
            ref={scrollRef}
            className="flex min-h-0 flex-1 basis-0 items-stretch gap-4 overflow-x-auto px-1 pb-2 snap-x"
          >
            {boardColumns.map((column) => renderColumn(column))}
          </div>
        )}
      </div>
    </DragDropContext>
  );
}

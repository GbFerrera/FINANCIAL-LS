'use client'

import { useEffect, useRef, useState } from 'react'
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { CustomStatusesManager } from '@/components/pipeline/CustomStatusesManager'
import { KanbanColumnStatusSelect } from '@/components/pipeline/KanbanColumnStatusSelect'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { KanbanColumnDef } from '@/lib/pipeline/task-utils'
import { newKanbanColumnId, type WorkspaceCustomStatus } from '@/lib/workspace-settings'

export type ManagementKanbanColumnsSavePayload = {
  columns: KanbanColumnDef[]
  customStatuses: WorkspaceCustomStatus[]
}

type ManagementKanbanColumnsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  columns: KanbanColumnDef[]
  customStatuses: WorkspaceCustomStatus[]
  onSave: (payload: ManagementKanbanColumnsSavePayload) => Promise<void>
  mode?: 'add' | 'manage'
  focusColumnId?: string | null
}

export function ManagementKanbanColumnsDialog({
  open,
  onOpenChange,
  columns,
  customStatuses,
  onSave,
  mode = 'manage',
  focusColumnId,
}: ManagementKanbanColumnsDialogProps) {
  const [draft, setDraft] = useState<KanbanColumnDef[]>(columns)
  const [draftStatuses, setDraftStatuses] = useState<WorkspaceCustomStatus[]>(customStatuses)
  const [saving, setSaving] = useState(false)
  const focusRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setDraftStatuses(customStatuses.map((s) => ({ ...s })))
    if (mode === 'add') {
      const newId = newKanbanColumnId()
      setDraft([...columns, { id: newId, title: '', status: 'TODO' }])
    } else {
      setDraft(columns.map((c) => ({ ...c })))
    }
  }, [open, columns, customStatuses, mode])

  useEffect(() => {
    if (!open || !focusColumnId) return
    const timer = window.setTimeout(() => focusRef.current?.focus(), 50)
    return () => window.clearTimeout(timer)
  }, [open, focusColumnId, draft.length])

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return
    if (result.destination.index === result.source.index) return
    setDraft((prev) => {
      const next = [...prev]
      const [removed] = next.splice(result.source.index, 1)
      next.splice(result.destination!.index, 0, removed)
      return next
    })
  }

  const addRow = () => {
    setDraft((prev) => [...prev, { id: newKanbanColumnId(), title: '', status: 'TODO' }])
  }

  const updateRow = (index: number, patch: Partial<KanbanColumnDef>) => {
    setDraft((prev) => prev.map((col, i) => (i === index ? { ...col, ...patch } : col)))
  }

  const removeRow = (index: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== index))
  }

  const handleCustomStatusRemoved = (removedId: string) => {
    setDraft((prev) =>
      prev.map((col) => (col.status === removedId ? { ...col, status: 'TODO' } : col))
    )
  }

  const handleSave = async () => {
    if (draft.some((col) => !col.title.trim())) {
      toast.error('Preencha o nome de todas as colunas')
      return
    }

    const normalized = draft.map((col) => ({
      ...col,
      title: col.title.trim(),
      status: col.status.trim(),
    }))

    if (normalized.length === 0) {
      return
    }

    setSaving(true)
    try {
      await onSave({ columns: normalized, customStatuses: draftStatuses })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const lastDraftId = draft[draft.length - 1]?.id

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? 'Nova coluna' : 'Colunas do quadro'}</DialogTitle>
          <DialogDescription>
            Defina o nome, reordene arrastando e escolha ou crie o status de cada coluna. As
            alterações valem para todo o espaço de gerenciamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="flex items-center justify-between gap-2">
            <Label>Colunas Kanban</Label>
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Coluna
            </Button>
          </div>

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="management-columns-editor">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                  {draft.map((col, index) => (
                    <Draggable key={col.id} draggableId={col.id} index={index}>
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={
                            snapshot.isDragging
                              ? 'rounded-lg border border-primary/30 bg-muted/40 p-2 shadow-md'
                              : 'rounded-lg border p-2'
                          }
                        >
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              className="mt-2 cursor-grab rounded p-0.5 text-muted-foreground hover:bg-muted active:cursor-grabbing"
                              aria-label="Reordenar coluna"
                              {...dragProvided.dragHandleProps}
                            >
                              <GripVertical className="h-4 w-4" />
                            </button>
                            <Input
                              ref={
                                focusColumnId === col.id ||
                                (mode === 'add' && col.id === lastDraftId && !focusColumnId)
                                  ? focusRef
                                  : undefined
                              }
                              value={col.title}
                              onChange={(e) => updateRow(index, { title: e.target.value })}
                              placeholder="Nome da coluna"
                              className="mt-0.5 flex-1"
                            />
                            <KanbanColumnStatusSelect
                              value={col.status}
                              onChange={(status) => updateRow(index, { status })}
                              customStatuses={draftStatuses}
                              onCustomStatusesChange={setDraftStatuses}
                              className="shrink-0"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="mt-0.5 shrink-0 text-destructive"
                              disabled={draft.length <= 1}
                              onClick={() => removeRow(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <CustomStatusesManager
            statuses={draftStatuses}
            onChange={setDraftStatuses}
            onStatusRemoved={handleCustomStatusRemoved}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || draft.length === 0 || draft.some((col) => !col.title.trim())}
          >
            {saving ? 'Salvando...' : 'Salvar colunas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

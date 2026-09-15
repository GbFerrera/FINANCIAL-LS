'use client'

import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  newCustomStatusId,
  workspaceStatusOptions,
  type WorkspaceCustomStatus,
} from '@/lib/workspace-settings'

type CustomStatusesManagerProps = {
  statuses: WorkspaceCustomStatus[]
  onChange: (next: WorkspaceCustomStatus[]) => void
  onStatusRemoved?: (removedId: string) => void
}

export function CustomStatusesManager({
  statuses,
  onChange,
  onStatusRemoved,
}: CustomStatusesManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [newLabel, setNewLabel] = useState('')

  const allOptions = workspaceStatusOptions(statuses)

  const startEdit = (status: WorkspaceCustomStatus) => {
    setEditingId(status.id)
    setEditLabel(status.label)
    setCreating(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditLabel('')
  }

  const saveEdit = (id: string) => {
    const label = editLabel.trim()
    if (!label) {
      toast.error('Informe o nome do status')
      return
    }
    const duplicate = allOptions.some(
      (opt) => opt.value !== id && opt.label.toLowerCase() === label.toLowerCase()
    )
    if (duplicate) {
      toast.error('Já existe um status com esse nome')
      return
    }
    onChange(statuses.map((s) => (s.id === id ? { ...s, label } : s)))
    cancelEdit()
  }

  const removeStatus = (id: string) => {
    if (!confirm('Excluir este status personalizado? Colunas que o usam voltarão para "A Fazer".')) {
      return
    }
    onChange(statuses.filter((s) => s.id !== id))
    onStatusRemoved?.(id)
    if (editingId === id) cancelEdit()
  }

  const confirmCreate = () => {
    const label = newLabel.trim()
    if (!label) {
      toast.error('Informe o nome do status')
      return
    }
    const duplicate = allOptions.some((opt) => opt.label.toLowerCase() === label.toLowerCase())
    if (duplicate) {
      toast.error('Já existe um status com esse nome')
      return
    }
    onChange([...statuses, { id: newCustomStatusId(), label }])
    setNewLabel('')
    setCreating(false)
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label className="text-sm">Status personalizados</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Edite ou exclua status criados por você neste espaço.
          </p>
        </div>
        {!creating && (
          <Button type="button" variant="outline" size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Status
          </Button>
        )}
      </div>

      {statuses.length === 0 && !creating && (
        <p className="text-xs text-muted-foreground py-1">Nenhum status personalizado ainda.</p>
      )}

      <div className="space-y-1.5">
        {statuses.map((status) =>
          editingId === status.id ? (
            <div key={status.id} className="flex items-center gap-1.5">
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                className="h-8 flex-1 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    saveEdit(status.id)
                  }
                  if (e.key === 'Escape') cancelEdit()
                }}
              />
              <Button type="button" size="sm" className="h-8" onClick={() => saveEdit(status.id)}>
                Salvar
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8" onClick={cancelEdit}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div
              key={status.id}
              className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5"
            >
              <span className="truncate text-sm">{status.label}</span>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => startEdit(status)}
                  title="Editar status"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => removeStatus(status.id)}
                  title="Excluir status"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )
        )}
      </div>

      {creating && (
        <div className="flex items-center gap-1.5 pt-1">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Nome do novo status"
            className="h-8 flex-1 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                confirmCreate()
              }
              if (e.key === 'Escape') setCreating(false)
            }}
          />
          <Button type="button" size="sm" className="h-8" onClick={confirmCreate}>
            Adicionar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={() => {
              setCreating(false)
              setNewLabel('')
            }}
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Globe, Lock, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { TASK_LABEL_COLORS, type TaskLabelDTO, type TaskLabelScope } from '@/lib/task-labels'
import { TaskLabelBadge } from '@/components/scrum/TaskLabelBadge'

type TaskLabelsPickerProps = {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  workspaceId?: string | null
  compact?: boolean
}

export function TaskLabelsPicker({
  selectedIds,
  onChange,
  workspaceId,
  compact = false,
}: TaskLabelsPickerProps) {
  const [labels, setLabels] = useState<TaskLabelDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newScope, setNewScope] = useState<TaskLabelScope>('PERSONAL')
  const [newColor, setNewColor] = useState<string>(TASK_LABEL_COLORS[0])
  const [creating, setCreating] = useState(false)

  const loadLabels = useCallback(async () => {
    setLoading(true)
    try {
      const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''
      const res = await fetch(`/api/task-labels${qs}`, { credentials: 'same-origin' })
      if (!res.ok) return
      const data = await res.json()
      setLabels(Array.isArray(data.labels) ? data.labels : [])
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    void loadLabels()
  }, [loadLabels])

  const toggleLabel = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return

    setCreating(true)
    try {
      const res = await fetch('/api/task-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          scope: newScope,
          color: newColor,
          workspaceId: workspaceId || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.id) return

      setLabels((prev) => [...prev, data as TaskLabelDTO].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
      onChange([...selectedIds, data.id])
      setNewName('')
      setShowCreate(false)
    } finally {
      setCreating(false)
    }
  }

  const selectedLabels = labels.filter((l) => selectedIds.includes(l.id))

  return (
    <div className={cn('space-y-2', compact && 'space-y-1.5')}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Etiquetas
      </p>

      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedLabels.map((label) => (
            <button key={label.id} type="button" onClick={() => toggleLabel(label.id)}>
              <TaskLabelBadge label={label} />
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : labels.length === 0 && !showCreate ? (
        <p className="text-xs text-muted-foreground">Nenhuma etiqueta disponível.</p>
      ) : (
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {labels.map((label) => {
            const active = selectedIds.includes(label.id)
            return (
              <button
                key={label.id}
                type="button"
                onClick={() => toggleLabel(label.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted',
                  active && 'bg-muted'
                )}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                <span className="min-w-0 flex-1 truncate">{label.name}</span>
                {label.scope === 'GLOBAL' ? (
                  <Globe className="h-3 w-3 shrink-0 text-muted-foreground" title="Global" />
                ) : (
                  <Lock className="h-3 w-3 shrink-0 text-muted-foreground" title="Pessoal" />
                )}
                {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>
      )}

      {showCreate ? (
        <div className="space-y-2 rounded-md border border-border/60 p-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome"
            className="h-8 text-xs"
            autoFocus
          />
          <Select value={newScope} onValueChange={(v) => setNewScope(v as TaskLabelScope)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GLOBAL">Global</SelectItem>
              <SelectItem value="PERSONAL">Somente minha</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-1">
            {TASK_LABEL_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={cn(
                  'h-5 w-5 rounded-full border-2',
                  newColor === color ? 'border-foreground' : 'border-transparent'
                )}
                style={{ backgroundColor: color }}
                onClick={() => setNewColor(color)}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <Button type="button" size="sm" className="h-7 flex-1 text-xs" disabled={creating} onClick={() => void handleCreate()}>
              Criar
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-full justify-start px-2 text-xs text-muted-foreground"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Criar etiqueta
        </Button>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { Globe, Lock, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { toast } from 'react-hot-toast'

type TaskLabelsManagerProps = {
  workspaceId?: string | null
  className?: string
}

export function TaskLabelsManager({ workspaceId, className }: TaskLabelsManagerProps) {
  const [labels, setLabels] = useState<TaskLabelDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newScope, setNewScope] = useState<TaskLabelScope>('PERSONAL')
  const [newColor, setNewColor] = useState<string>(TASK_LABEL_COLORS[0])
  const [creating, setCreating] = useState(false)

  const loadLabels = useCallback(async () => {
    setLoading(true)
    try {
      const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''
      const res = await fetch(`/api/task-labels${qs}`, { credentials: 'same-origin' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Falha ao carregar')
      }
      setLabels(Array.isArray(data.labels) ? data.labels : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar etiquetas')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    void loadLabels()
  }, [loadLabels])

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) {
      toast.error('Informe o nome da etiqueta')
      return
    }

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
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Falha ao criar')

      setLabels((prev) => {
        const next = [...prev, data as TaskLabelDTO]
        next.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        return next
      })
      setNewName('')
      toast.success('Etiqueta criada')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar etiqueta')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta etiqueta? Ela será removida de todas as tarefas.')) return

    try {
      const res = await fetch(`/api/task-labels/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao excluir')
      setLabels((prev) => prev.filter((l) => l.id !== id))
      toast.success('Etiqueta excluída')
    } catch {
      toast.error('Erro ao excluir etiqueta')
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <Label className="text-sm">Etiquetas</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Crie etiquetas globais (visíveis para todos) ou pessoais (somente para você).
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : labels.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma etiqueta criada ainda.</p>
      ) : (
        <ul className="space-y-2 max-h-56 overflow-y-auto">
          {labels.map((label) => (
            <li
              key={label.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <TaskLabelBadge label={label} />
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                  {label.scope === 'GLOBAL' ? (
                    <>
                      <Globe className="h-3 w-3" /> Global
                    </>
                  ) : (
                    <>
                      <Lock className="h-3 w-3" /> Pessoal
                    </>
                  )}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => void handleDelete(label.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 rounded-lg border border-border/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Nova etiqueta
        </p>
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome da etiqueta"
          className="h-8"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleCreate()
            }
          }}
        />
        <div className="grid grid-cols-2 gap-2">
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
                  'h-6 w-6 rounded-full border-2 transition-transform hover:scale-105',
                  newColor === color ? 'border-foreground' : 'border-transparent'
                )}
                style={{ backgroundColor: color }}
                onClick={() => setNewColor(color)}
                aria-label={`Cor ${color}`}
              />
            ))}
          </div>
        </div>
        <Button type="button" size="sm" className="w-full" disabled={creating} onClick={() => void handleCreate()}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {creating ? 'Criando...' : 'Criar etiqueta'}
        </Button>
      </div>
    </div>
  )
}

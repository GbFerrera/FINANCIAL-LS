'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CREATE_STATUS_VALUE,
  newCustomStatusId,
  resolveWorkspaceStatusLabel,
  workspaceStatusOptions,
  type WorkspaceCustomStatus,
} from '@/lib/workspace-settings'

type KanbanColumnStatusSelectProps = {
  value: string
  onChange: (value: string) => void
  customStatuses: WorkspaceCustomStatus[]
  onCustomStatusesChange: (next: WorkspaceCustomStatus[]) => void
  className?: string
}

export function KanbanColumnStatusSelect({
  value,
  onChange,
  customStatuses,
  onCustomStatusesChange,
  className,
}: KanbanColumnStatusSelectProps) {
  const [creating, setCreating] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const options = workspaceStatusOptions(customStatuses)

  const handleSelect = (next: string) => {
    if (next === CREATE_STATUS_VALUE) {
      setCreating(true)
      setNewLabel('')
      return
    }
    setCreating(false)
    onChange(next)
  }

  const confirmCreate = () => {
    const label = newLabel.trim()
    if (!label) {
      toast.error('Informe o nome do status')
      return
    }
    const duplicate = options.some((opt) => opt.label.toLowerCase() === label.toLowerCase())
    if (duplicate) {
      toast.error('Já existe um status com esse nome')
      return
    }
    const created = { id: newCustomStatusId(), label }
    onCustomStatusesChange([...customStatuses, created])
    onChange(created.id)
    setCreating(false)
    setNewLabel('')
  }

  return (
    <div className={className}>
      <Select value={value} onValueChange={handleSelect}>
        <SelectTrigger className="w-[148px]">
          <SelectValue>{resolveWorkspaceStatusLabel(value, customStatuses)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
              {opt.custom ? ' (personalizado)' : ''}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={CREATE_STATUS_VALUE}>
            <span className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Criar novo status
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {creating && (
        <div className="mt-2 flex items-center gap-1.5">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Nome do status"
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
          <Button type="button" size="sm" className="h-8 shrink-0" onClick={confirmCreate}>
            OK
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 shrink-0"
            onClick={() => setCreating(false)}
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  )
}

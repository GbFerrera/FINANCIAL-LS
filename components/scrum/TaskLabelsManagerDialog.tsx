'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TaskLabelsManager } from '@/components/scrum/TaskLabelsManager'

type TaskLabelsManagerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId?: string | null
}

export function TaskLabelsManagerDialog({
  open,
  onOpenChange,
  workspaceId,
}: TaskLabelsManagerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar etiquetas</DialogTitle>
          <DialogDescription>
            Crie etiquetas globais ou pessoais para organizar tarefas no pipeline e nos espaços de gerenciamento.
          </DialogDescription>
        </DialogHeader>
        <TaskLabelsManager workspaceId={workspaceId} />
      </DialogContent>
    </Dialog>
  )
}

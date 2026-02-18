'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'react-hot-toast'
import { 
  Clock, 
  Play, 
  CheckCircle2, 
  Pause,
  AlertTriangle
} from 'lucide-react'

interface Sprint {
  id: string
  name: string
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
}

interface EditSprintStatusModalProps {
  isOpen: boolean
  onClose: () => void
  sprint: Sprint | null
  onSuccess: () => void
}

export function EditSprintStatusModal({
  isOpen,
  onClose,
  sprint,
  onSuccess
}: EditSprintStatusModalProps) {
  const [loading, setLoading] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string>('')

  const statusOptions = [
    {
      value: 'PLANNING',
      label: 'Planejamento',
      icon: <Clock className="w-4 h-4" />,
      color: 'bg-yellow-100 text-yellow-800',
      description: 'Sprint em fase de planejamento'
    },
    {
      value: 'ACTIVE',
      label: 'Ativa',
      icon: <Play className="w-4 h-4" />,
      color: 'bg-green-100 text-green-800',
      description: 'Sprint em execução'
    },
    {
      value: 'COMPLETED',
      label: 'Concluída',
      icon: <CheckCircle2 className="w-4 h-4" />,
      color: 'bg-blue-100 text-blue-800',
      description: 'Sprint finalizada com sucesso'
    },
    {
      value: 'CANCELLED',
      label: 'Cancelada',
      icon: <Pause className="w-4 h-4" />,
      color: 'bg-red-100 text-red-800',
      description: 'Sprint cancelada'
    }
  ]

  const handleSubmit = async () => {
    if (!sprint || !selectedStatus) return

    try {
      setLoading(true)

      const response = await fetch(`/api/sprints/${sprint.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: selectedStatus })
      })

      if (!response.ok) {
        throw new Error('Erro ao atualizar status da sprint')
      }

      toast.success('Status da sprint atualizado com sucesso!')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      toast.error('Erro ao atualizar status da sprint')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSelectedStatus('')
    onClose()
  }

  const currentStatus = statusOptions.find(option => option.value === sprint?.status)
  const selectedStatusOption = statusOptions.find(option => option.value === selectedStatus)

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Alterar Status da Sprint</DialogTitle>
        </DialogHeader>

        {sprint && (
          <div className="space-y-6">
            {/* Sprint Info */}
            <div className="bg-card p-4 rounded-lg">
              <h3 className="font-medium text-foreground mb-2">{sprint.name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status atual:</span>
                {currentStatus && (
                  <Badge className={`${currentStatus.color} flex items-center gap-1`}>
                    {currentStatus.icon}
                    {currentStatus.label}
                  </Badge>
                )}
              </div>
            </div>

            {/* Status Selection */}
            <div className="space-y-3">
              <Label htmlFor="status">Novo Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o novo status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        {option.icon}
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedStatusOption && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      {selectedStatusOption.label}
                    </span>
                  </div>
                  <p className="text-sm text-blue-700">
                    {selectedStatusOption.description}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !selectedStatus || selectedStatus === sprint.status}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {loading ? 'Atualizando...' : 'Atualizar Status'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'react-hot-toast'

const taskSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  storyPoints: z.number().min(0).optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  startDate: z.string().optional(),
  startTime: z.string().optional(),
  estimatedMinutes: z.number().min(0).max(1440, 'Tempo estimado não pode exceder 24 horas (1440 minutos)').optional(),
})

type TaskFormData = z.infer<typeof taskSchema>

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  sprintId?: string | null
  onSuccess: () => void
}

interface User {
  id: string
  name: string
  email: string
}

export function CreateTaskModal({
  isOpen,
  onClose,
  projectId,
  sprintId,
  onSuccess
}: CreateTaskModalProps) {
  const [loading, setLoading] = useState(false)
  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [estimatedEndTime, setEstimatedEndTime] = useState<string>('')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      priority: 'MEDIUM',
      storyPoints: 1
    }
  })

  useEffect(() => {
    if (isOpen) {
      fetchTeamMembers()
    }
  }, [isOpen, projectId])

  // Calcular horário de fim estimado
  useEffect(() => {
    const startTime = watch('startTime')
    const estimatedMinutes = watch('estimatedMinutes')
    
    if (startTime && estimatedMinutes) {
      const [hours, minutes] = startTime.split(':').map(Number)
      const startDate = new Date()
      startDate.setHours(hours, minutes, 0, 0)
      
      const endDate = new Date(startDate.getTime() + (estimatedMinutes * 60 * 1000))
      const endTimeString = endDate.toTimeString().slice(0, 5)
      setEstimatedEndTime(endTimeString)
    } else {
      setEstimatedEndTime('')
    }
  }, [watch('startTime'), watch('estimatedMinutes')])

  const fetchTeamMembers = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/team`)
      if (response.ok) {
        const data = await response.json()
        // A API retorna um array de projectTeam com user aninhado
        const users = data.map((member: any) => member.user)
        setTeamMembers(users)
      }
    } catch (error) {
      console.error('Erro ao carregar membros da equipe:', error)
    }
  }

  const onSubmit = async (data: TaskFormData) => {
    try {
      setLoading(true)

      const taskData = {
        ...data,
        projectId,
        sprintId,
        status: 'TODO',
        ...(data.dueDate && { dueDate: new Date(data.dueDate).toISOString() }),
        ...(data.startDate && { startDate: new Date(data.startDate).toISOString() }),
        ...(data.startTime && { startTime: data.startTime }),
        ...(data.estimatedMinutes && { estimatedMinutes: data.estimatedMinutes })
      }

      const response = await fetch('/api/projects/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      })

      if (!response.ok) {
        throw new Error('Erro ao criar tarefa')
      }

      toast.success('Tarefa criada com sucesso!')
      reset()
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Erro ao criar tarefa:', error)
      toast.error('Erro ao criar tarefa')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Título */}
          <div>
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder="Digite o título da tarefa"
            />
            {errors.title && (
              <p className="text-sm text-red-500 mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* Descrição */}
          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Descreva a tarefa (opcional)"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Prioridade */}
            <div>
              <Label>Prioridade</Label>
              <Select
                value={watch('priority')}
                onValueChange={(value) => setValue('priority', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baixa</SelectItem>
                  <SelectItem value="MEDIUM">Média</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                  <SelectItem value="URGENT">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Story Points */}
            <div>
              <Label htmlFor="storyPoints">Story Points</Label>
              <Input
                id="storyPoints"
                type="number"
                min="0"
                max="100"
                {...register('storyPoints', { valueAsNumber: true })}
                placeholder="1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Responsável */}
            <div>
              <Label>Responsável</Label>
              <Select
                value={watch('assigneeId') || 'none'}
                onValueChange={(value) => setValue('assigneeId', value === 'none' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data de início */}
            <div>
              <Label htmlFor="startDate">Data de Início</Label>
              <Input
                id="startDate"
                type="date"
                {...register('startDate')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Data de vencimento */}
            <div>
              <Label htmlFor="dueDate">Data de Vencimento</Label>
              <Input
                id="dueDate"
                type="date"
                {...register('dueDate')}
              />
            </div>
          </div>

          {/* Horários */}
          <div className="grid grid-cols-2 gap-4">
            {/* Horário de Início */}
            <div>
              <Label htmlFor="startTime">Horário de Início</Label>
              <Input
                id="startTime"
                type="time"
                {...register('startTime')}
              />
            </div>

            {/* Tempo Estimado */}
            <div>
              <Label htmlFor="estimatedMinutes">Tempo Estimado (minutos)</Label>
              <Input
                id="estimatedMinutes"
                type="number"
                step="1"
                min="0"
                max="1440"
                placeholder="Ex: 90"
                {...register('estimatedMinutes', { valueAsNumber: true })}
              />
              {errors.estimatedMinutes && (
                <p className="text-sm text-red-600 mt-1">{errors.estimatedMinutes.message}</p>
              )}
            </div>
          </div>

          {/* Horário de Fim Calculado */}
          {estimatedEndTime && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-blue-700">
                    Horário de fim estimado: {estimatedEndTime}
                  </span>
                </div>
                {watch('estimatedMinutes') && (
                  <span className="text-xs text-blue-600">
                    ({Math.floor((watch('estimatedMinutes') || 0) / 60)}h {(watch('estimatedMinutes') || 0) % 60}min)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Criando...' : 'Criar Tarefa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

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
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'react-hot-toast'
import { addDays, format } from 'date-fns'

const sprintSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  startDate: z.string().min(1, 'Data de início é obrigatória'),
  endDate: z.string().min(1, 'Data de fim é obrigatória'),
  goal: z.string().optional(),
  capacity: z.number().min(0).optional(),
  projectIds: z.array(z.string()).min(1, 'Selecione pelo menos um projeto'),
}).refine((data) => {
  const start = new Date(data.startDate)
  const end = new Date(data.endDate)
  return end > start
}, {
  message: 'Data de fim deve ser posterior à data de início',
  path: ['endDate']
})

type SprintFormData = z.infer<typeof sprintSchema>

interface Project {
  id: string
  name: string
  client: {
    name: string
  }
}

interface CreateSprintModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateSprintModal({
  isOpen,
  onClose,
  onSuccess
}: CreateSprintModalProps) {
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors }
  } = useForm<SprintFormData>({
    resolver: zodResolver(sprintSchema),
    defaultValues: {
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(addDays(new Date(), 14), 'yyyy-MM-dd'), // Sprint de 2 semanas por padrão
      projectIds: []
    }
  })

  useEffect(() => {
    if (isOpen) {
      fetchProjects()
    }
  }, [isOpen])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects?includeClient=true&limit=1000')
      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Erro ao carregar projetos:', error)
    }
  }

  const handleProjectToggle = (projectId: string) => {
    const newSelection = selectedProjects.includes(projectId)
      ? selectedProjects.filter(id => id !== projectId)
      : [...selectedProjects, projectId]
    
    setSelectedProjects(newSelection)
    setValue('projectIds', newSelection)
  }

  const onSubmit = async (data: SprintFormData) => {
    try {
      setLoading(true)

      // Converter datas para ISO com meio-dia UTC para evitar problema de fuso horário
      const sprintData = {
        ...data,
        startDate: data.startDate ? data.startDate + 'T12:00:00.000Z' : data.startDate,
        endDate: data.endDate ? data.endDate + 'T12:00:00.000Z' : data.endDate,
        status: 'PLANNING'
      }

      const response = await fetch('/api/sprints/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sprintData)
      })

      if (!response.ok) {
        throw new Error('Erro ao criar sprint')
      }

      toast.success('Sprint criada com sucesso!')
      reset()
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Erro ao criar sprint:', error)
      toast.error('Erro ao criar sprint')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    reset()
    setSelectedProjects([])
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Sprint</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nome */}
          <div>
            <Label htmlFor="name">Nome da Sprint *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Ex: Sprint 1, Sprint de Login, etc."
            />
            {errors.name && (
              <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* Descrição */}
          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Descreva o foco desta sprint (opcional)"
              rows={3}
            />
          </div>

          {/* Seleção de Projetos */}
          <div>
            <Label>Projetos *</Label>
            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
              {projects.length === 0 ? (
                <p className="text-sm text-gray-500">Carregando projetos...</p>
              ) : (
                projects.map((project) => (
                  <div key={project.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={project.id}
                      checked={selectedProjects.includes(project.id)}
                      onCheckedChange={() => handleProjectToggle(project.id)}
                    />
                    <Label htmlFor={project.id} className="text-sm cursor-pointer">
                      {project.name} - {project.client.name}
                    </Label>
                  </div>
                ))
              )}
            </div>
            {errors.projectIds && (
              <p className="text-sm text-red-500 mt-1">{errors.projectIds.message}</p>
            )}
          </div>

          {/* Objetivo */}
          <div>
            <Label htmlFor="goal">Objetivo da Sprint</Label>
            <Input
              id="goal"
              {...register('goal')}
              placeholder="Ex: Implementar sistema de autenticação"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Data de início */}
            <div>
              <Label htmlFor="startDate">Data de Início *</Label>
              <Input
                id="startDate"
                type="date"
                {...register('startDate')}
              />
              {errors.startDate && (
                <p className="text-sm text-red-500 mt-1">{errors.startDate.message}</p>
              )}
            </div>

            {/* Data de fim */}
            <div>
              <Label htmlFor="endDate">Data de Fim *</Label>
              <Input
                id="endDate"
                type="date"
                {...register('endDate')}
              />
              {errors.endDate && (
                <p className="text-sm text-red-500 mt-1">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          {/* Capacidade */}
          <div>
            <Label htmlFor="capacity">Capacidade (Story Points)</Label>
            <Input
              id="capacity"
              type="number"
              min="0"
              {...register('capacity', { valueAsNumber: true })}
              placeholder="Ex: 40"
            />
            <p className="text-xs text-gray-500 mt-1">
              Capacidade total da equipe em story points para esta sprint
            </p>
          </div>

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
              {loading ? 'Criando...' : 'Criar Sprint'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

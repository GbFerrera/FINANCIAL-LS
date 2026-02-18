'use client'

import { useState, useEffect, useRef } from 'react'
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
import { FileUpload } from '@/components/ui/file-upload'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'react-hot-toast'
import { TaskChecklist } from '@/components/collaborator/TaskChecklist'

const taskSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  storyPoints: z.number().min(0).optional(),
  assigneeId: z.string().optional(),
  milestoneId: z.string().optional(),
  dueDate: z.string().optional(),
  startDate: z.string().optional(),
  startTime: z.string().optional(),
  estimatedMinutes: z.number().min(0).max(1440, 'Tempo estimado não pode exceder 24 horas (1440 minutos)').optional(),
})

type TaskFormData = z.infer<typeof taskSchema>

interface Task {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  storyPoints?: number
  assigneeId?: string
  milestoneId?: string
  dueDate?: string
  startDate?: string
  startTime?: string
  estimatedMinutes?: number
}

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  projectId?: string
  sprintId?: string | null
  onSuccess: () => void
  editingTask?: Task | null
  sprintProjects?: Project[]
  milestones?: Milestone[]
}

interface User {
  id: string
  name: string
  email: string
}

interface Project {
  id: string
  name: string
  client: {
    name: string
  }
}
interface Milestone {
  id: string
  title: string
}

export function CreateTaskModal({
  isOpen,
  onClose,
  projectId,
  sprintId,
  onSuccess,
  editingTask,
  sprintProjects: propSprintProjects = [],
  milestones: propMilestones = []
}: CreateTaskModalProps) {
  const [loading, setLoading] = useState(false)
  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [estimatedEndTime, setEstimatedEndTime] = useState<string>('')
  const [sprintProjects, setSprintProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  type UploadFileInfo = {
    id: string
    originalName: string
    fileName: string
    filePath: string
    fileSize: number
    fileType: string
    uploadedAt: string
    taskId?: string
    file?: File
  }
  const [attachments, setAttachments] = useState<UploadFileInfo[]>([])
  const fileUploadRef = useRef<{ handleUpload: (taskIdOverride?: string) => Promise<UploadFileInfo[]> } | null>(null)

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
      // Usar projetos passados como prop ou buscar da API
      if (propSprintProjects.length > 0) {
        console.log('Usando projetos passados como prop:', propSprintProjects)
        setSprintProjects(propSprintProjects)
      } else if (sprintId) {
        console.log('Buscando projetos da API para sprintId:', sprintId)
        fetchSprintProjects()
      }
      
      // Definir projeto inicial
      if (projectId) {
        setSelectedProjectId(projectId)
      }
      
      fetchTeamMembers()
      
      // Se estiver editando, preencher o formulário
      if (editingTask) {
        setValue('title', editingTask.title)
        setValue('description', editingTask.description || '')
        setValue('priority', editingTask.priority)
        setValue('storyPoints', editingTask.storyPoints || 1)
        setValue('assigneeId', editingTask.assigneeId)
        setValue('milestoneId', editingTask.milestoneId)
        setValue('dueDate', editingTask.dueDate ? editingTask.dueDate.split('T')[0] : '')
        setValue('startDate', editingTask.startDate ? editingTask.startDate.split('T')[0] : '')
        setValue('startTime', editingTask.startTime || '')
        setValue('estimatedMinutes', editingTask.estimatedMinutes)
        // Carregar anexos existentes
        ;(async () => {
          try {
            const res = await fetch(`/api/tasks/${editingTask.id}/attachments`)
            if (res.ok) {
              const data = await res.json()
              const mapped = (data.attachments || []).map((a: any) => ({
                id: a.filename,
                originalName: a.originalName || a.filename,
                fileName: a.filename,
                filePath: a.filePath,
                fileSize: a.size || 0,
                fileType: a.mimeType || 'application/octet-stream',
                uploadedAt: new Date().toISOString(),
                taskId: editingTask.id,
              })) as UploadFileInfo[]
              setAttachments(mapped)
            }
          } catch (e) {
            // Silencioso: anexos não são críticos para edição
          }
        })()
      } else {
        // Limpar formulário para nova tarefa
        reset({
          priority: 'MEDIUM',
          storyPoints: 1
        })
        setSelectedProjectId(projectId || '')
        setAttachments([])
      }
    }
  }, [isOpen, projectId, sprintId, editingTask, setValue, reset])

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

  // Debug useEffect
  useEffect(() => {
    console.log('sprintProjects state changed:', sprintProjects.length, sprintProjects)
  }, [sprintProjects])

  const fetchSprintProjects = async () => {
    try {
      console.log('Buscando projetos da sprint:', sprintId)
      const response = await fetch(`/api/sprints/${sprintId}/projects`)
      if (response.ok) {
        const projects = await response.json()
        console.log('Projetos encontrados:', projects)
        setSprintProjects(projects)
        
        // Se não há projeto selecionado e há projetos na sprint, selecionar o primeiro
        if (!selectedProjectId && projects.length > 0) {
          setSelectedProjectId(projects[0].id)
        }
      } else {
        console.error('Erro na resposta da API:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Erro ao buscar projetos da sprint:', error)
    }
  }

  const fetchTeamMembers = async () => {
    try {
      const currentProjectId = selectedProjectId || projectId
      if (!currentProjectId) {
        // Se não há projeto definido, buscar todos os usuários
        const usersResponse = await fetch('/api/users')
        if (usersResponse.ok) {
          const allUsers = await usersResponse.json()
          setTeamMembers(allUsers)
        }
        return
      }

      // Primeiro, tenta buscar os membros da equipe do projeto
      const teamResponse = await fetch(`/api/projects/${currentProjectId}/team`)
      if (teamResponse.ok) {
        const teamData: Array<{ user: User }> = await teamResponse.json()
        const teamUsers = teamData.map((member) => member.user)
        
        if (teamUsers.length > 0) {
          setTeamMembers(teamUsers)
          return
        }
      }
      
      // Se não houver membros na equipe do projeto, busca todos os usuários disponíveis
      const usersResponse = await fetch('/api/users')
      if (usersResponse.ok) {
        const allUsers = await usersResponse.json()
        setTeamMembers(allUsers)
      }
    } catch (error) {
      console.error('Erro ao carregar membros da equipe:', error)
      // Em caso de erro, tenta buscar todos os usuários como fallback
      try {
        const usersResponse = await fetch('/api/users')
        if (usersResponse.ok) {
          const allUsers = await usersResponse.json()
          setTeamMembers(allUsers)
        }
      } catch (fallbackError) {
        console.error('Erro ao carregar usuários como fallback:', fallbackError)
      }
    }
  }

  const onSubmit = async (data: TaskFormData) => {
    try {
      setLoading(true)

      const currentProjectId = selectedProjectId || projectId
      if (!currentProjectId) {
        toast.error('Selecione um projeto para a tarefa')
        return
      }

      // Converter datas para ISO com meio-dia UTC para evitar problema de fuso horário
      const taskData = {
        ...data,
        projectId: currentProjectId,
        // Só incluir sprintId se for uma nova tarefa ou se estiver explicitamente definido
        ...(editingTask ? {} : { sprintId }),
        status: editingTask ? editingTask.status : 'TODO',
        ...(data.dueDate && { dueDate: data.dueDate + 'T12:00:00.000Z' }),
        ...(data.startDate && { startDate: data.startDate + 'T12:00:00.000Z' }),
        ...(data.startTime && { startTime: data.startTime }),
        ...(data.estimatedMinutes && { estimatedMinutes: data.estimatedMinutes })
      }

      const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/projects/tasks'
      const method = editingTask ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      })

      if (!response.ok) {
        throw new Error(editingTask ? 'Erro ao editar tarefa' : 'Erro ao criar tarefa')
      }

      const createdTask = await response.json()

      // Se houver anexos selecionados na criação, enviar após obter o taskId
      if (!editingTask && attachments.length > 0 && createdTask?.id) {
        try {
          await fileUploadRef.current?.handleUpload(createdTask.id)
        } catch {
          // Se falhar upload, seguir com criação e avisar
        }
      }
      // Se estiver editando e houver novos arquivos (previews), enviar vinculando ao taskId existente
      if (editingTask && attachments.some((f) => !!f.file)) {
        try {
          await fileUploadRef.current?.handleUpload(editingTask.id)
        } catch {
          // Se falhar upload, seguir com edição e avisar
        }
      }

      toast.success(editingTask ? 'Tarefa editada com sucesso!' : 'Tarefa criada com sucesso!')
      reset()
      setAttachments([])
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
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
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
              rows={6}
              className="min-h-[140px]"
            />
          </div>

          {/* Anexos (opcional) */}
          <div>
            <Label className="mb-2 block">Imagens/Arquivos (opcional)</Label>
            <div className="bg-card rounded-lg p-3 border border-muted">
              <FileUpload
                ref={(instance) => {
                  fileUploadRef.current = instance as unknown as { handleUpload: (taskIdOverride?: string) => Promise<UploadFileInfo[]> }
                }}
                taskId={editingTask?.id}
                existingFiles={attachments}
                onFilesChange={(files) => setAttachments(files as UploadFileInfo[])}
                maxFiles={5}
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Prioridade */}
            <div>
              <Label>Prioridade</Label>
              <Select
                value={watch('priority')}
                onValueChange={(value) => setValue('priority', value as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT')}
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

          {/* Seleção de Projeto (apenas quando há múltiplos projetos na sprint) */}
          {sprintProjects.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <Label className="text-blue-900 font-medium">Projeto da Sprint *</Label>
              <p className="text-sm text-blue-700 mb-3">
                Esta sprint inclui múltiplos projetos. Selecione para qual projeto esta tarefa pertence.
              </p>
              <Select
                value={selectedProjectId}
                onValueChange={(value) => {
                  setSelectedProjectId(value)
                  // Recarregar membros da equipe quando projeto mudar
                  fetchTeamMembers()
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar projeto" />
                </SelectTrigger>
                <SelectContent>
                  {sprintProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name} - {project.client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Responsável */}
            <div>
              <Label>Responsável</Label>
              {sprintProjects.length > 0 && selectedProjectId && (
                <p className="text-xs text-muted-foreground mb-2">
                  Colaboradores do projeto selecionado
                </p>
              )}
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

            {/* Milestone */}
            <div>
              <Label>Milestone</Label>
              <Select
                value={watch('milestoneId') || 'none'}
                onValueChange={(value) => setValue('milestoneId', value === 'none' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar milestone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {propMilestones.map((milestone) => (
                    <SelectItem key={milestone.id} value={milestone.id}>
                      {milestone.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          {/* Checklist de Tarefas (apenas edição) */}
          {editingTask && (
            <div className="border-t pt-4 mt-4">
              <Label className="mb-2 block">Checklist e Subtarefas</Label>
              <div className="bg-card rounded-lg p-4 border border-muted">
                <TaskChecklist taskId={editingTask.id} />
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
              {loading 
                ? (editingTask ? 'Salvando...' : 'Criando...') 
                : (editingTask ? 'Salvar Alterações' : 'Criar Tarefa')
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

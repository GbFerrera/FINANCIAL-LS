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
import { Calendar, Clock, Flag, Tag, Target, User, Briefcase, CheckSquare } from 'lucide-react'

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
  description?: string | null
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  storyPoints?: number | null
  assigneeId?: string | null
  milestoneId?: string | null
  dueDate?: string | null
  startDate?: string | null
  startTime?: string | null
  estimatedMinutes?: number | null
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
        setValue('storyPoints', editingTask.storyPoints ?? 1)
        setValue('assigneeId', editingTask.assigneeId || undefined)
        setValue('milestoneId', editingTask.milestoneId || undefined)
        setValue('dueDate', editingTask.dueDate ? editingTask.dueDate.split('T')[0] : '')
        setValue('startDate', editingTask.startDate ? editingTask.startDate.split('T')[0] : '')
        setValue('startTime', editingTask.startTime || '')
        setValue('estimatedMinutes', editingTask.estimatedMinutes ?? undefined)
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
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit, (errors) => console.error('Validation errors:', errors))} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Coluna Esquerda - Principal */}
            <div className="lg:col-span-7 space-y-4">
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
                  rows={12}
                  className="min-h-[200px]"
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

              {/* Checklist de Tarefas (apenas edição) */}
              {editingTask && (
                <div className="border-t pt-4 mt-4">
                  <Label className="mb-2 block">Checklist e Subtarefas</Label>
                  <div className="bg-card rounded-lg p-4 border border-muted">
                    <TaskChecklist taskId={editingTask.id} />
                  </div>
                </div>
              )}
            </div>

            {/* Coluna Direita - Metadados */}
            <div className="lg:col-span-5 space-y-5">
              
              {/* Seleção de Projeto (apenas quando há múltiplos projetos na sprint) */}
              {sprintProjects.length > 0 && (
                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-primary/10 rounded-md">
                      <Briefcase className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-semibold text-sm text-foreground">Projeto</span>
                  </div>
                  <Select
                    value={selectedProjectId}
                    onValueChange={(value) => {
                      setSelectedProjectId(value)
                      fetchTeamMembers()
                    }}
                  >
                    <SelectTrigger className="bg-background">
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

              {/* Grupo: Classificação e Planejamento */}
              <div className="bg-muted/30 rounded-lg p-4 border border-border/50 space-y-4">
                <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                  <div className="p-1.5 bg-blue-500/10 rounded-md">
                    <Tag className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="font-semibold text-sm text-foreground">Classificação</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Prioridade */}
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Flag className="w-3 h-3" /> Prioridade
                    </Label>
                    <Select
                      value={watch('priority')}
                      onValueChange={(value) => setValue('priority', value as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT')}
                    >
                      <SelectTrigger className="h-9 bg-background">
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
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Target className="w-3 h-3" /> Story Points
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      {...register('storyPoints', { valueAsNumber: true })}
                      placeholder="1"
                      className="h-9 bg-background"
                    />
                  </div>

                  {/* Milestone */}
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                      <CheckSquare className="w-3 h-3" /> Milestone
                    </Label>
                    <Select
                      value={watch('milestoneId') || 'none'}
                      onValueChange={(value) => setValue('milestoneId', value === 'none' ? undefined : value)}
                    >
                      <SelectTrigger className="h-9 bg-background">
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
              </div>

              {/* Grupo: Atribuição */}
              <div className="bg-muted/30 rounded-lg p-4 border border-border/50 space-y-4">
                <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                  <div className="p-1.5 bg-purple-500/10 rounded-md">
                    <User className="w-4 h-4 text-purple-500" />
                  </div>
                  <span className="font-semibold text-sm text-foreground">Responsável</span>
                </div>
                
                <div>
                  {sprintProjects.length > 0 && selectedProjectId && (
                    <p className="text-[10px] text-muted-foreground mb-1.5 ml-1">
                      Membros do projeto selecionado
                    </p>
                  )}
                  <Select
                    value={watch('assigneeId') || 'none'}
                    onValueChange={(value) => setValue('assigneeId', value === 'none' ? undefined : value)}
                  >
                    <SelectTrigger className="h-9 bg-background">
                      <SelectValue placeholder="Atribuir a..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguém</SelectItem>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Grupo: Agendamento */}
              <div className="bg-muted/30 rounded-lg p-4 border border-border/50 space-y-4">
                <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                  <div className="p-1.5 bg-orange-500/10 rounded-md">
                    <Calendar className="w-4 h-4 text-orange-500" />
                  </div>
                  <span className="font-semibold text-sm text-foreground">Prazos e Tempo</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Data Início */}
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Início</Label>
                    <Input
                      type="date"
                      {...register('startDate')}
                      className="h-9 bg-background text-xs"
                    />
                  </div>

                  {/* Data Entrega */}
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Entrega</Label>
                    <Input
                      type="date"
                      {...register('dueDate')}
                      className="h-9 bg-background text-xs"
                    />
                  </div>

                  {/* Hora Início */}
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Hora Início
                    </Label>
                    <Input
                      type="time"
                      {...register('startTime')}
                      className="h-9 bg-background text-xs"
                    />
                  </div>

                  {/* Tempo Estimado */}
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Estimado (min)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      {...register('estimatedMinutes', { valueAsNumber: true })}
                      placeholder="0"
                      className="h-9 bg-background text-xs"
                    />
                  </div>
                  
                  {/* Previsão de Término */}
                  {estimatedEndTime && (
                    <div className="col-span-2 bg-blue-500/5 border border-blue-500/20 rounded-md p-2 flex items-center justify-between">
                      <span className="text-xs text-blue-700 font-medium">Previsão de término:</span>
                      <span className="text-sm font-bold text-blue-700">{estimatedEndTime}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-4 border-t mt-6">
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
              className="bg-primary"
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

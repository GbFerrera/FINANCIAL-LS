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
import { toast } from 'react-hot-toast'
import { TaskChecklist } from '@/components/collaborator/TaskChecklist'
import { TaskCommentsPanel } from '@/components/scrum/TaskCommentsPanel'
import { TaskMetadataControls } from '@/components/scrum/TaskMetadataControls'
import { cn } from '@/lib/utils'
import { mergeAttachmentDescription } from '@/lib/task-attachments'
import { AlignLeft, Paperclip, CheckSquare } from 'lucide-react'

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
  hasBonus: z.boolean().optional(),
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
      storyPoints: 1,
      hasBonus: false,
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
        // @ts-ignore - campo pode não estar no tipo gerado até migrar
        setValue('hasBonus', (editingTask as any).hasBonus ?? false)
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
          storyPoints: 1,
          hasBonus: false,
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
        ...(data.estimatedMinutes && { estimatedMinutes: data.estimatedMinutes }),
        // @ts-ignore
        ...(data.hasBonus !== undefined ? { hasBonus: !!data.hasBonus } : {}),
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
      const taskId = editingTask?.id || createdTask?.id

      const syncAttachmentDescription = async (uploadedFiles: UploadFileInfo[]) => {
        if (!taskId) return
        const persisted = uploadedFiles.filter(
          (f) => f.filePath && !f.filePath.startsWith('blob:') && !f.file
        )
        if (persisted.length === 0) return

        const description = mergeAttachmentDescription(
          editingTask?.description || taskData.description || createdTask.description,
          persisted.map((f) => ({
            originalName: f.originalName,
            fileType: f.fileType,
            filePath: f.filePath,
          }))
        )

        await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description }),
        })
      }

      // Se houver anexos selecionados na criação, enviar após obter o taskId
      if (!editingTask && attachments.length > 0 && createdTask?.id) {
        try {
          const uploadedFiles = (await fileUploadRef.current?.handleUpload(createdTask.id)) || []
          await syncAttachmentDescription(uploadedFiles)
        } catch {
          // Se falhar upload, seguir com criação e avisar
        }
      }
      // Se estiver editando e houver novos arquivos (previews), enviar vinculando ao taskId existente
      if (editingTask && attachments.some((f) => !!f.file)) {
        try {
          const uploadedFiles = (await fileUploadRef.current?.handleUpload(editingTask.id)) || []
          await syncAttachmentDescription(uploadedFiles)
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

  const metadataControls = (
    <TaskMetadataControls
      watch={watch}
      setValue={setValue}
      register={register}
      teamMembers={teamMembers}
      milestones={propMilestones}
      sprintProjects={sprintProjects}
      selectedProjectId={selectedProjectId}
      onProjectChange={(value) => {
        setSelectedProjectId(value)
        fetchTeamMembers()
      }}
      estimatedEndTime={estimatedEndTime}
      showSummary
    />
  )

  const mainFields = (
    <>
      {!editingTask && (
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
      )}

      {editingTask && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div
              className="mt-2 h-5 w-5 shrink-0 rounded-full border-2 border-muted-foreground/50"
              aria-hidden
            />
            <div className="flex-1 min-w-0">
              <Input
                id="title"
                {...register('title')}
                placeholder="Título do cartão"
                className="text-lg font-semibold border-0 shadow-none px-0 h-auto focus-visible:ring-0 bg-transparent"
              />
              {errors.title && (
                <p className="text-sm text-red-500 mt-1">{errors.title.message}</p>
              )}
            </div>
          </div>
          <div className="pl-8">{metadataControls}</div>
        </div>
      )}

      <div className={editingTask ? 'pl-8 space-y-2' : ''}>
        {editingTask && (
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlignLeft className="w-4 h-4 text-muted-foreground" />
            Descrição
          </div>
        )}
        {!editingTask && <Label htmlFor="description">Descrição</Label>}
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Descreva a tarefa (opcional)"
          rows={editingTask ? 8 : 12}
          className={editingTask ? 'min-h-[140px] bg-muted/10 border-muted/50' : 'min-h-[200px]'}
        />
      </div>

      <div className={editingTask ? 'pl-8 space-y-2' : ''}>
        {editingTask ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Paperclip className="w-4 h-4 text-muted-foreground" />
            Anexos
          </div>
        ) : (
          <Label className="mb-2 block">Imagens/Arquivos (opcional)</Label>
        )}
        <div className={editingTask ? 'rounded-lg' : 'bg-card rounded-lg p-3 border border-muted'}>
          <FileUpload
            ref={(instance) => {
              fileUploadRef.current = instance as unknown as {
                handleUpload: (taskIdOverride?: string) => Promise<UploadFileInfo[]>
              }
            }}
            taskId={editingTask?.id}
            existingFiles={attachments}
            onFilesChange={(files) => setAttachments(files as UploadFileInfo[])}
            maxFiles={5}
            disabled={loading}
          />
        </div>
      </div>

      {editingTask && (
        <div className="pl-8 pt-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
            <CheckSquare className="w-4 h-4 text-muted-foreground" />
            Checklist
          </div>
          <div className={editingTask ? '' : 'bg-card rounded-lg p-4 border border-muted'}>
            <TaskChecklist taskId={editingTask.id} />
          </div>
        </div>
      )}
    </>
  )

  const formFooter = (
    <div className="flex justify-end gap-2 px-6 py-4 border-t bg-background shrink-0">
      <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
        Cancelar
      </Button>
      <Button type="submit" disabled={loading} className="bg-primary">
        {loading
          ? editingTask
            ? 'Salvando...'
            : 'Criando...'
          : editingTask
            ? 'Salvar alterações'
            : 'Criar Tarefa'}
      </Button>
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          editingTask
            ? 'sm:max-w-[1080px] max-h-[92vh] p-0 gap-0 overflow-hidden flex flex-col'
            : 'sm:max-w-[900px] max-h-[90vh] overflow-y-auto'
        )}
      >
        <DialogHeader className={editingTask ? 'sr-only' : undefined}>
          <DialogTitle>{editingTask ? 'Detalhes da tarefa' : 'Nova Tarefa'}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit, (errors) => console.error('Validation errors:', errors))}
          className={cn(editingTask && 'flex flex-col flex-1 min-h-0')}
        >
          {editingTask ? (
            <>
              <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
                <div className="flex-1 overflow-y-auto p-6 space-y-5 min-h-0">
                  {mainFields}
                </div>
                <aside className="lg:w-[360px] shrink-0 border-t lg:border-t-0 lg:border-l flex flex-col min-h-[280px] lg:min-h-0 lg:max-h-[calc(92vh-4rem)]">
                  <TaskCommentsPanel taskId={editingTask.id} />
                </aside>
              </div>
              {formFooter}
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-4">{mainFields}</div>
                <div className="lg:col-span-5 pt-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Configurações
                  </p>
                  {metadataControls}
                </div>
              </div>
              {formFooter}
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { FileUpload } from '@/components/ui/file-upload'
import { toast } from 'react-hot-toast'
import { TaskChecklist } from '@/components/collaborator/TaskChecklist'
import { TaskCommentsPanel } from '@/components/scrum/TaskCommentsPanel'
import { TaskMetadataControls } from '@/components/scrum/TaskMetadataControls'
import { cn } from '@/lib/utils'
import {
  mergeAttachmentDescription,
  parseAttachmentsFromDescription,
  pickCoverUrl,
  isImageAttachment,
  getAttachmentName,
  getAttachmentMime,
  resolveAttachmentUrl,
  removeAttachmentFromDescription,
  stripAttachmentSectionFromDescription,
} from '@/lib/task-attachments'
import { AlignLeft, Paperclip, CheckSquare, ExternalLink, MoreVertical, Trash2 } from 'lucide-react'

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
  coverImageUrl?: string | null
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
  const [fullDescription, setFullDescription] = useState('')
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null)
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null)
  const fileUploadRef = useRef<{ handleUpload: (taskIdOverride?: string) => Promise<UploadFileInfo[]> } | null>(null)

  const coverUrl = useMemo(() => {
    if (!editingTask) return null
    const candidates = attachments.map((a) => ({
      originalName: a.originalName,
      fileType: a.fileType,
      filePath: a.filePath,
      url: a.filePath.startsWith('blob:')
        ? a.filePath
        : a.filePath
          ? `/api/files/${a.filePath}`
          : undefined,
    }))
    candidates.push(...parseAttachmentsFromDescription(fullDescription || editingTask.description))
    const fromAttachments = pickCoverUrl(candidates, failedCoverUrl)
    if (fromAttachments) return fromAttachments
    if (editingTask.coverImageUrl && editingTask.coverImageUrl !== failedCoverUrl) {
      return editingTask.coverImageUrl
    }
    return null
  }, [attachments, editingTask, failedCoverUrl, fullDescription])

  useEffect(() => {
    setFailedCoverUrl(null)
  }, [editingTask?.id])

  const handleDeleteAttachment = async (file: UploadFileInfo) => {
    if (!editingTask) return
    if (!confirm(`Remover o anexo "${file.originalName}"?`)) return

    const removeLocally = (nextDescription: string) => {
      setAttachments((prev) => prev.filter((f) => f.id !== file.id))
      setFullDescription(nextDescription)
      setValue('description', stripAttachmentSectionFromDescription(nextDescription))
      setFailedCoverUrl(null)
    }

    if (file.file || file.filePath.startsWith('blob:')) {
      if (file.filePath.startsWith('blob:')) {
        URL.revokeObjectURL(file.filePath)
      }
      removeLocally(
        removeAttachmentFromDescription(fullDescription || editingTask.description || '', {
          filePath: file.filePath,
          fileName: file.fileName,
          originalName: file.originalName,
        })
      )
      return
    }

    setDeletingAttachmentId(file.id)
    try {
      const res = await fetch(`/api/tasks/${editingTask.id}/attachments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          filePath: file.filePath,
          filename: file.fileName || file.filePath.split('/').pop(),
        }),
      })
      if (!res.ok) throw new Error('Falha ao remover')
      removeLocally(
        removeAttachmentFromDescription(fullDescription || editingTask.description || '', {
          filePath: file.filePath,
          fileName: file.fileName,
          originalName: file.originalName,
        })
      )
      toast.success('Anexo removido')
      onSuccess()
    } catch {
      toast.error('Erro ao remover anexo')
    } finally {
      setDeletingAttachmentId(null)
    }
  }

  const getCoverAttachment = (): UploadFileInfo | undefined => {
    if (!coverUrl) return undefined
    return attachments.find((file) => {
      const previewUrl = file.filePath.startsWith('blob:')
        ? file.filePath
        : resolveAttachmentUrl({
            originalName: file.originalName,
            fileType: file.fileType,
            filePath: file.filePath,
          })
      return previewUrl === coverUrl
    })
  }

  const handleDeleteCover = async () => {
    const file = getCoverAttachment()
    if (file) {
      await handleDeleteAttachment(file)
      return
    }

    const match = parseAttachmentsFromDescription(fullDescription || editingTask?.description).find(
      (a) => resolveAttachmentUrl(a) === coverUrl
    )
    if (!match || !editingTask || !coverUrl) return

    const pseudoFile: UploadFileInfo = {
      id: `cover-${match.filePath || getAttachmentName(match)}`,
      originalName: getAttachmentName(match),
      fileName: match.filePath?.split('/').pop() || getAttachmentName(match),
      filePath: match.filePath || '',
      fileSize: 0,
      fileType: getAttachmentMime(match),
      uploadedAt: new Date().toISOString(),
      taskId: editingTask.id,
    }
    await handleDeleteAttachment(pseudoFile)
  }

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
        const initialDescription = editingTask.description || ''
        setFullDescription(initialDescription)
        setValue('title', editingTask.title)
        setValue('description', stripAttachmentSectionFromDescription(initialDescription))
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
        setAttachments([])
        // Carregar anexos existentes
        ;(async () => {
          try {
            const res = await fetch(`/api/tasks/${editingTask.id}/attachments`, {
              credentials: 'same-origin',
            })
            let mapped: UploadFileInfo[] = []
            if (res.ok) {
              const data = await res.json()
              mapped = (data.attachments || []).map((a: {
                filename: string
                originalName?: string
                filePath?: string
                size?: number
                mimeType?: string
                url?: string
              }) => ({
                id: a.filename,
                originalName: a.originalName || a.filename,
                fileName: a.filename,
                filePath: a.filePath || '',
                fileSize: a.size || 0,
                fileType: a.mimeType || 'application/octet-stream',
                uploadedAt: new Date().toISOString(),
                taskId: editingTask.id,
              })) as UploadFileInfo[]
            }
            if (mapped.length === 0) {
              mapped = parseAttachmentsFromDescription(initialDescription).map((a, index) => ({
                id: `desc-${index}`,
                originalName: getAttachmentName(a),
                fileName: getAttachmentName(a),
                filePath: a.filePath || '',
                fileSize: 0,
                fileType: getAttachmentMime(a),
                uploadedAt: new Date().toISOString(),
                taskId: editingTask.id,
              }))
            }
            setAttachments(mapped)
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
        setFullDescription('')
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
          fullDescription || editingTask?.description || taskData.description || createdTask.description,
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
          {editingTask && attachments.some((f) => isImageAttachment({
            originalName: f.originalName,
            fileType: f.fileType,
            filePath: f.filePath,
          })) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              {attachments
                .filter((f) => isImageAttachment({
                  originalName: f.originalName,
                  fileType: f.fileType,
                  filePath: f.filePath,
                }))
                .map((file) => {
                  const previewUrl = file.filePath.startsWith('blob:')
                    ? file.filePath
                    : resolveAttachmentUrl({
                        originalName: file.originalName,
                        fileType: file.fileType,
                        filePath: file.filePath,
                      }) || ''
                  return (
                    <div
                      key={file.id}
                      className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted/40"
                    >
                      <button
                        type="button"
                        className="block h-full w-full"
                        onClick={() => window.open(previewUrl, '_blank')}
                      >
                        <img
                          src={previewUrl}
                          alt={file.originalName}
                          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                        />
                      </button>
                      <div className="absolute top-1.5 right-1.5 z-10">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 rounded-md bg-black/55 text-white hover:bg-black/75 hover:text-white"
                              disabled={deletingAttachmentId === file.id}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                window.open(previewUrl, '_blank')
                              }}
                            >
                              <ExternalLink className="mr-2 h-3.5 w-3.5" />
                              Abrir
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteAttachment(file)
                              }}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-left text-[10px] text-white truncate">
                        {file.originalName}
                      </span>
                    </div>
                  )
                })}
            </div>
          )}
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
            ? 'sm:max-w-[1080px] max-h-[92vh] p-0 gap-0 overflow-hidden flex flex-col [&>[data-slot=dialog-close]]:z-20 [&>[data-slot=dialog-close]]:bg-black/40 [&>[data-slot=dialog-close]]:text-white [&>[data-slot=dialog-close]]:hover:bg-black/60'
            : 'sm:max-w-[900px] max-h-[90vh] overflow-y-auto'
        )}
      >
        {editingTask && coverUrl && (
          <div className="relative shrink-0 bg-neutral-950">
            <button
              type="button"
              className="flex w-full items-center justify-center"
              onClick={() => window.open(coverUrl, '_blank')}
            >
              <img
                src={coverUrl}
                alt=""
                className="max-h-[min(420px,42vh)] w-full object-contain"
                onError={() => setFailedCoverUrl(coverUrl)}
              />
            </button>
            <div className="absolute top-3 right-12 z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-md bg-black/55 text-white hover:bg-black/75 hover:text-white"
                    disabled={!!deletingAttachmentId}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => window.open(coverUrl, '_blank')}>
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    Abrir
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={() => handleDeleteCover()}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Remover capa
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <button
              type="button"
              className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-xs text-white hover:bg-black/70"
              onClick={() => window.open(coverUrl, '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir
            </button>
          </div>
        )}
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

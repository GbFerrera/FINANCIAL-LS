'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { LoadingAnimation, LoadingInline, LoadingScreen } from '@/components/ui/loading-animation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { PlaneEditor } from '@/components/ui/plane-editor'
import { PLANE_TASK_DESCRIPTION_TEMPLATE } from '@/lib/plane-editor/template'
import { Label } from '@/components/ui/label'
import { FileUpload } from '@/components/ui/file-upload'
import { toast } from 'react-hot-toast'
import { TaskChecklist } from '@/components/collaborator/TaskChecklist'
import { TaskCommentsPanel } from '@/components/scrum/TaskCommentsPanel'
import { TaskMetadataControls } from '@/components/scrum/TaskMetadataControls'
import { cn } from '@/lib/utils'
import { setActiveTaskViewId } from '@/lib/active-task-view'
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
import { TaskSharePanel } from '@/components/scrum/TaskSharePanel'
import {
  Paperclip,
  ExternalLink,
  MoreVertical,
  Trash2,
  Link2,
  Bell,
  ChevronLeft,
  Maximize2,
  Minimize2,
  PanelRightOpen,
  PanelRightClose,
  GitBranch,
  ListTree,
  Archive,
  ArchiveRestore,
  Loader2,
} from 'lucide-react'

function getTaskIdentifier(task: { id: string }, projectName?: string) {
  const prefix = projectName
    ? projectName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase() || 'TASK'
    : 'TASK'
  return `${prefix}-${task.id.slice(-4).toUpperCase()}`
}

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
  isArchived?: boolean
}

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  projectId?: string
  sprintId?: string | null
  onSuccess: () => void
  onEditingTaskSync?: (patch: Partial<Task>) => void
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
  onEditingTaskSync,
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
  const [taskArchived, setTaskArchived] = useState(false)
  const [actionLoading, setActionLoading] = useState<'archive' | 'restore' | 'delete' | null>(null)
  const [isSheetFullscreen, setIsSheetFullscreen] = useState(false)
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const fileUploadRef = useRef<{ handleUpload: (taskIdOverride?: string) => Promise<UploadFileInfo[]> } | null>(null)
  const skipAutoSaveRef = useRef(true)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedPayloadRef = useRef('')

  useEffect(() => {
    if (isOpen && editingTask?.id) {
      setActiveTaskViewId(editingTask.id)
      return () => setActiveTaskViewId(null)
    }
    setActiveTaskViewId(null)
  }, [isOpen, editingTask?.id])

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

  useEffect(() => {
    if (!editingTask?.id || !isOpen) return
    setTaskArchived(!!editingTask.isArchived)
    fetch(`/api/tasks/${editingTask.id}`)
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        setTaskArchived(!!data.isArchived)
      })
      .catch(() => {})
  }, [editingTask?.id, editingTask?.isArchived, isOpen])

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
    getValues,
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

  const buildDescriptionForSave = useCallback(
    (body: string) => {
      const persisted = attachments.filter(
        (f) => f.filePath && !f.filePath.startsWith('blob:') && !f.file
      )
      if (persisted.length > 0) {
        return mergeAttachmentDescription(
          body,
          persisted.map((f) => ({
            originalName: f.originalName,
            fileType: f.fileType,
            filePath: f.filePath,
          }))
        )
      }

      const parsed = parseAttachmentsFromDescription(
        fullDescription || editingTask?.description
      )
      if (parsed.length > 0) {
        return mergeAttachmentDescription(
          body,
          parsed.map((a) => ({
            originalName: getAttachmentName(a),
            fileType: getAttachmentMime(a),
            filePath: a.filePath || '',
          }))
        )
      }

      return body
    },
    [attachments, fullDescription, editingTask?.description]
  )

  const buildEditPayload = useCallback(
    (data: TaskFormData) => ({
      title: data.title,
      description: buildDescriptionForSave(data.description || ''),
      priority: data.priority,
      storyPoints: data.storyPoints,
      assigneeId: data.assigneeId || null,
      milestoneId: data.milestoneId || null,
      startDate: data.startDate ? `${data.startDate}T12:00:00.000Z` : null,
      dueDate: data.dueDate ? `${data.dueDate}T12:00:00.000Z` : null,
      startTime: data.startTime || null,
      estimatedMinutes: data.estimatedMinutes ?? null,
      hasBonus: !!data.hasBonus,
    }),
    [buildDescriptionForSave]
  )

  const persistTaskEdits = useCallback(
    async (override?: Partial<TaskFormData>) => {
      if (!editingTask) return false

      const data = { ...getValues(), ...override }
      const payload = buildEditPayload(data)
      const snapshot = JSON.stringify(payload)
      if (snapshot === lastSavedPayloadRef.current) return true

      setAutoSaveStatus('saving')
      try {
        const res = await fetch(`/api/tasks/${editingTask.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Falha ao salvar')

        lastSavedPayloadRef.current = snapshot
        setFullDescription(payload.description)
        setAutoSaveStatus('saved')
        onEditingTaskSync?.({
          startDate: data.startDate || null,
          dueDate: data.dueDate || null,
          startTime: data.startTime || null,
          estimatedMinutes: data.estimatedMinutes ?? null,
        })
        onSuccess()
        window.setTimeout(() => {
          setAutoSaveStatus((current) => (current === 'saved' ? 'idle' : current))
        }, 2000)
        return true
      } catch {
        setAutoSaveStatus('error')
        toast.error('Erro ao salvar alterações')
        return false
      }
    },
    [editingTask, buildEditPayload, onSuccess, onEditingTaskSync, getValues]
  )

  const commitDates = useCallback(
    (dates: { startDate?: string; dueDate?: string }) => {
      if (!editingTask) return Promise.resolve()

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      skipAutoSaveRef.current = true
      if ('startDate' in dates) {
        setValue('startDate', dates.startDate ?? '', { shouldDirty: true })
      }
      if ('dueDate' in dates) {
        setValue('dueDate', dates.dueDate ?? '', { shouldDirty: true })
      }
      return persistTaskEdits(dates).finally(() => {
        window.setTimeout(() => {
          skipAutoSaveRef.current = false
        }, 400)
      })
    },
    [editingTask, persistTaskEdits, setValue]
  )

  const scheduleAutoSave = useCallback(() => {
    if (!editingTask || skipAutoSaveRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void persistTaskEdits()
    }, 700)
  }, [editingTask, persistTaskEdits])

  useEffect(() => {
    if (!isOpen || !editingTask) return

    skipAutoSaveRef.current = true
    setAutoSaveStatus('idle')

    const timer = window.setTimeout(() => {
      lastSavedPayloadRef.current = JSON.stringify(buildEditPayload(getValues()))
      skipAutoSaveRef.current = false
    }, 600)

    return () => window.clearTimeout(timer)
  }, [isOpen, editingTask?.id, buildEditPayload, getValues])

  useEffect(() => {
    if (!isOpen || !editingTask) return

    const subscription = watch(() => {
      scheduleAutoSave()
    })

    return () => {
      subscription.unsubscribe()
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [isOpen, editingTask?.id, watch, scheduleAutoSave])

  useEffect(() => {
    if (!isOpen) return

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

      // Só repopular ao abrir ou ao trocar de tarefa — não em cada sync remoto
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
          description: PLANE_TASK_DESCRIPTION_TEMPLATE,
        })
        setSelectedProjectId(projectId || '')
        setAttachments([])
        setFullDescription('')
      }
  }, [isOpen, projectId, sprintId, editingTask?.id, setValue, reset])

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
    if (editingTask) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      await persistTaskEdits(data)

      if (attachments.some((f) => !!f.file)) {
        try {
          setLoading(true)
          const uploadedFiles =
            (await fileUploadRef.current?.handleUpload(editingTask.id)) || []
          if (uploadedFiles.length > 0) {
            const description = mergeAttachmentDescription(
              getValues('description') || '',
              uploadedFiles
                .filter((f) => f.filePath && !f.filePath.startsWith('blob:') && !f.file)
                .map((f) => ({
                  originalName: f.originalName,
                  fileType: f.fileType,
                  filePath: f.filePath,
                }))
            )
            await fetch(`/api/tasks/${editingTask.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ description }),
            })
            setFullDescription(description)
            onSuccess()
          }
        } catch {
          toast.error('Erro ao enviar anexos')
        } finally {
          setLoading(false)
        }
      }

      return
    }

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

  const handleClose = async () => {
    if (editingTask) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
        await persistTaskEdits(getValues())
      }
    }
    reset()
    setIsSheetFullscreen(false)
    setIsSidePanelOpen(false)
    setAutoSaveStatus('idle')
    skipAutoSaveRef.current = true
    onClose()
  }

  const handleArchiveTask = async () => {
    if (!editingTask) return
    if (editingTask.status !== 'COMPLETED') {
      toast.error('Apenas tarefas concluídas podem ser arquivadas')
      return
    }
    if (!confirm('Arquivar esta tarefa? Ela sairá do quadro ativo.')) return

    setActionLoading('archive')
    try {
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao arquivar tarefa')

      toast.success('Tarefa arquivada')
      onSuccess()
      handleClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao arquivar tarefa')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRestoreTask = async () => {
    if (!editingTask) return
    if (!confirm('Restaurar esta tarefa para o quadro ativo?')) return

    setActionLoading('restore')
    try {
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: false }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao restaurar tarefa')

      toast.success('Tarefa restaurada')
      onSuccess()
      handleClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao restaurar tarefa')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteTask = async () => {
    if (!editingTask) return
    if (!confirm('Excluir esta tarefa permanentemente? Esta ação não pode ser desfeita.')) return

    setActionLoading('delete')
    try {
      const res = await fetch(`/api/tasks/${editingTask.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir tarefa')

      toast.success('Tarefa excluída')
      onSuccess()
      handleClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir tarefa')
    } finally {
      setActionLoading(null)
    }
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
      onDatesCommit={commitDates}
    />
  )

  const sidebarProperties = (
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
      hideToolbar
      onDatesCommit={commitDates}
    />
  )

  const watchedDescription = watch('description')
  const descriptionForEditor =
    watchedDescription != null
      ? watchedDescription
      : editingTask
        ? stripAttachmentSectionFromDescription(editingTask.description || '')
        : ''

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
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {getTaskIdentifier(
              editingTask,
              sprintProjects.find((p) => p.id === selectedProjectId)?.name
            )}
          </p>
          <div className="flex items-start gap-3">
            <div
              className="mt-2.5 h-5 w-5 shrink-0 rounded-full border-2 border-muted-foreground/40"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <Input
                id="title"
                {...register('title')}
                placeholder="Título do item"
                className="h-auto border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={cn(editingTask ? 'space-y-2' : '')}>
        {!editingTask && <Label htmlFor="description">Descrição</Label>}
        <PlaneEditor
          key={editingTask?.id ?? 'create-task'}
          value={descriptionForEditor}
          onChange={(html) => {
            setValue('description', html, { shouldDirty: true, shouldValidate: true })
            scheduleAutoSave()
          }}
          placeholder="Clique para adicionar descrição"
          variant={editingTask ? 'sheet' : 'default'}
          minHeight={editingTask ? 120 : 220}
          defaultTemplate={!editingTask ? PLANE_TASK_DESCRIPTION_TEMPLATE : undefined}
        />
      </div>

      <div className={cn(!editingTask && 'space-y-2')}>
        {!editingTask && (
          <Label className="mb-2 block">Imagens/Arquivos (opcional)</Label>
        )}
        <div className={cn(!editingTask && 'rounded-lg border border-muted bg-card p-3')}>
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
    </>
  )

  const sheetActionChips = editingTask && (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" className="h-8 text-xs font-normal">
        <ListTree className="mr-1.5 h-3.5 w-3.5" />
        Adicionar sub-item
      </Button>
      <Button type="button" variant="outline" size="sm" className="h-8 text-xs font-normal">
        <GitBranch className="mr-1.5 h-3.5 w-3.5" />
        Adicionar relação
      </Button>
      <Button type="button" variant="outline" size="sm" className="h-8 text-xs font-normal">
        <Link2 className="mr-1.5 h-3.5 w-3.5" />
        Adicionar link
      </Button>
      <Button type="button" variant="outline" size="sm" className="h-8 text-xs font-normal">
        <Paperclip className="mr-1.5 h-3.5 w-3.5" />
        Anexar
      </Button>
    </div>
  )

  const sheetChecklist = editingTask && (
    <section className="space-y-3 border-t border-border/60 pt-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Sub-itens de trabalho</h3>
      </div>
      <TaskChecklist taskId={editingTask.id} />
    </section>
  )

  const sheetProperties = editingTask && (
    <section className="space-y-3 border-t border-border/60 pt-5">
      <h3 className="text-sm font-semibold text-foreground">Propriedades</h3>
      {sidebarProperties}
    </section>
  )

  const sheetActivity = editingTask && (
    <section className="border-t border-border/60 pt-5">
      <TaskCommentsPanel taskId={editingTask.id} variant="plane" />
    </section>
  )

  const autoSaveLabel =
    autoSaveStatus === 'saving'
      ? 'Salvando...'
      : autoSaveStatus === 'saved'
        ? 'Salvo'
        : autoSaveStatus === 'error'
          ? 'Erro ao salvar'
          : null

  const formFooter = editingTask ? (
    <div className="flex items-center justify-between gap-2 border-t bg-background px-6 py-4 shrink-0">
      <div className="flex flex-wrap items-center gap-2">
        {!taskArchived && editingTask.status === 'COMPLETED' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleArchiveTask}
            disabled={!!actionLoading}
          >
            {actionLoading === 'archive' ? (
              <LoadingInline size="xs" className="mr-2" />
            ) : (
              <Archive className="mr-2 h-4 w-4" />
            )}
            Arquivar
          </Button>
        )}
        {taskArchived && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRestoreTask}
            disabled={!!actionLoading}
          >
            {actionLoading === 'restore' ? (
              <LoadingInline size="xs" className="mr-2" />
            ) : (
              <ArchiveRestore className="mr-2 h-4 w-4" />
            )}
            Restaurar
          </Button>
        )}
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={handleDeleteTask}
          disabled={!!actionLoading}
        >
          {actionLoading === 'delete' ? (
            <LoadingInline size="xs" className="mr-2" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Excluir
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground min-h-4">
          {autoSaveLabel}
        </span>
        <Button type="button" variant="outline" onClick={() => void handleClose()}>
          Fechar
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex justify-end gap-2 px-6 py-4 border-t bg-background shrink-0">
      <Button type="button" variant="outline" onClick={() => void handleClose()} disabled={loading}>
        Cancelar
      </Button>
      <Button type="submit" disabled={loading} className="bg-primary">
        {loading ? 'Criando...' : 'Criar Tarefa'}
      </Button>
    </div>
  )

  return (
    <>
      {isOpen && editingTask ? (
      <Sheet open onOpenChange={(open) => { if (!open) handleClose() }}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className={cn(
            'gap-0 overflow-hidden p-0 transition-[max-width,width] duration-300 ease-out',
            isSheetFullscreen
              ? '!w-full !max-w-none sm:!max-w-none'
              : isSidePanelOpen
                ? 'sm:max-w-[min(1140px,calc(100vw-2rem))]'
                : 'sm:max-w-[720px]'
          )}
        >
          <SheetTitle className="sr-only">Detalhes da tarefa</SheetTitle>
          {editingTask && (
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex h-full min-h-0 flex-col"
            >
              {/* Toolbar */}
              <div className="flex shrink-0 items-center justify-between border-b px-2 py-1.5">
                <div className="flex items-center">
                  <Button type="button" variant="ghost" size="icon-sm" onClick={handleClose} aria-label="Voltar">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className={cn('text-muted-foreground', isSheetFullscreen && 'bg-muted text-foreground')}
                    aria-label={isSheetFullscreen ? 'Restaurar largura' : 'Tela cheia'}
                    onClick={() => setIsSheetFullscreen((v) => !v)}
                  >
                    {isSheetFullscreen ? (
                      <Minimize2 className="h-3.5 w-3.5" />
                    ) : (
                      <Maximize2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className={cn('text-muted-foreground', isSidePanelOpen && 'bg-muted text-foreground')}
                    aria-label={isSidePanelOpen ? 'Ocultar painel lateral' : 'Mostrar painel lateral'}
                    onClick={() => setIsSidePanelOpen((v) => !v)}
                  >
                    {isSidePanelOpen ? (
                      <PanelRightClose className="h-3.5 w-3.5" />
                    ) : (
                      <PanelRightOpen className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <div className="flex items-center gap-1 pr-2">
                  {autoSaveLabel && (
                    <span className="mr-1 text-xs text-muted-foreground">{autoSaveLabel}</span>
                  )}
                  <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs font-normal">
                    <Bell className="h-3.5 w-3.5" />
                    Inscrever-se
                  </Button>
                  <TaskSharePanel taskId={editingTask.id} compact />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={handleClose}>Fechar</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {!taskArchived && editingTask.status === 'COMPLETED' && (
                        <DropdownMenuItem
                          onClick={handleArchiveTask}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === 'archive' ? (
                            <LoadingInline size="xs" className="mr-2" />
                          ) : (
                            <Archive className="mr-2 h-4 w-4" />
                          )}
                          Arquivar tarefa
                        </DropdownMenuItem>
                      )}
                      {taskArchived && (
                        <DropdownMenuItem
                          onClick={handleRestoreTask}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === 'restore' ? (
                            <LoadingInline size="xs" className="mr-2" />
                          ) : (
                            <ArchiveRestore className="mr-2 h-4 w-4" />
                          )}
                          Restaurar tarefa
                        </DropdownMenuItem>
                      )}
                      {!taskArchived && editingTask.status !== 'COMPLETED' && (
                        <DropdownMenuItem disabled className="text-muted-foreground">
                          <Archive className="mr-2 h-4 w-4 opacity-40" />
                          Arquivar (conclua antes)
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleDeleteTask}
                        disabled={!!actionLoading}
                        className="text-destructive focus:text-destructive"
                      >
                        {actionLoading === 'delete' ? (
                          <LoadingInline size="xs" className="mr-2" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Excluir tarefa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Cover opcional */}
              {coverUrl && (
                <div className="relative shrink-0 border-b bg-neutral-950">
                  <button type="button" className="flex w-full items-center justify-center" onClick={() => window.open(coverUrl, '_blank')}>
                    <img
                      src={coverUrl}
                      alt=""
                      className="max-h-48 w-full object-contain"
                      onError={() => setFailedCoverUrl(coverUrl)}
                    />
                  </button>
                </div>
              )}

              {/* Conteúdo scrollável */}
              <div
                className={cn(
                  'min-h-0 flex-1',
                  isSidePanelOpen ? 'flex overflow-hidden' : 'overflow-y-auto'
                )}
              >
                <div
                  className={cn(
                    isSidePanelOpen ? 'min-h-0 w-[720px] shrink-0 overflow-y-auto' : ''
                  )}
                >
                  <div className="space-y-5 px-6 py-5">
                    {mainFields}
                    {sheetActionChips}
                    {sheetChecklist}
                    {!isSidePanelOpen && sheetProperties}
                    {!isSidePanelOpen && sheetActivity}
                  </div>
                </div>
                {isSidePanelOpen && (
                  <aside className="flex w-[420px] shrink-0 flex-col overflow-y-auto border-l bg-muted/5">
                    <div className="space-y-5 p-5">
                      {sheetProperties}
                      {sheetActivity}
                    </div>
                  </aside>
                )}
              </div>

              {formFooter}
            </form>
          )}
        </SheetContent>
      </Sheet>
      ) : null}

      {isOpen && !editingTask ? (
      <Dialog open onOpenChange={(open) => { if (!open) handleClose() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit, (errors) => console.error('Validation errors:', errors))}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="space-y-4 lg:col-span-7">{mainFields}</div>
                <div className="pt-1 lg:col-span-5">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Configurações
                  </p>
                  {metadataControls}
                </div>
              </div>
              {formFooter}
            </div>
          </form>
        </DialogContent>
      </Dialog>
      ) : null}
    </>
  )
}

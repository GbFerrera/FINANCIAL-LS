'use client'

import { useState, useEffect, useMemo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { LoadingAnimation, LoadingInline, LoadingScreen } from '@/components/ui/loading-animation'
import {
  getAttachmentName,
  getAttachmentMime,
  isImageAttachment,
  parseAttachmentsFromDescription,
  pickCoverUrl,
} from '@/lib/task-attachments'
import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  Circle,
  LayoutGrid,
  Loader2,
  MoreVertical,
  Paperclip,
  PauseCircle,
  PlayCircle,
  Signal,
  Edit,
  Trash2,
  Archive,
  ArchiveRestore,
  Bot,
  Image as ImageIcon,
  FileText,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { toast } from 'react-hot-toast'
import {
  buildTaskAgentClipboardText,
  ensureTaskShareLink,
} from '@/lib/task-share-client'
import { TASK_STATUS_LABELS } from '@/lib/pipeline/task-utils'

interface Task {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  storyPoints?: number
  project?: {
    id: string
    name: string
  }
  assignee?: {
    id: string
    name: string
    email: string
    avatar?: string
  }
  dueDate?: string
  startDate?: string
  startTime?: string
  estimatedMinutes?: number
  order: number
  attachments?: Array<{
    id: string
    originalName: string
    fileType: string
    fileSize: number
    filePath?: string
  }>
  coverImageUrl?: string
}

interface TaskCardProps {
  task: Task
  onClick?: () => void
  onEdit?: (task: Task) => void
  onDelete?: (taskId: string) => void
  onArchive?: (taskId: string) => void
  onRestore?: (taskId: string) => void
  size?: 'default' | 'compact'
}

function formatDateSafe(dateString: string) {
  const raw = dateString.includes('T') ? dateString.split('T')[0] : dateString
  const [year, month, day] = raw.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function getTaskIdentifier(task: Task) {
  const prefix = task.project?.name
    ? task.project.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'TASK'
    : 'TASK'
  return `${prefix}-${task.id.slice(-4).toUpperCase()}`
}

function PropertyPill({
  children,
  className,
  title,
  compact = false,
}: {
  children: React.ReactNode
  className?: string
  title?: string
  compact?: boolean
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded border border-border/80 bg-background text-muted-foreground',
        compact
          ? 'h-6 max-w-[140px] px-1.5 text-[10px]'
          : 'h-7 max-w-[180px] px-2 text-[11px]',
        className
      )}
    >
      {children}
    </span>
  )
}

export function TaskCard({
  task,
  onClick,
  onEdit,
  onDelete,
  onArchive,
  onRestore,
  size = 'default',
}: TaskCardProps) {
  const isCompact = size === 'compact'
  const iconClass = isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'
  const menuBtnClass = isCompact ? 'h-6 w-6' : 'h-7 w-7'
  const menuIconClass = isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const [showAttachments, setShowAttachments] = useState(false)
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null)
  const [diskAttachments, setDiskAttachments] = useState<
    Array<{ originalName: string; fileType: string; filePath?: string; url?: string }>
  >([])
  const [copyingForAgent, setCopyingForAgent] = useState(false)

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    onClick?.()
  }

  const limitChars = (s: string, max: number) => (s.length > max ? `${s.slice(0, max).trim()}…` : s)

  const isOverdue = () => {
    if (!task.dueDate) return false
    const raw = task.dueDate.includes('T') ? task.dueDate.split('T')[0] : task.dueDate
    const [y, m, d] = raw.split('-').map(Number)
    const due = new Date(y, m - 1, d)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return task.status !== 'COMPLETED' && due < today
  }

  const getStatusIcon = () => {
    switch (task.status) {
      case 'IN_PROGRESS':
        return <PlayCircle className={cn(iconClass, 'text-amber-500')} />
      case 'IN_REVIEW':
        return <PauseCircle className={cn(iconClass, 'text-violet-500')} />
      case 'COMPLETED':
        return <CheckCircle2 className={cn(iconClass, 'text-emerald-500')} />
      default:
        return <Circle className={cn(iconClass, 'text-muted-foreground')} />
    }
  }

  const getStatusLabel = () => TASK_STATUS_LABELS[task.status] || 'A Fazer'

  const getPriorityLabel = () => {
    switch (task.priority) {
      case 'LOW':
        return 'Baixa'
      case 'HIGH':
        return 'Alta'
      case 'URGENT':
        return 'Urgente'
      default:
        return 'Média'
    }
  }

  const getPriorityIconClass = () => {
    switch (task.priority) {
      case 'LOW':
        return 'text-muted-foreground'
      case 'HIGH':
        return 'text-orange-500'
      case 'URGENT':
        return 'text-red-500'
      default:
        return 'text-sky-500'
    }
  }

  const hasAttachments = () => {
    if (diskAttachments.length > 0) return true
    if (task.attachments && task.attachments.length > 0) return true
    return task.description?.includes('📎 Anexos (') || false
  }

  const getAttachmentsCount = () => {
    if (diskAttachments.length > 0) return diskAttachments.length
    if (task.attachments && task.attachments.length > 0) return task.attachments.length
    const match = task.description?.match(/📎 Anexos \((\d+)\):/)
    return match ? parseInt(match[1]) : 0
  }

  const getAttachmentsFromDescription = () => {
    if (diskAttachments.length > 0) return diskAttachments
    if (task.attachments && task.attachments.length > 0) return task.attachments
    return parseAttachmentsFromDescription(task.description)
  }

  useEffect(() => {
    setFailedCoverUrl(null)
  }, [task.id])

  useEffect(() => {
    let cancelled = false
    const fetchDiskAttachments = async () => {
      try {
        const res = await fetch(`/api/tasks/${task.id}/attachments`, { credentials: 'same-origin' })
        if (!res.ok) return
        const data: {
          attachments?: Array<{ originalName: string; mimeType: string; filePath?: string; url?: string }>
        } = await res.json()
        const mapped = (data.attachments || []).map((a) => ({
          originalName: a.originalName,
          fileType: a.mimeType,
          filePath: a.filePath,
          url: a.url || (a.filePath ? `/api/files/${a.filePath}` : undefined),
        }))
        if (!cancelled) setDiskAttachments(mapped)
      } catch {
        /* ignore */
      }
    }
    fetchDiskAttachments()
    return () => {
      cancelled = true
    }
  }, [task.id])

  const coverUrl = useMemo(() => {
    if (task.coverImageUrl && task.coverImageUrl !== failedCoverUrl) return task.coverImageUrl
    const candidates = [
      ...diskAttachments,
      ...(task.attachments || []).map((a) => ({
        originalName: a.originalName,
        fileType: a.fileType,
        filePath: a.filePath,
        url: a.filePath ? `/api/files/${a.filePath}` : a.id ? `/api/files/${a.id}` : undefined,
      })),
      ...parseAttachmentsFromDescription(task.description),
    ]
    return pickCoverUrl(candidates, failedCoverUrl)
  }, [failedCoverUrl, diskAttachments, task.attachments, task.description, task.coverImageUrl])

  const handleCopyForAgent = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (copyingForAgent) return
    try {
      setCopyingForAgent(true)
      const { shareUrl, agentApiUrl } = await ensureTaskShareLink(task.id)
      const text = buildTaskAgentClipboardText(
        {
          title: task.title,
          projectName: task.project?.name,
          status: getStatusLabel(),
          priority: getPriorityLabel(),
          assigneeName: task.assignee?.name,
        },
        shareUrl,
        agentApiUrl
      )
      await navigator.clipboard.writeText(text)
      toast.success('Detalhes + link copiados para colar na IA')
    } catch {
      toast.error('Erro ao copiar link da task')
    } finally {
      setCopyingForAgent(false)
    }
  }

  const cardMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('p-0 text-muted-foreground hover:bg-muted', menuBtnClass)}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className={menuIconClass} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCopyForAgent} disabled={copyingForAgent} className="flex items-center gap-2">
          {copyingForAgent ? <LoadingInline size="md" /> : <Bot className="h-3 w-3" />}
          Copiar para IA
        </DropdownMenuItem>
        {onEdit && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onEdit(task)
            }}
            className="flex items-center gap-2"
          >
            <Edit className="h-3 w-3" />
            Editar
          </DropdownMenuItem>
        )}
        {onArchive && task.status === 'COMPLETED' && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onArchive(task.id)
            }}
            className="flex items-center gap-2"
          >
            <Archive className="h-3 w-3" />
            Arquivar
          </DropdownMenuItem>
        )}
        {onRestore && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onRestore(task.id)
            }}
            className="flex items-center gap-2"
          >
            <ArchiveRestore className="h-3 w-3" />
            Restaurar
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onDelete(task.id)
            }}
            className="flex items-center gap-2 text-red-600"
          >
            <Trash2 className="h-3 w-3" />
            Excluir
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div
      className={cn(
        'group cursor-pointer overflow-hidden rounded-lg border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:border-border hover:shadow-md',
        isOverdue() && 'border-red-200/80 dark:border-red-900/50'
      )}
      onClick={handleCardClick}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {coverUrl && (
        <div className="relative w-full bg-muted/30">
          <img
            src={coverUrl}
            alt=""
            className={cn('w-full object-cover object-top', isCompact ? 'h-[7.5rem]' : 'h-36')}
            loading="lazy"
            onError={() => setFailedCoverUrl(coverUrl)}
          />
          <div className="absolute inset-x-0 top-0 flex justify-end bg-gradient-to-b from-black/25 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
            {cardMenu}
          </div>
        </div>
      )}

      <div className={cn(isCompact ? 'space-y-2.5 p-3' : 'space-y-3.5 p-4')}>
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              'font-medium uppercase tracking-wide text-muted-foreground/80',
              isCompact ? 'text-[10px]' : 'text-[11px]'
            )}
          >
            {getTaskIdentifier(task)}
          </span>
          {!coverUrl && cardMenu}
        </div>

        <h3
          className={cn(
            'line-clamp-3 font-semibold leading-snug text-foreground',
            isCompact ? 'text-[13px]' : 'text-[15px] leading-relaxed'
          )}
          title={task.title}
        >
          {limitChars(task.title, isCompact ? 200 : 240)}
        </h3>

        <div className={cn('flex flex-wrap', isCompact ? 'gap-1.5' : 'gap-2')}>
          <PropertyPill compact={isCompact} title={`Status: ${getStatusLabel()}`}>
            {getStatusIcon()}
            <span className="truncate">{getStatusLabel()}</span>
          </PropertyPill>

          <PropertyPill compact={isCompact} title={`Prioridade: ${getPriorityLabel()}`}>
            <Signal className={cn(iconClass, getPriorityIconClass())} />
          </PropertyPill>

          {task.dueDate && (
            <PropertyPill
              compact={isCompact}
              title={`Vencimento: ${formatDateSafe(task.dueDate)}`}
              className={isOverdue() ? 'border-red-200 text-red-600 dark:border-red-900/50' : undefined}
            >
              <Calendar className={cn(iconClass, 'shrink-0')} />
              <span className="truncate">{formatDateSafe(task.dueDate)}</span>
            </PropertyPill>
          )}

          {task.startDate && (
            <PropertyPill compact={isCompact} title={`Início: ${formatDateSafe(task.startDate)}`}>
              <CalendarClock className={cn(iconClass, 'shrink-0')} />
            </PropertyPill>
          )}

          {task.assignee && (
            <PropertyPill compact={isCompact} title={task.assignee.name}>
              <Avatar className={cn('shrink-0', isCompact ? 'h-4 w-4' : 'h-5 w-5')}>
                <AvatarImage src={task.assignee.avatar} />
                <AvatarFallback className={cn('bg-primary/10', isCompact ? 'text-[8px]' : 'text-[9px]')}>
                  {task.assignee.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </PropertyPill>
          )}

          {task.project?.name && (
            <PropertyPill compact={isCompact} title={task.project.name}>
              <LayoutGrid className={cn(iconClass, 'shrink-0')} />
              <span className="truncate">{limitChars(task.project.name, isCompact ? 16 : 22)}</span>
            </PropertyPill>
          )}

          {hasAttachments() && (
            <PropertyPill compact={isCompact} title={`${getAttachmentsCount()} anexo(s)`}>
              <button
                type="button"
                className="inline-flex items-center gap-1"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowAttachments(!showAttachments)
                }}
              >
                <Paperclip className={iconClass} />
                <span>{getAttachmentsCount()}</span>
              </button>
            </PropertyPill>
          )}
        </div>

        {showAttachments && hasAttachments() && (
          <div className="max-h-24 space-y-1 overflow-y-auto border-t border-border/60 pt-2">
            {getAttachmentsFromDescription().map((attachment, index) => {
              const fileName = getAttachmentName(attachment)
              const fileType = getAttachmentMime(attachment)
              const isImage = isImageAttachment(attachment)
              const isPDF = fileType === 'application/pdf'
              return (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded px-1 py-1 text-[10px] hover:bg-muted/50"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isImage ? (
                    <ImageIcon className="h-3 w-3 text-sky-500" />
                  ) : isPDF ? (
                    <FileText className="h-3 w-3 text-red-500" />
                  ) : (
                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="truncate text-foreground">{fileName}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

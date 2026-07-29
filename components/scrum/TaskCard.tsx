'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useState, useEffect, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  getAttachmentName,
  getAttachmentMime,
  isImageAttachment,
  parseAttachmentsFromDescription,
  pickCoverUrl,
} from '@/lib/task-attachments'
import { 
  Clock, 
  Flag, 
  Calendar,
  CheckCircle2,
  Circle,
  PlayCircle,
  PauseCircle,
  MoreVertical,
  Edit,
  Trash2,
  MessageSquare,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Bot,
  Loader2
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
  size?: 'default' | 'compact'
}

// Função para formatar data sem problemas de fuso horário
const formatDateSafe = (dateString: string) => {
  // Se a data já está no formato ISO, extrair apenas a parte da data
  if (dateString.includes('T')) {
    dateString = dateString.split('T')[0]
  }
  
  // Dividir a data em partes (YYYY-MM-DD)
  const [year, month, day] = dateString.split('-')
  
  // Criar data local sem conversão de fuso horário
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  
  return date.toLocaleDateString('pt-BR')
}

export function TaskCard({ task, onClick, onEdit, onDelete, size = 'default' }: TaskCardProps) {
  const [showAttachments, setShowAttachments] = useState(false)
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null)
  const [diskAttachments, setDiskAttachments] = useState<Array<{ originalName: string; fileType: string; filePath?: string; url?: string }>>([])
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
    const due = new Date(y, (m as number) - 1, d as number)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return task.status !== 'COMPLETED' && due < today
  }

  const getStatusIcon = () => {
    switch (task.status) {
      case 'TODO':
        return <Circle className="w-4 h-4 text-slate-400 dark:text-slate-500" />
      case 'IN_PROGRESS':
        return <PlayCircle className="w-4 h-4 text-blue-500 dark:text-blue-400" />
      case 'IN_REVIEW':
        return <PauseCircle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
      case 'COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-green-500 dark:text-green-400" />
      default:
        return <Circle className="w-4 h-4 text-slate-400 dark:text-slate-500" />
    }
  }

  const getStatusColor = () => {
    switch (task.status) {
      case 'TODO':
        return 'bg-card border-l-slate-400 dark:border-l-slate-500 border-border hover:border-slate-300 dark:hover:border-slate-600'
      case 'IN_PROGRESS':
        return 'bg-card border-l-blue-500 dark:border-l-blue-400 border-border hover:border-blue-300 dark:hover:border-blue-700'
      case 'IN_REVIEW':
        return 'bg-card border-l-amber-500 dark:border-l-amber-400 border-border hover:border-amber-300 dark:hover:border-amber-700'
      case 'COMPLETED':
        return 'bg-card border-l-green-500 dark:border-l-green-400 border-border hover:border-green-300 dark:hover:border-green-700'
      default:
        return 'bg-card border-l-slate-400 dark:border-l-slate-500 border-border hover:border-slate-300 dark:hover:border-slate-600'
    }
  }

  const getPriorityColor = () => {
    switch (task.priority) {
      case 'LOW':
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700'
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/50'
      case 'HIGH':
        return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800/50'
      case 'URGENT':
        return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/50'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700'
    }
  }

  const getPriorityIcon = () => {
    switch (task.priority) {
      case 'LOW':
        return <Flag className="w-3 h-3" />
      case 'MEDIUM':
        return <Flag className="w-3 h-3" />
      case 'HIGH':
        return <Flag className="w-3 h-3" />
      case 'URGENT':
        return <Flag className="w-3 h-3 fill-current" />
      default:
        return <Flag className="w-3 h-3" />
    }
  }

  const getStatusLabel = () => {
    switch (task.status) {
      case 'TODO':
        return 'A Fazer'
      case 'IN_PROGRESS':
        return 'Em Andamento'
      case 'IN_REVIEW':
        return 'Em Teste'
      case 'COMPLETED':
        return 'Concluído'
      default:
        return 'A Fazer'
    }
  }

  const isReportedTask = () => {
    return task.description?.includes('Tarefa reportada por') || false
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
        const data: { attachments?: Array<{ originalName: string; mimeType: string; filePath?: string; url?: string }> } = await res.json()
        const mapped = (data.attachments || []).map((a) => ({
          originalName: a.originalName,
          fileType: a.mimeType,
          filePath: a.filePath,
          url: a.url || (a.filePath ? `/api/files/${a.filePath}` : undefined),
        }))
        if (!cancelled) {
          setDiskAttachments(mapped)
        }
      } catch {}
    }
    fetchDiskAttachments()
    return () => { cancelled = true }
  }, [task.id])

  const coverUrl = useMemo(() => {
    if (task.coverImageUrl && task.coverImageUrl !== failedCoverUrl) {
      return task.coverImageUrl
    }
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

  const getPriorityBarClass = () => {
    switch (task.priority) {
      case 'LOW':
        return 'bg-slate-400'
      case 'MEDIUM':
        return 'bg-sky-400'
      case 'HIGH':
        return 'bg-orange-500'
      case 'URGENT':
        return 'bg-red-500'
      default:
        return 'bg-blue-500'
    }
  }

  const getStatusBarClass = () => {
    switch (task.status) {
      case 'IN_PROGRESS':
        return 'bg-blue-500'
      case 'IN_REVIEW':
        return 'bg-amber-500'
      case 'COMPLETED':
        return 'bg-emerald-500'
      default:
        return 'bg-slate-500'
    }
  }

  const getPriorityLabel = () => {
    switch (task.priority) {
      case 'LOW':
        return 'Baixa'
      case 'MEDIUM':
        return 'Média'
      case 'HIGH':
        return 'Alta'
      case 'URGENT':
        return 'Urgente'
      default:
        return 'Média'
    }
  }

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
          className="h-7 w-7 p-0 hover:bg-black/10 dark:hover:bg-white/10 text-foreground/80"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={handleCopyForAgent}
          disabled={copyingForAgent}
          className="flex items-center gap-2"
        >
          {copyingForAgent ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Bot className="w-3 h-3" />
          )}
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
            <Edit className="w-3 h-3" />
            Editar
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onDelete(task.id)
            }}
            className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 focus:bg-red-50"
          >
            <Trash2 className="w-3 h-3" />
            Excluir
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const attachmentsFooter = hasAttachments() && (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      onClick={(e) => {
        e.stopPropagation()
        setShowAttachments(!showAttachments)
      }}
    >
      <Paperclip className="w-3.5 h-3.5" />
      <span>{getAttachmentsCount()}</span>
    </button>
  )

  type DescriptionAttachment = { name: string; type: string; filePath?: string }
  type RealAttachment = { id?: string; originalName?: string; fileType?: string; filePath?: string }
  const handleAttachmentClick = async (attachment: DescriptionAttachment | RealAttachment, fileName: string, fileType: string) => {
    const isImage = fileType?.startsWith('image/')
    const isPDF = fileType === 'application/pdf'
    
    if (!isImage && !isPDF) return
    
    // Se tem filePath (anexo real), tentar abrir
    if ('filePath' in attachment && attachment.filePath && !attachment.filePath.startsWith('blob:')) {
      const raw = attachment.filePath as string
      const isUploadsPath = raw.includes('/') && !raw.startsWith('http')
      const url = isUploadsPath ? `/api/files/${raw}` : `/${raw}`
      window.open(url, '_blank')
      return
    }
    
    // Se tem id (anexo real), tentar construir caminho
    if ('id' in attachment && attachment.id) {
      window.open(`/api/files/${attachment.id}`, '_blank')
      return
    }
    
    // Para anexos da descrição, tentar estratégias diferentes
    const possiblePaths = [
      fileName, // Nome original
      fileName.toLowerCase(), // Nome em minúsculas
      fileName.replace(/\s+/g, '_'), // Substituir espaços por underscore
      fileName.replace(/\s+/g, '-'), // Substituir espaços por hífen
    ]
    
    // Tentar cada possibilidade
    for (const path of possiblePaths) {
      try {
        const responseApi = await fetch(`/api/files/${path}`, { method: 'HEAD' })
        if (responseApi.ok) {
          window.open(`/api/files/${path}`, '_blank')
          return
        }
        const responsePublic = await fetch(`/${path}`, { method: 'HEAD' })
        if (responsePublic.ok) {
          window.open(`/${path}`, '_blank')
          return
        }
      } catch (error) {
        // Continuar tentando
        continue
      }
    }
    
    // Se nada funcionou, mostrar modal mais amigável
    const shouldTryAnyway = confirm(
      `📎 ${fileName}\n\n` +
      `Este anexo foi enviado junto com a tarefa.\n` +
      `Não foi possível localizar o arquivo automaticamente.\n\n` +
      `Deseja tentar abrir mesmo assim?\n` +
      `(Pode aparecer erro 404 se o arquivo não existir)`
    )
    
    if (shouldTryAnyway) {
      window.open(`/api/files/${fileName}`, '_blank')
    }
  }

  const getPriorityLabel = () => {
    switch (task.priority) {
      case 'LOW':
        return 'Baixa'
      case 'MEDIUM':
        return 'Média'
      case 'HIGH':
        return 'Alta'
      case 'URGENT':
        return 'Urgente'
      default:
        return 'Média'
    }
  }

  const attachmentsPanel =
    showAttachments && hasAttachments() ? (
      <div className="pt-2 border-t border-muted max-h-24 overflow-y-auto">
        <h4 className="text-xs font-medium text-muted-foreground mb-2">
          Anexos ({getAttachmentsCount()})
        </h4>
        <div className="space-y-1">
          {getAttachmentsFromDescription().map((attachment, index) => {
            const fileName = getAttachmentName(attachment)
            const fileType = getAttachmentMime(attachment)
            const isImage = isImageAttachment(attachment)
            const isPDF = fileType === 'application/pdf'
            return (
              <div
                key={index}
                className={cn(
                  'flex items-center gap-2 p-2 bg-card rounded text-xs transition-colors',
                  isImage || isPDF ? 'hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer' : 'hover:bg-muted'
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  handleAttachmentClick(attachment, fileName, fileType)
                }}
              >
                {isImage ? (
                  <ImageIcon className="w-3 h-3 text-blue-600 shrink-0" />
                ) : isPDF ? (
                  <FileText className="w-3 h-3 text-red-600 shrink-0" />
                ) : (
                  <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                )}
                <p className="font-medium text-foreground truncate flex-1">{fileName}</p>
              </div>
            )
          })}
        </div>
      </div>
    ) : null


  return (
    <Card
      className={cn(
        'flex flex-col cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5',
        coverUrl
          ? 'overflow-hidden p-0 gap-0 bg-card border border-border shadow-sm'
          : cn(
              'border-l-4',
              isOverdue()
                ? 'bg-card border-l-red-500 dark:border-l-red-500 border-red-200 dark:border-red-800'
                : getStatusColor()
            )
      )}
      onClick={handleCardClick}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {coverUrl ? (
        <>
          <div className="relative w-full bg-muted/40">
            <img
              src={coverUrl}
              alt=""
              className="w-full h-[7.5rem] object-cover object-top"
              loading="lazy"
              onError={() => setFailedCoverUrl(coverUrl)}
            />
            <div className="absolute inset-x-0 top-0 flex justify-end p-1.5 bg-gradient-to-b from-black/35 to-transparent">
              {cardMenu}
            </div>
          </div>

          <CardContent className="px-2.5 pt-2 pb-2.5 space-y-2">
            <div className="flex flex-wrap gap-1">
              <div
                className={cn('h-2 w-10 rounded-full', getPriorityBarClass())}
                title={`Prioridade: ${getPriorityLabel()}`}
              />
              <div
                className={cn('h-2 w-10 rounded-full', getStatusBarClass())}
                title={`Status: ${getStatusLabel()}`}
              />
              {task.project?.name && (
                <div
                  className="h-2 w-10 rounded-full bg-violet-500"
                  title={task.project.name}
                />
              )}
            </div>

            <h3
              className="text-sm font-medium leading-snug text-foreground break-words line-clamp-4"
              title={task.title}
            >
              {limitChars(task.title, 280)}
            </h3>

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-2 min-w-0">
                {attachmentsFooter}
                {task.dueDate && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-[11px]',
                      isOverdue() ? 'text-red-500' : 'text-muted-foreground'
                    )}
                  >
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    {formatDateSafe(task.dueDate)}
                  </span>
                )}
                {isReportedTask() && (
                  <MessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                )}
              </div>
              {task.assignee && (
                <Avatar className="w-6 h-6 ring-1 ring-border shrink-0">
                  <AvatarImage src={task.assignee.avatar} />
                  <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                    {task.assignee.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>

            {attachmentsPanel}
          </CardContent>
        </>
      ) : (
        <>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <Badge variant="secondary" className="text-xs">
              {getStatusLabel()}
            </Badge>
            {task.project?.name && (
              <Badge variant="outline" className="text-xs bg-muted/40 text-foreground border-border">
                {task.project.name}
              </Badge>
            )}
            {isReportedTask() && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                <MessageSquare className="w-3 h-3 mr-1" />
                Reportada
              </Badge>
            )}
            {hasAttachments() && (
              <Badge 
                variant="outline" 
                className="text-xs bg-green-50 text-green-700 border-green-200 cursor-pointer hover:bg-green-100 transition-colors"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowAttachments(!showAttachments)
                }}
              >
                <Paperclip className="w-3 h-3 mr-1" />
                {getAttachmentsCount()}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {task.storyPoints && (
              <Badge variant="outline" className="text-xs font-mono text-muted-foreground border-muted">
                {task.storyPoints} SP
              </Badge>
            )}
            {cardMenu}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 flex-1 overflow-hidden">
        <div className="space-y-3 h-full">
          {/* Título */}
          <h3
            className="font-medium text-sm leading-tight text-foreground break-words"
            style={{ display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {limitChars(task.title, 120)}
          </h3>

          {/* Descrição */}
          {task.description && (
            <p
              className="text-xs text-muted-foreground break-words"
              style={{ display: '-webkit-box', WebkitLineClamp: 3 as any, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {(() => {
                const lines = task.description?.split('\n') || []
                const clean: string[] = []
                let skip = false
                for (const line of lines) {
                  if (line.includes('📎 Anexos (')) {
                    skip = true
                    continue
                  }
                  if (skip && (line.trim() === '' || !line.startsWith('• '))) {
                    skip = false
                  }
                  if (!skip) clean.push(line)
                }
                const txt = clean.join(' ').trim()
                return limitChars(txt, 220)
              })()}
            </p>
          )}

          {/* Informações de Tempo e Data */}
          {(task.startDate || task.startTime || task.estimatedMinutes) && (
            <div className="bg-card p-2 rounded-md space-y-1 border border-muted">
              {/* Data e Hora de Início */}
              {(task.startDate || task.startTime) && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3 text-green-500" />
                  <span className="font-medium">Início:</span>
                  {task.startDate && (
                    <span>{formatDateSafe(task.startDate)}</span>
                  )}
                  {task.startTime && (
                    <span className="text-green-500 font-mono">{task.startTime}</span>
                  )}
                </div>
              )}
              
              {/* Tempo Estimado */}
              {task.estimatedMinutes && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3 text-blue-500" />
                  <span className="font-medium">Estimado:</span>
                  <span className="text-blue-500 font-mono">
                    {task.estimatedMinutes >= 60 
                      ? `${Math.floor(task.estimatedMinutes / 60)}h ${task.estimatedMinutes % 60}min`
                      : `${task.estimatedMinutes}min`
                    }
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Metadados */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {/* Prioridade */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${getPriorityColor()}`}>
              {getPriorityIcon()}
              <span>{getPriorityLabel()}</span>
            </div>

            {/* Data de vencimento */}
            {task.dueDate && (
              <div className={`flex items-center gap-1 ${isOverdue() ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'}`}>
                <Calendar className={`w-3 h-3 ${isOverdue() ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'}`} />
                <span>{formatDateSafe(task.dueDate)}</span>
              </div>
            )}
          </div>

          {/* Responsável */}
          {task.assignee && (
            <div className="flex items-center gap-2 pt-2 border-t border-muted">
              <Avatar className="w-6 h-6 ring-1 ring-gray-200">
                <AvatarImage src={task.assignee.avatar} />
                <AvatarFallback className="text-xs bg-gray-100 text-muted-foreground">
                  {task.assignee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate">
                {task.assignee.name}
              </span>
            </div>
          )}

          {attachmentsPanel}
        </div>
      </CardContent>
        </>
      )}
    </Card>
  )
}

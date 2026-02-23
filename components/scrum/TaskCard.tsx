'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Clock, 
  Flag, 
  User, 
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
  FileText
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

interface Task {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  storyPoints?: number
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
  }>
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
  const [showMenu, setShowMenu] = useState(false)
  const [showAttachments, setShowAttachments] = useState(false)
  const [diskAttachments, setDiskAttachments] = useState<Array<{ originalName: string; fileType: string; filePath?: string }>>([])

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
    
    const attachments: Array<{name: string, type: string, filePath?: string}> = []
    const lines = task.description?.split('\n') || []
    
    let inAttachmentsSection = false
    for (const line of lines) {
      if (line.includes('📎 Anexos (')) {
        inAttachmentsSection = true
        continue
      }
      
      if (inAttachmentsSection && line.startsWith('• ')) {
        const withPath = line.match(/• (.+) \((.+)\) - (.+)$/)
        const basic = line.match(/• (.+) \((.+)\)/)
        if (withPath) {
          attachments.push({
            name: withPath[1],
            type: withPath[2],
            filePath: withPath[3]
          })
        } else if (basic) {
          attachments.push({
            name: basic[1],
            type: basic[2],
            filePath: basic[1]
          })
        }
      } else if (inAttachmentsSection && !line.startsWith('• ')) {
        break
      }
    }
    
    return attachments
  }

  useEffect(() => {
    let cancelled = false
    const fetchDiskAttachments = async () => {
      try {
        const res = await fetch(`/api/tasks/${task.id}/attachments`)
        if (!res.ok) return
        const data: { attachments?: Array<{ originalName: string; mimeType: string; filePath?: string }> } = await res.json()
        const mapped = (data.attachments || []).map((a) => ({
          originalName: a.originalName,
          fileType: a.mimeType,
          filePath: a.filePath
        }))
        if (!cancelled) {
          setDiskAttachments(mapped)
        }
      } catch {}
    }
    fetchDiskAttachments()
    return () => { cancelled = true }
  }, [task.id])

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


  return (
    <Card 
      className={`flex flex-col cursor-pointer transition-all duration-200 hover:shadow-lg hover:translate-y-[-2px] ${isOverdue() ? 'bg-card border-l-red-500 dark:border-l-red-500 border-red-200 dark:border-red-800' : getStatusColor()} border-l-4`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <Badge variant="secondary" className="text-xs">
              {getStatusLabel()}
            </Badge>
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
            {(onEdit || onDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-gray-100 text-gray-400"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
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
            )}
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

          {/* Lista de Anexos */}
          {showAttachments && hasAttachments() && (
            <div className="pt-3 border-t border-muted max-h-20 overflow-y-auto">
              <h4 className="text-xs font-medium text-gray-700 mb-2">
                Anexos ({getAttachmentsCount()})
              </h4>
              <div className="space-y-1">
                {getAttachmentsFromDescription().map((attachment, index) => {
                  // Lidar com ambos os formatos: {name, type} e {originalName, fileType}
                  const fileName = 'name' in attachment ? attachment.name : attachment.originalName
                  const fileType = 'type' in attachment ? attachment.type : attachment.fileType
                  
                  const isImage = fileType?.startsWith('image/')
                  const isPDF = fileType === 'application/pdf'
                  
                  return (
                    <div 
                      key={index}
                      className={`flex items-center gap-2 p-2 bg-card rounded text-xs transition-colors ${
                        isImage || isPDF ? 'hover:bg-blue-50 cursor-pointer' : 'hover:bg-gray-100'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAttachmentClick(attachment, fileName, fileType)
                      }}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isImage ? (
                          <ImageIcon className="w-3 h-3 text-blue-600 flex-shrink-0" />
                        ) : isPDF ? (
                          <FileText className="w-3 h-3 text-red-600 flex-shrink-0" />
                        ) : (
                          <Paperclip className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {fileName}
                          </p>
                          <p className="text-muted-foreground">
                            {isImage ? 'Imagem' : isPDF ? 'PDF' : 'Arquivo'}
                            {(isImage || isPDF) && (
                              <span className="ml-1 text-blue-600">• Clique para ver</span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-400">
                        {isImage ? (
                          <ImageIcon className="w-3 h-3" />
                        ) : isPDF ? (
                          <FileText className="w-3 h-3" />
                        ) : (
                          <Paperclip className="w-3 h-3" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              
              <p className="text-xs text-muted-foreground mt-2 italic">
                💡 Os anexos estão salvos no servidor e podem ser acessados pelos administradores
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

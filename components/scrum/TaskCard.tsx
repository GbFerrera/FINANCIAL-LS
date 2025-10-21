'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useState } from 'react'
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
  Image,
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

export function TaskCard({ task, onClick, onEdit, onDelete }: TaskCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [showAttachments, setShowAttachments] = useState(false)

  const getStatusIcon = () => {
    switch (task.status) {
      case 'TODO':
        return <Circle className="w-4 h-4 text-gray-400" />
      case 'IN_PROGRESS':
        return <PlayCircle className="w-4 h-4 text-blue-500" />
      case 'IN_REVIEW':
        return <PauseCircle className="w-4 h-4 text-yellow-500" />
      case 'COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      default:
        return <Circle className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = () => {
    switch (task.status) {
      case 'TODO':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'IN_REVIEW':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPriorityColor = () => {
    switch (task.priority) {
      case 'LOW':
        return 'bg-gray-100 text-gray-600'
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-600'
      case 'HIGH':
        return 'bg-orange-100 text-orange-600'
      case 'URGENT':
        return 'bg-red-100 text-red-600'
      default:
        return 'bg-gray-100 text-gray-600'
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
        return 'Em Revisão'
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
    // Verificar se tem anexos no campo attachments ou na descrição
    if (task.attachments && task.attachments.length > 0) {
      return true
    }
    // Verificar se a descrição contém indicação de anexos
    return task.description?.includes('📎 Anexos (') || false
  }

  const getAttachmentsCount = () => {
    if (task.attachments && task.attachments.length > 0) {
      return task.attachments.length
    }
    // Extrair número de anexos da descrição
    const match = task.description?.match(/📎 Anexos \((\d+)\):/)
    return match ? parseInt(match[1]) : 0
  }

  const getAttachmentsFromDescription = () => {
    if (task.attachments && task.attachments.length > 0) {
      return task.attachments
    }
    
    // Extrair anexos da descrição
    const attachments: Array<{name: string, type: string, filePath?: string}> = []
    const lines = task.description?.split('\n') || []
    
    let inAttachmentsSection = false
    for (const line of lines) {
      if (line.includes('📎 Anexos (')) {
        inAttachmentsSection = true
        continue
      }
      
      if (inAttachmentsSection && line.startsWith('• ')) {
        const match = line.match(/• (.+) \((.+)\)/)
        if (match) {
          attachments.push({
            name: match[1],
            type: match[2],
            // Tentar construir caminho baseado no nome do arquivo
            filePath: match[1]
          })
        }
      } else if (inAttachmentsSection && !line.startsWith('• ')) {
        break
      }
    }
    
    return attachments
  }

  const handleAttachmentClick = async (attachment: any, fileName: string, fileType: string) => {
    const isImage = fileType?.startsWith('image/')
    const isPDF = fileType === 'application/pdf'
    
    if (!isImage && !isPDF) return
    
    // Se tem filePath (anexo real), tentar abrir
    if ('filePath' in attachment && attachment.filePath && !attachment.filePath.startsWith('blob:')) {
      window.open(`/api/files/${attachment.filePath}`, '_blank')
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
        const response = await fetch(`/api/files/${path}`, { method: 'HEAD' })
        if (response.ok) {
          window.open(`/api/files/${path}`, '_blank')
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
      className={`w-72 cursor-pointer transition-all duration-200 hover:shadow-md ${getStatusColor()} border-l-4`}
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
              <Badge variant="outline" className="text-xs font-mono">
                {task.storyPoints} SP
              </Badge>
            )}
            {(onEdit || onDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-gray-100"
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
                      className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
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
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Título */}
          <h3 className="font-medium text-sm leading-tight line-clamp-2">
            {task.title}
          </h3>

          {/* Descrição */}
          {task.description && (
            <p className="text-xs text-gray-600 line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Informações de Tempo e Data */}
          {(task.startDate || task.startTime || task.estimatedMinutes) && (
            <div className="bg-gray-50 p-2 rounded-md space-y-1">
              {/* Data e Hora de Início */}
              {(task.startDate || task.startTime) && (
                <div className="flex items-center gap-1 text-xs text-gray-700">
                  <Clock className="w-3 h-3 text-green-600" />
                  <span className="font-medium">Início:</span>
                  {task.startDate && (
                    <span>{formatDateSafe(task.startDate)}</span>
                  )}
                  {task.startTime && (
                    <span className="text-green-600 font-mono">{task.startTime}</span>
                  )}
                </div>
              )}
              
              {/* Tempo Estimado */}
              {task.estimatedMinutes && (
                <div className="flex items-center gap-1 text-xs text-gray-700">
                  <Clock className="w-3 h-3 text-blue-600" />
                  <span className="font-medium">Estimado:</span>
                  <span className="text-blue-600 font-mono">
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
          <div className="flex items-center justify-between text-xs text-gray-500">
            {/* Prioridade */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${getPriorityColor()}`}>
              {getPriorityIcon()}
              <span>{getPriorityLabel()}</span>
            </div>

            {/* Data de vencimento */}
            {task.dueDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatDateSafe(task.dueDate)}</span>
              </div>
            )}
          </div>

          {/* Responsável */}
          {task.assignee && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
              <Avatar className="w-6 h-6">
                <AvatarImage src={task.assignee.avatar} />
                <AvatarFallback className="text-xs">
                  {task.assignee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-gray-600 truncate">
                {task.assignee.name}
              </span>
            </div>
          )}

          {/* Lista de Anexos */}
          {showAttachments && hasAttachments() && (
            <div className="pt-3 border-t border-gray-200">
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
                      className={`flex items-center gap-2 p-2 bg-gray-50 rounded text-xs transition-colors ${
                        isImage || isPDF ? 'hover:bg-blue-50 cursor-pointer' : 'hover:bg-gray-100'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAttachmentClick(attachment, fileName, fileType)
                      }}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isImage ? (
                          <Image className="w-3 h-3 text-blue-600 flex-shrink-0" />
                        ) : isPDF ? (
                          <FileText className="w-3 h-3 text-red-600 flex-shrink-0" />
                        ) : (
                          <Paperclip className="w-3 h-3 text-gray-600 flex-shrink-0" />
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {fileName}
                          </p>
                          <p className="text-gray-500">
                            {isImage ? 'Imagem' : isPDF ? 'PDF' : 'Arquivo'}
                            {(isImage || isPDF) && (
                              <span className="ml-1 text-blue-600">• Clique para ver</span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-400">
                        {(isImage || isPDF) ? '👁️' : '📎'}
                      </div>
                    </div>
                  )
                })}
              </div>
              
              <p className="text-xs text-gray-500 mt-2 italic">
                💡 Os anexos estão salvos no servidor e podem ser acessados pelos administradores
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

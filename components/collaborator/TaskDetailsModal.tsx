import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Calendar, 
  Clock, 
  Target, 
  FileText,
  Download,
  ExternalLink
} from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useEffect, useState } from "react"

interface Task {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate?: string
  startDate?: string
  startTime?: string
  estimatedMinutes?: number
  storyPoints?: number
  project: {
    id: string
    name: string
  }
  sprint?: {
    id: string
    name: string
    status: string
  }
}

interface TaskDetailsModalProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string
}

export function TaskDetailsModal({ task, open, onOpenChange, token }: TaskDetailsModalProps) {
  if (!task) return null

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-500'
      case 'HIGH': return 'bg-orange-500'
      case 'MEDIUM': return 'bg-yellow-500'
      case 'LOW': return 'bg-green-500'
      default: return 'bg-card0'
    }
  }

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'Urgente'
      case 'HIGH': return 'Alta'
      case 'MEDIUM': return 'Média'
      case 'LOW': return 'Baixa'
      default: return priority
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-600 bg-green-100'
      case 'IN_PROGRESS': return 'text-blue-600 bg-blue-100'
      case 'IN_REVIEW': return 'text-yellow-600 bg-yellow-100'
      case 'TODO': return 'text-muted-foreground bg-gray-100'
      default: return 'text-muted-foreground bg-gray-100'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'Concluída'
      case 'IN_PROGRESS': return 'Em Progresso'
      case 'IN_REVIEW': return 'Para Revisar'
      case 'TODO': return 'A Fazer'
      default: return status
    }
  }

  const formatDateSafe = (dateString: string) => {
    if (dateString.includes('T')) {
      dateString = dateString.split('T')[0]
    }
    const [year, month, day] = dateString.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    return format(date, "dd 'de' MMMM", { locale: ptBR })
  }

  const [attachments, setAttachments] = useState<Array<{ originalName: string; mimeType: string; filePath: string; url: string; size: number }>>([])
  useEffect(() => {
    const fetchAttachments = async () => {
      if (!open || !task?.id) return
      try {
        const res = await fetch(`/api/collaborator-portal/${token}/tasks/${task.id}/attachments`)
        if (res.ok) {
          const data = await res.json()
          setAttachments(data.attachments || [])
        } else {
          setAttachments([])
        }
      } catch {
        setAttachments([])
      }
    }
    fetchAttachments()
  }, [open, token, task?.id])

  const handleAttachmentClick = (attachment: { filePath?: string; url?: string }) => {
    if (attachment.url) {
      window.open(attachment.url, '_blank')
      return
    }
    if (attachment.filePath) {
      if (attachment.filePath.startsWith('http')) {
        window.open(attachment.filePath, '_blank')
      } else {
        window.open(`/api/files/${attachment.filePath}`, '_blank')
      }
    }
  }
  
  const getDescriptionWithoutAttachments = () => {
      if (!task.description) return ''
      
      const lines = task.description.split('\n')
      const cleanLines: string[] = []
      let skip = false
      
      for (const line of lines) {
          if (line.includes('📎 Anexos (')) {
              skip = true
              continue
          }
          if (skip && (line.trim() === '' || !line.startsWith('• '))) {
              skip = false
          }
          if (!skip) {
              cleanLines.push(line)
          }
      }
      return cleanLines.join('\n').trim()
  }

  // Decidi mostrar a descrição completa mesmo, para garantir que nada se perca
  // Mas a seção de anexos dedicada é melhor para interação

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between mr-8">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold leading-tight">
                {task.title}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className={getStatusColor(task.status)}>
                  {getStatusLabel(task.status)}
                </Badge>
                <div className={`px-2 py-0.5 rounded text-xs font-medium text-white ${getPriorityColor(task.priority)}`}>
                  {getPriorityLabel(task.priority)}
                </div>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  {task.project.name}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-4">
          <div className="space-y-6 py-4">
            {/* Metadados */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-card rounded-lg">
              {task.sprint && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">Sprint</span>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Clock className="w-4 h-4 text-blue-500" />
                    {task.sprint.name}
                  </div>
                </div>
              )}
              
              {task.dueDate && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">Data de Entrega</span>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Calendar className="w-4 h-4 text-red-500" />
                    {formatDateSafe(task.dueDate)}
                  </div>
                </div>
              )}

              {task.estimatedMinutes && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">Estimativa</span>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    {Math.floor(task.estimatedMinutes / 60)}h {task.estimatedMinutes % 60}min
                  </div>
                </div>
              )}
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Descrição
              </h3>
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap bg-card border rounded-md p-4">
                {getDescriptionWithoutAttachments() || "Nenhuma descrição fornecida."}
              </div>
            </div>

            {/* Anexos */}
            {attachments.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Anexos ({attachments.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachments.map((att, index) => {
                    const isImage = att.mimeType?.startsWith('image/')
                    const src = isImage ? att.url : undefined
                    return (
                      <div key={index} className="flex items-center gap-3 p-2 border rounded">
                        {isImage && src ? (
                          <img src={src} alt={att.originalName} className="w-12 h-12 object-cover rounded border" />
                        ) : (
                          <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        )}
                        <Button
                          variant="outline"
                          className="justify-start h-auto py-2 px-3 w-full"
                          onClick={() => handleAttachmentClick(att)}
                        >
                          <div className="flex flex-col items-start overflow-hidden">
                            <span className="truncate w-full text-sm font-medium">{att.originalName}</span>
                            <span className="text-xs text-muted-foreground">{att.mimeType}</span>
                          </div>
                          <ExternalLink className="w-3 h-3 ml-auto text-gray-400 flex-shrink-0" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t mt-auto">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

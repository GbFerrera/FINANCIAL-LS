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
  ExternalLink,
  CheckSquare,
  X,
  Layout,
  Tag
} from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useEffect, useState } from "react"
import { TaskChecklist } from "./TaskChecklist"

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
      case 'URGENT': return 'bg-red-500 hover:bg-red-600'
      case 'HIGH': return 'bg-orange-500 hover:bg-orange-600'
      case 'MEDIUM': return 'bg-yellow-500 hover:bg-yellow-600'
      case 'LOW': return 'bg-green-500 hover:bg-green-600'
      default: return 'bg-slate-500 hover:bg-slate-600'
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
      case 'COMPLETED': return 'text-green-700 bg-green-100 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
      case 'IN_PROGRESS': return 'text-blue-700 bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
      case 'IN_REVIEW': return 'text-yellow-700 bg-yellow-100 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800'
      case 'TODO': return 'text-slate-700 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
      default: return 'text-muted-foreground bg-muted'
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
    return format(date, "dd 'de' MMM, yyyy", { locale: ptBR })
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[70vw] max-w-[95vw] w-full h-[95vh] p-0 flex flex-col gap-0 overflow-hidden bg-background">
        
        {/* Header Fixo */}
        <div className="px-6 py-5 border-b bg-background shrink-0 flex justify-between items-start gap-4">
          <div className="space-y-2 flex-1">
             <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/50 border border-border/50">
                   <Target className="w-3.5 h-3.5" />
                   <span className="font-medium">{task.project.name}</span>
                </div>
                {task.sprint && (
                  <>
                    <span className="text-muted-foreground/40">/</span>
                    <span className="font-medium flex items-center gap-1.5">
                       <Layout className="w-3.5 h-3.5" />
                       {task.sprint.name}
                    </span>
                  </>
                )}
             </div>
             
             <DialogTitle className="text-2xl font-bold leading-tight text-foreground">
                {task.title}
             </DialogTitle>

             <div className="flex items-center gap-2 pt-1">
                <Badge variant="outline" className={`${getStatusColor(task.status)} border bg-opacity-10 px-2.5 py-0.5`}>
                  {getStatusLabel(task.status)}
                </Badge>
                <Badge variant="secondary" className={`${getPriorityColor(task.priority)} text-white border-0 px-2.5 py-0.5`}>
                  {getPriorityLabel(task.priority)}
                </Badge>
             </div>
          </div>

          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:bg-muted">
             <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content - Layout Responsivo */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Coluna Principal (Esquerda) */}
          <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8 bg-background">
            
            {/* Faixa de Metadados */}
            <div className="flex flex-wrap gap-6 p-4 bg-muted/20 rounded-xl border border-border/50">
               <div className="flex items-center gap-3 min-w-[140px]">
                  <div className="p-2.5 rounded-lg bg-background border shadow-sm text-red-500 dark:text-red-400">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Entrega</span>
                    <span className="text-sm font-semibold text-foreground">
                      {task.dueDate ? formatDateSafe(task.dueDate) : 'Sem data'}
                    </span>
                  </div>
               </div>
               
               <div className="flex items-center gap-3 min-w-[140px]">
                  <div className="p-2.5 rounded-lg bg-background border shadow-sm text-amber-500 dark:text-amber-400">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Estimativa</span>
                    <span className="text-sm font-semibold text-foreground">
                      {task.estimatedMinutes 
                        ? `${Math.floor(task.estimatedMinutes / 60)}h ${task.estimatedMinutes % 60}m`
                        : 'Não definida'}
                    </span>
                  </div>
               </div>

               {/* Espaço para mais metadados se necessário */}
            </div>

            {/* Descrição */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Descrição
              </h3>
              <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap pl-1">
                {getDescriptionWithoutAttachments() || (
                  <span className="italic text-muted-foreground/60">Nenhuma descrição fornecida para esta tarefa.</span>
                )}
              </div>
            </div>

            {/* Anexos */}
            {attachments.length > 0 && (
               <div className="space-y-4 pt-4 border-t">
                 <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                   <Download className="w-5 h-5 text-primary" />
                   Anexos <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{attachments.length}</span>
                 </h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {attachments.map((att, index) => {
                     const isImage = att.mimeType?.startsWith('image/')
                     const src = isImage ? att.url : undefined
                     return (
                       <div key={index} className="group relative flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/40 transition-all hover:shadow-sm bg-card">
                         {isImage && src ? (
                           <div className="relative w-12 h-12 rounded-md overflow-hidden border bg-muted shrink-0">
                             <img src={src} alt={att.originalName} className="w-full h-full object-cover" />
                           </div>
                         ) : (
                           <div className="w-12 h-12 rounded-md border bg-muted/50 flex items-center justify-center shrink-0">
                             <FileText className="w-6 h-6 text-muted-foreground" />
                           </div>
                         )}
                         <div className="flex flex-col min-w-0 flex-1">
                           <span className="truncate text-sm font-medium text-foreground">{att.originalName}</span>
                           <span className="text-xs text-muted-foreground">{att.mimeType}</span>
                         </div>
                         <Button
                           variant="ghost"
                           size="icon"
                           className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm shadow-sm border"
                           onClick={() => handleAttachmentClick(att)}
                         >
                           <ExternalLink className="w-4 h-4" />
                         </Button>
                       </div>
                     )
                   })}
                 </div>
               </div>
            )}
          </div>

          {/* Coluna Lateral (Direita) - Checklist */}
          <div className="w-full lg:w-[380px] border-t lg:border-t-0 lg:border-l bg-muted/10 dark:bg-muted/5 flex flex-col h-full">
            <div className="p-4 border-b bg-muted/20 flex items-center gap-2 shrink-0">
               <CheckSquare className="w-5 h-5 text-primary" />
               <h3 className="font-semibold text-foreground">Checklist</h3>
               <span className="ml-auto text-xs text-muted-foreground font-medium">Sub-tarefas</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 lg:p-6">
               <TaskChecklist token={token} taskId={task.id} variant="minimal" />
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}

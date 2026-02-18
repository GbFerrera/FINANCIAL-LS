import React from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from './badge'
import { Clock, CheckCircle2, AlertCircle, Calendar } from 'lucide-react'

interface TooltipData {
  date: string
  count: number
  pendingCount?: number
  tasks?: Array<{
    id: string
    title: string
    status: string
    priority?: string
    project?: {
      name: string
    }
  }>
  pendingTasks?: Array<{
    id: string
    title: string
    status: string
    priority?: string
    project?: {
      name: string
    }
  }>
  totalHours?: number
  projects?: string[]
}

interface CustomTooltipProps {
  data: TooltipData | null
  position: { x: number; y: number }
  visible: boolean
}

// Função para formatar tempo em horas e minutos
const formatTime = (hours: number): string => {
  if (hours === 0) return '0h'
  
  const wholeHours = Math.floor(hours)
  const minutes = Math.round((hours - wholeHours) * 60)
  
  if (wholeHours === 0) {
    return `${minutes}min`
  } else if (minutes === 0) {
    return `${wholeHours}h`
  } else {
    return `${wholeHours}h ${minutes}min`
  }
}

export function CustomTooltip({ data, position, visible }: CustomTooltipProps) {
  if (!visible || !data) return null

  const date = format(parseISO(data.date), 'EEEE, dd \'de\' MMMM \'de\' yyyy', { locale: ptBR })
  const completedTasks = data.tasks || []
  const pendingTasks = data.pendingTasks || []
  const totalTasks = completedTasks.length + pendingTasks.length

  return (
    <div
      className="fixed z-50 bg-card border border-muted rounded-lg shadow-lg p-4 max-w-sm"
      style={{
        left: position.x - 150,
        top: position.y - 10,
        transform: 'translateY(-100%)'
      }}
    >
      <div className="space-y-3">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Calendar className="h-4 w-4" />
            {date}
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-2">
          {data.count > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-gray-700">
                {data.count} tarefa{data.count > 1 ? 's' : ''} concluída{data.count > 1 ? 's' : ''}
              </span>
            </div>
          )}
          
          {data.pendingCount && data.pendingCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <span className="text-gray-700">
                {data.pendingCount} tarefa{data.pendingCount > 1 ? 's' : ''} pendente{data.pendingCount > 1 ? 's' : ''}
              </span>
            </div>
          )}

          {data.totalHours !== undefined && data.totalHours >= 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-gray-700">
                {data.totalHours === 0 ? 'Nenhum tempo registrado' : `${formatTime(data.totalHours)} trabalhadas`}
              </span>
            </div>
          )}
        </div>

        {/* Tasks Preview */}
        {totalTasks > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Tarefas
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {completedTasks.slice(0, 3).map((task) => (
                <div key={task.id} className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700 truncate">{task.title}</span>
                  {task.priority && (
                    <Badge 
                      variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'}
                      className="text-xs px-1 py-0"
                    >
                      {task.priority}
                    </Badge>
                  )}
                </div>
              ))}
              
              {pendingTasks.slice(0, 3).map((task) => (
                <div key={task.id} className="flex items-center gap-2 text-xs">
                  <AlertCircle className="h-3 w-3 text-orange-500 flex-shrink-0" />
                  <span className="text-gray-700 truncate">{task.title}</span>
                  {task.priority && (
                    <Badge 
                      variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'}
                      className="text-xs px-1 py-0"
                    >
                      {task.priority}
                    </Badge>
                  )}
                </div>
              ))}
              
              {totalTasks > 6 && (
                <div className="text-xs text-muted-foreground italic">
                  +{totalTasks - 6} mais tarefas...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Projects */}
        {data.projects && data.projects.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Projetos Envolvidos
            </div>
            <div className="flex flex-wrap gap-1">
              {data.projects.slice(0, 3).map((project) => (
                <Badge key={project} variant="outline" className="text-xs">
                  {project}
                </Badge>
              ))}
              {data.projects.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{data.projects.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}

        {totalTasks === 0 && (
          <div className="text-sm text-muted-foreground italic">
            Nenhuma atividade registrada neste dia
          </div>
        )}

        <div className="text-xs text-gray-400 pt-2 border-t">
          Clique para ver detalhes completos
        </div>
      </div>
    </div>
  )
}
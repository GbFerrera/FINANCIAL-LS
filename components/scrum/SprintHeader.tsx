'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  Calendar, 
  Target, 
  TrendingUp, 
  Edit, 
  Play, 
  Pause, 
  CheckCircle2,
  Clock
} from 'lucide-react'
import { format, differenceInDays, isAfter, isBefore } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Sprint {
  id: string
  name: string
  description?: string
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  startDate: string
  endDate: string
  goal?: string
  capacity?: number
}

interface SprintHeaderProps {
  sprint: Sprint
  progress: number
  storyPoints: {
    total: number
    completed: number
  }
  onEdit: () => void
  isCompleted?: boolean
}

export function SprintHeader({ 
  sprint, 
  progress, 
  storyPoints, 
  onEdit, 
  isCompleted = false 
}: SprintHeaderProps) {
  const getStatusColor = () => {
    switch (sprint.status) {
      case 'PLANNING':
        return 'bg-yellow-100 text-yellow-800'
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = () => {
    switch (sprint.status) {
      case 'PLANNING':
        return <Clock className="w-4 h-4" />
      case 'ACTIVE':
        return <Play className="w-4 h-4" />
      case 'COMPLETED':
        return <CheckCircle2 className="w-4 h-4" />
      case 'CANCELLED':
        return <Pause className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const getStatusLabel = () => {
    switch (sprint.status) {
      case 'PLANNING':
        return 'Planejamento'
      case 'ACTIVE':
        return 'Ativa'
      case 'COMPLETED':
        return 'Concluída'
      case 'CANCELLED':
        return 'Cancelada'
      default:
        return 'Planejamento'
    }
  }

  const getDaysRemaining = () => {
    const today = new Date()
    const endDate = new Date(sprint.endDate)
    const startDate = new Date(sprint.startDate)
    
    if (sprint.status === 'COMPLETED' || sprint.status === 'CANCELLED') {
      return null
    }
    
    if (isBefore(today, startDate)) {
      const daysToStart = differenceInDays(startDate, today)
      return `Inicia em ${daysToStart} dia${daysToStart !== 1 ? 's' : ''}`
    }
    
    if (isAfter(today, endDate)) {
      const daysOverdue = differenceInDays(today, endDate)
      return `Atrasada ${daysOverdue} dia${daysOverdue !== 1 ? 's' : ''}`
    }
    
    const daysRemaining = differenceInDays(endDate, today)
    return `${daysRemaining} dia${daysRemaining !== 1 ? 's' : ''} restante${daysRemaining !== 1 ? 's' : ''}`
  }

  const getProgressColor = () => {
    if (progress >= 80) return 'bg-green-500'
    if (progress >= 50) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  return (
    <div className="space-y-4">
      {/* Linha superior */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-semibold text-gray-900">
              {sprint.name}
            </h2>
            <Badge className={`${getStatusColor()} flex items-center gap-1`}>
              {getStatusIcon()}
              {getStatusLabel()}
            </Badge>
          </div>
          
          {sprint.description && (
            <p className="text-gray-600 text-sm mb-2">
              {sprint.description}
            </p>
          )}
          
          {sprint.goal && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Target className="w-4 h-4" />
              <span className="font-medium">Objetivo:</span>
              <span>{sprint.goal}</span>
            </div>
          )}
        </div>
        
        {!isCompleted && (
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="ml-4"
          >
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
        )}
      </div>

      {/* Linha de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Datas */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          <div>
            <div className="font-medium">
              {format(new Date(sprint.startDate), 'dd/MM', { locale: ptBR })} - {format(new Date(sprint.endDate), 'dd/MM/yyyy', { locale: ptBR })}
            </div>
            {getDaysRemaining() && (
              <div className="text-xs text-gray-500">
                {getDaysRemaining()}
              </div>
            )}
          </div>
        </div>

        {/* Progresso */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Progresso</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress 
            value={progress} 
            className="h-2"
          />
        </div>

        {/* Story Points */}
        <div className="flex items-center gap-2 text-sm">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          <div>
            <div className="font-medium">
              {storyPoints.completed}/{storyPoints.total} SP
            </div>
            <div className="text-xs text-gray-500">
              Story Points
            </div>
          </div>
        </div>

        {/* Capacidade */}
        {sprint.capacity && (
          <div className="flex items-center gap-2 text-sm">
            <Target className="w-4 h-4 text-purple-500" />
            <div>
              <div className="font-medium">
                {sprint.capacity} SP
              </div>
              <div className="text-xs text-gray-500">
                Capacidade
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

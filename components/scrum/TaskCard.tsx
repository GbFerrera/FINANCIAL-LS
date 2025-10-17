'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
  PauseCircle
} from 'lucide-react'

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
}

interface TaskCardProps {
  task: Task
  onClick?: () => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
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
          </div>
          {task.storyPoints && (
            <Badge variant="outline" className="text-xs font-mono">
              {task.storyPoints} SP
            </Badge>
          )}
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
                <span>{new Date(task.dueDate).toLocaleDateString('pt-BR')}</span>
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
        </div>
      </CardContent>
    </Card>
  )
}

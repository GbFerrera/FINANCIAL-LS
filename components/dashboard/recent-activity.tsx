"use client"

import { Clock, User, FileText, DollarSign, CheckCircle, AlertCircle } from "lucide-react"

interface Activity {
  id: string
  type: 'task_completed' | 'payment_received' | 'comment_added' | 'project_updated' | 'milestone_reached'
  title: string
  description: string
  user: string
  timestamp: string
  metadata?: {
    projectName?: string
    amount?: number
    taskName?: string
  }
}

interface RecentActivityProps {
  activities: Activity[]
}

const activityIcons = {
  task_completed: CheckCircle,
  payment_received: DollarSign,
  comment_added: FileText,
  project_updated: AlertCircle,
  milestone_reached: CheckCircle
}

const activityColors = {
  task_completed: 'text-green-600 bg-green-100',
  payment_received: 'text-blue-600 bg-blue-100',
  comment_added: 'text-yellow-600 bg-yellow-100',
  project_updated: 'text-purple-600 bg-purple-100',
  milestone_reached: 'text-indigo-600 bg-indigo-100'
}

export function RecentActivity({ activities }: RecentActivityProps) {
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const activityTime = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - activityTime.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Agora mesmo'
    if (diffInMinutes < 60) return `${diffInMinutes}m atrás`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h atrás`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d atrás`
    
    return activityTime.toLocaleDateString('pt-BR')
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Atividades Recentes
          </h3>
          <button className="text-sm text-indigo-600 hover:text-indigo-500">
            Ver todas
          </button>
        </div>

        <div className="flow-root">
          <ul className="-mb-8">
            {activities.length === 0 ? (
              <li className="text-center py-8">
                <Clock className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">Nenhuma atividade recente</p>
              </li>
            ) : (
              activities.map((activity, activityIdx) => {
                const Icon = activityIcons[activity.type]
                const colorClasses = activityColors[activity.type]
                
                return (
                  <li key={activity.id}>
                    <div className="relative pb-8">
                      {activityIdx !== activities.length - 1 ? (
                        <span
                          className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${colorClasses}`}>
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {activity.title}
                            </p>
                            <p className="text-sm text-gray-500">
                              {activity.description}
                            </p>
                            {activity.metadata && (
                              <div className="mt-1 text-xs text-gray-400">
                                {activity.metadata.projectName && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 mr-2">
                                    {activity.metadata.projectName}
                                  </span>
                                )}
                                {activity.metadata.amount && (
                                  <span className="font-medium text-green-600">
                                    {formatCurrency(activity.metadata.amount)}
                                  </span>
                                )}
                                {activity.metadata.taskName && (
                                  <span className="text-gray-600">
                                    Tarefa: {activity.metadata.taskName}
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="mt-1 flex items-center text-xs text-gray-400">
                              <User className="h-3 w-3 mr-1" />
                              <span>{activity.user}</span>
                            </div>
                          </div>
                          <div className="text-right text-xs text-gray-400 whitespace-nowrap">
                            <time dateTime={activity.timestamp}>
                              {formatTimeAgo(activity.timestamp)}
                            </time>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </div>

        {activities.length > 0 && (
          <div className="mt-6">
            <button className="w-full bg-gray-50 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-100 transition-colors">
              Carregar mais atividades
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
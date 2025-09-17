'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  Target, 
  User, 
  Building2,
  TrendingUp,
  BarChart3,
  FileText,
  MessageSquare
} from 'lucide-react'

interface DayDetailsData {
  date: string
  count: number
  tasks: Array<{
    id: string
    title: string
    description?: string
    status: string
    priority: string
    completedAt?: string
    estimatedHours?: number
    actualHours?: number
    project?: {
      id: string
      name: string
    }
    assignee?: {
      id: string
      name: string
      avatar?: string
    }
  }>
  totalHours: number
  estimatedHours: number
  projects: Array<{
    id: string
    name: string
    tasksCount: number
    hoursSpent: number
  }>
  productivity: {
    completionRate: number
    efficiency: number
    timeAccuracy: number
  }
  comments?: Array<{
    id: string
    content: string
    createdAt: string
    author: string
  }>
}

interface DayDetailsModalProps {
  data: DayDetailsData | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DayDetailsModal({ data, open, onOpenChange }: DayDetailsModalProps) {
  if (!data) return null

  const formattedDate = format(parseISO(data.date), 'EEEE, dd \'de\' MMMM \'de\' yyyy', { locale: ptBR })
  
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'text-green-600'
      case 'in_progress': return 'text-blue-600'
      case 'todo': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200'
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'todo': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Detalhes do dia - {formattedDate}
          </DialogTitle>
          <DialogDescription>
            Visualização completa das atividades e métricas do dia
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Resumo geral */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="flex-shrink-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-2xl font-bold">{data.count}</div>
                    <div className="text-sm text-gray-600 truncate">Atividades</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="flex-shrink-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-2xl font-bold truncate">{data.totalHours}h</div>
                    <div className="text-sm text-gray-600 truncate">Tempo gasto</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="flex-shrink-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-2xl font-bold">{data.projects.length}</div>
                    <div className="text-sm text-gray-600 truncate">Projetos</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="flex-shrink-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-2xl font-bold">{data.productivity.completionRate}%</div>
                    <div className="text-sm text-gray-600 truncate">Conclusão</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="tasks" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="tasks">Atividades</TabsTrigger>
              <TabsTrigger value="projects">Projetos</TabsTrigger>
              <TabsTrigger value="metrics">Métricas</TabsTrigger>
              <TabsTrigger value="comments">Comentários</TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="space-y-4">
              <div className="space-y-3">
                {data.tasks.map((task) => (
                  <Card key={task.id} className="flex-shrink-0">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <CheckCircle className={`h-4 w-4 flex-shrink-0 ${getStatusColor(task.status)}`} />
                            <h4 className="font-medium truncate">{task.title}</h4>
                            <Badge className={`flex-shrink-0 ${getStatusBadgeColor(task.status)}`}>
                              {task.status}
                            </Badge>
                            <Badge className={`flex-shrink-0 ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </Badge>
                          </div>
                          
                          {task.description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{task.description}</p>
                          )}
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                            {task.project && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Building2 className="h-3 w-3" />
                                <span className="truncate max-w-[120px]">{task.project.name}</span>
                              </div>
                            )}
                            {task.assignee && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <User className="h-3 w-3" />
                                <span className="truncate max-w-[100px]">{task.assignee.name}</span>
                              </div>
                            )}
                            {task.completedAt && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Clock className="h-3 w-3" />
                                <span className="whitespace-nowrap">Concluída às {format(parseISO(task.completedAt), 'HH:mm')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right flex-shrink-0">
                          {task.actualHours && (
                            <div className="text-sm font-medium">{task.actualHours}h</div>
                          )}
                          {task.estimatedHours && (
                            <div className="text-xs text-gray-500">
                              Est: {task.estimatedHours}h
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="projects" className="space-y-4">
              <div className="grid gap-4">
                {data.projects.map((project) => (
                  <Card key={project.id} className="flex-shrink-0">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium truncate">{project.name}</h4>
                          <div className="text-sm text-gray-600 truncate">
                            {project.tasksCount} atividades concluídas
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-lg font-bold">{project.hoursSpent}h</div>
                          <div className="text-xs text-gray-500">tempo gasto</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="metrics" className="space-y-4">
              <div className="grid gap-4">
                <Card className="flex-shrink-0">
                  <CardHeader>
                    <CardTitle className="text-sm">Taxa de Conclusão</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Progress value={data.productivity.completionRate} className="h-2" />
                      <div className="text-sm text-gray-600 break-words">
                        {data.productivity.completionRate}% das atividades foram concluídas
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="flex-shrink-0">
                  <CardHeader>
                    <CardTitle className="text-sm">Eficiência</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Progress value={data.productivity.efficiency} className="h-2" />
                      <div className="text-sm text-gray-600 break-words">
                        {data.productivity.efficiency}% de eficiência no tempo
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="flex-shrink-0">
                  <CardHeader>
                    <CardTitle className="text-sm">Precisão de Estimativa</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Progress value={data.productivity.timeAccuracy} className="h-2" />
                      <div className="text-sm text-gray-600 break-words">
                        {data.productivity.timeAccuracy}% de precisão nas estimativas
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="comments" className="space-y-4">
              {data.comments && data.comments.length > 0 ? (
                <div className="space-y-3">
                  {data.comments.map((comment) => (
                    <Card key={comment.id} className="flex-shrink-0">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <MessageSquare className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-medium text-sm truncate">{comment.author}</span>
                              <span className="text-xs text-gray-500 flex-shrink-0">
                                {format(parseISO(comment.createdAt), 'HH:mm')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 break-words">{comment.content}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum comentário foi adicionado neste dia</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
 'use client'
 
 import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatsCard } from '@/components/ui/stats-card'
import { Calendar, CheckCircle2, AlertCircle, Clock, Target, ArrowLeft, Search, Filter } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface PageProps {
  params: Promise<{
    token: string
  }>
}
 
 type Task = {
   id: string
   title: string
   description?: string
   status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'
   priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
   dueDate?: string
   startDate?: string
   startTime?: string
   estimatedMinutes?: number
   actualMinutes?: number
   storyPoints?: number
   completedAt?: string
   updatedAt?: string
   project?: { id: string; name: string }
   sprint?: { id: string; name: string; status: string }
 }
 
 export default function CollaboratorTasksPeriodPage({ params }: PageProps) {
   const { token } = use(params)
   const [startDate, setStartDate] = useState<string>(() => {
     const d = new Date()
     d.setDate(d.getDate() - 14)
     return d.toISOString().split('T')[0]
   })
   const [endDate, setEndDate] = useState<string>(() => {
     const d = new Date()
     return d.toISOString().split('T')[0]
   })
   const [loading, setLoading] = useState(true)
   const [tasks, setTasks] = useState<Task[]>([])
 
   const fetchTasks = async () => {
     try {
       setLoading(true)
       const url = `/api/collaborator-portal/${token}/weekly-tasks?startDate=${startDate}&endDate=${endDate}`
       const res = await fetch(url)
       if (res.ok) {
         const data = await res.json()
         setTasks(data.tasks || [])
       }
     } catch (err) {
       console.error('Erro ao buscar tarefas do período:', err)
     } finally {
       setLoading(false)
     }
   }
 
   useEffect(() => {
     fetchTasks()
   }, [token, startDate, endDate])
 
   const counts = useMemo(() => {
     const endDateTime = new Date(endDate + 'T23:59:59.999Z').getTime()
     const between = (iso?: string) => {
       if (!iso) return false
       const t = new Date(iso).getTime()
       const startTime = new Date(startDate + 'T00:00:00.000Z').getTime()
       return t >= startTime && t <= endDateTime
     }
    const completedInPeriod = tasks.filter(t => t.status === 'COMPLETED' && (between(t.completedAt) || between(t.updatedAt))).length
     const overdue = tasks.filter(t => {
       if (!t.dueDate) return false
       const due = new Date(t.dueDate).getTime()
       return due <= endDateTime && t.status !== 'COMPLETED'
     }).length
     const pending = tasks.filter(t => t.status === 'TODO').length
     const inReview = tasks.filter(t => t.status === 'IN_REVIEW').length
     return { completedInPeriod, overdue, pending, inReview }
   }, [tasks, startDate, endDate])
 
   const grouped = useMemo(() => {
    const startTime = new Date(startDate + 'T00:00:00.000Z').getTime()
    const endTime = new Date(endDate + 'T23:59:59.999Z').getTime()
    const inPeriod = (iso?: string) => {
      if (!iso) return false
      const t = new Date(iso).getTime()
      return t >= startTime && t <= endTime
    }
    return {
      COMPLETED: tasks.filter(t => t.status === 'COMPLETED' && (inPeriod(t.completedAt) || inPeriod(t.updatedAt))),
       IN_REVIEW: tasks.filter(t => t.status === 'IN_REVIEW'),
       IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS'),
       TODO: tasks.filter(t => t.status === 'TODO'),
     }
   }, [tasks])
 
   return (
    <div className="min-h-screen bg-card/50">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-xl shadow-sm border border-muted">
          <div className="space-y-1">
            <Link 
              href={`/collaborator-portal/${token}`} 
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar para o Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Relatório de Tarefas</h1>
            <p className="text-muted-foreground text-lg">Acompanhe seu desempenho e histórico de atividades no período.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-card p-2 rounded-lg border border-border w-full md:w-auto">
              <Calendar className="h-4 w-4 text-muted-foreground ml-2" />
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 w-36 border-0 bg-transparent focus-visible:ring-0 px-2 text-sm"
                />
                <span className="text-muted-foreground text-sm">até</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 w-36 border-0 bg-transparent focus-visible:ring-0 px-2 text-sm"
                />
              </div>
            </div>
            <Button onClick={fetchTasks} className="w-full md:w-auto">
              <Filter className="h-4 w-4 mr-2" />
              Filtrar
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Concluídas"
            value={counts.completedInPeriod}
            icon={CheckCircle2}
            color="green"
            description="Neste período"
          />
          <StatsCard
            title="Atrasadas"
            value={counts.overdue}
            icon={AlertCircle}
            color="red"
            description="Fora do prazo"
          />
          <StatsCard
            title="Pendentes"
            value={counts.pending}
            icon={Target}
            color="blue"
            description="A fazer"
          />
          <StatsCard
            title="Em Análise"
            value={counts.inReview}
            icon={Clock}
            color="purple"
            description="Aguardando revisão"
          />
        </div>

        {/* Task Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <TaskList 
             title="Concluídas no período" 
             tasks={grouped.COMPLETED} 
             icon={CheckCircle2} 
             iconColor="text-green-700 dark:text-green-300"
             badgeColor="bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/40"
             type="completed"
             loading={loading}
           />

           <TaskList 
             title="Atrasadas" 
             tasks={tasks.filter(t => {
               if (!t.dueDate) return false
               const due = new Date(t.dueDate).getTime()
               const endDateTime = new Date(endDate + 'T23:59:59.999Z').getTime()
               return due <= endDateTime && t.status !== 'COMPLETED'
             })} 
             icon={AlertCircle} 
             iconColor="text-red-700 dark:text-red-300"
             badgeColor="bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-900/40"
             type="overdue"
             loading={loading}
           />

           <TaskList 
             title="Em Análise" 
             tasks={grouped.IN_REVIEW} 
             icon={Clock} 
             iconColor="text-purple-700 dark:text-purple-300"
             badgeColor="bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-900/40"
             type="in_review"
             loading={loading}
           />

           <TaskList 
             title="Pendentes" 
             tasks={grouped.TODO} 
             icon={Target} 
             iconColor="text-blue-700 dark:text-blue-300"
             badgeColor="bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/40"
             type="pending"
             loading={loading}
           />
        </div>
      </div>
    </div>
  )
}

function TaskList({ 
  title, 
  tasks, 
  icon: Icon, 
  iconColor, 
  badgeColor,
  type,
  loading 
}: { 
  title: string
  tasks: Task[]
  icon: any
  iconColor: string
  badgeColor: string
  type: 'completed' | 'overdue' | 'in_review' | 'pending'
  loading: boolean
}) {
  return (
    <Card className="border-muted shadow-sm overflow-hidden flex flex-col h-full">
      <CardHeader className="bg-card/50 border-b border-muted pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          {title}
          <span className={`ml-auto text-xs font-medium px-2.5 py-0.5 rounded-full ${badgeColor}`}>
            {tasks.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-[300px] max-h-[500px] overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-border"></div>
            <p className="text-sm">Carregando tarefas...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground gap-2">
            <div className="p-3 bg-card rounded-full">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Nenhuma tarefa encontrada</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tasks.map(t => (
              <div key={t.id} className="p-4 hover:bg-card transition-colors group">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground line-clamp-1">{t.title}</span>
                      {t.priority && (
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 
                          ${t.priority === 'URGENT' ? 'text-red-800 bg-red-100 border-red-200 dark:text-red-300 dark:bg-red-900/30 dark:border-red-900/40' : 
                            t.priority === 'HIGH' ? 'text-orange-800 bg-orange-100 border-orange-200 dark:text-orange-300 dark:bg-orange-900/30 dark:border-orange-900/40' : 
                            t.priority === 'MEDIUM' ? 'text-blue-800 bg-blue-100 border-blue-200 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-900/40' : 
                            'text-muted-foreground bg-card border-border'}`}>
                          {t.priority === 'URGENT' ? 'Urgente' : 
                           t.priority === 'HIGH' ? 'Alta' : 
                           t.priority === 'MEDIUM' ? 'Média' : 'Baixa'}
                        </Badge>
                      )}
                    </div>
                    
                    {t.project && (
                      <div className="flex items-center text-xs text-muted-foreground">
                        <span className="font-medium text-gray-700 mr-1.5">{t.project.name}</span>
                        {t.sprint && <span className="text-gray-400">• {t.sprint.name}</span>}
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-1">
                      {type === 'completed' && t.completedAt && (
                        <div className="text-xs text-green-700 dark:text-green-300 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Concluída em {new Date(t.completedAt).toLocaleDateString()}
                        </div>
                      )}
                      {type === 'overdue' && t.dueDate && (
                        <div className="text-xs text-red-700 dark:text-red-300 flex items-center gap-1 font-medium">
                          <AlertCircle className="h-3 w-3" />
                          Venceu em {new Date(t.dueDate).toLocaleDateString()}
                        </div>
                      )}
                      {type === 'pending' && t.startDate && (
                        <div className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Início: {new Date(t.startDate).toLocaleDateString()}
                        </div>
                      )}
                      {type === 'in_review' && (
                        <div className="text-xs text-purple-700 dark:text-purple-300 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Aguardando revisão
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

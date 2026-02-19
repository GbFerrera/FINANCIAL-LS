'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel
} from '@/components/ui/alert-dialog'
import { toast } from 'react-hot-toast'
import { 
  Target, 
  Calendar, 
  TrendingUp, 
  Search,
  Eye,
  Edit,
  Trash,
  Play,
  Pause,
  CheckCircle2,
  Plus
} from 'lucide-react'
import Link from 'next/link'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CreateSprintModal } from '@/components/scrum/CreateSprintModal'

interface Sprint {
  id: string
  name: string
  description?: string
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  startDate: string
  endDate: string
  goal?: string
  capacity?: number
  project?: {
    id: string
    name: string
    client: {
      name: string
    }
  }
  projects?: Array<{
    id: string
    name: string
    client: {
      id: string
      name: string
    }
  }>
  tasks: Array<{
    id: string
    storyPoints?: number
    status: string
  }>
}

function SprintsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [sprints, setSprints] = useState<Sprint[]>([])
  const [filteredSprints, setFilteredSprints] = useState<Sprint[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState((searchParams && searchParams.get('search')) || '')
  const [statusFilter, setStatusFilter] = useState<string>((searchParams && searchParams.get('status')) || 'all')
  const [showCreateSprint, setShowCreateSprint] = useState(false)
  const [showEditSprint, setShowEditSprint] = useState(false)
  const [sprintToEdit, setSprintToEdit] = useState<Sprint | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    goal: '',
    capacity: ''
  })
  const [deleteTarget, setDeleteTarget] = useState<Sprint | null>(null)

  useEffect(() => {
    fetchSprints()
  }, [])

  useEffect(() => {
    filterSprints()
    
    // Atualizar URL com os parâmetros
    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    
    const queryString = params.toString()
    router.push(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false })
  }, [sprints, searchTerm, statusFilter])

  const fetchSprints = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/sprints/all')
      if (response.ok) {
        const data = await response.json()
        console.log('Sprints carregadas:', data)
        setSprints(data)
      } else {
        console.error('Erro na resposta:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Erro ao carregar sprints:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterSprints = () => {
    let filtered = sprints || []

    // Filtro por texto
    if (searchTerm) {
      filtered = filtered.filter(sprint => {
        const searchLower = searchTerm.toLowerCase()
        return sprint.name.toLowerCase().includes(searchLower) ||
          sprint.project?.name.toLowerCase().includes(searchLower) ||
          sprint.project?.client.name.toLowerCase().includes(searchLower) ||
          (sprint.projects && sprint.projects.some(p => 
            p.name.toLowerCase().includes(searchLower) ||
            p.client.name.toLowerCase().includes(searchLower)
          ))
      })
    }

    // Filtro por status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(sprint => sprint.status === statusFilter)
    }

    setFilteredSprints(filtered)
  }

  const openEdit = (sprint: Sprint) => {
    setSprintToEdit(sprint)
    setEditForm({
      name: sprint.name || '',
      description: sprint.description || '',
      startDate: sprint.startDate ? format(new Date(sprint.startDate), 'yyyy-MM-dd') : '',
      endDate: sprint.endDate ? format(new Date(sprint.endDate), 'yyyy-MM-dd') : '',
      goal: sprint.goal || '',
      capacity: sprint.capacity != null ? String(sprint.capacity) : ''
    })
    setShowEditSprint(true)
  }

  const submitEdit = async () => {
    if (!sprintToEdit) return
    try {
      const body = {
        name: editForm.name,
        description: editForm.description,
        startDate: editForm.startDate ? editForm.startDate + 'T12:00:00.000Z' : undefined,
        endDate: editForm.endDate ? editForm.endDate + 'T12:00:00.000Z' : undefined,
        goal: editForm.goal,
        capacity: editForm.capacity !== '' ? Number(editForm.capacity) : undefined
      }
      const res = await fetch(`/api/sprints/${sprintToEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!res.ok) throw new Error('Falha ao atualizar sprint')
      toast.success('Sprint atualizada')
      setShowEditSprint(false)
      setSprintToEdit(null)
      fetchSprints()
    } catch (e) {
      toast.error('Erro ao atualizar sprint')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/sprints/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao deletar sprint')
      toast.success('Sprint deletada')
      setDeleteTarget(null)
      fetchSprints()
    } catch (e) {
      toast.error('Erro ao deletar sprint')
    }
  }

  const getSprintMetrics = (sprint: Sprint) => {
    const totalStoryPoints = sprint.tasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0)
    const completedStoryPoints = sprint.tasks
      .filter(task => task.status === 'COMPLETED')
      .reduce((sum, task) => sum + (task.storyPoints || 0), 0)
    
    const progress = totalStoryPoints > 0 ? Math.round((completedStoryPoints / totalStoryPoints) * 100) : 0
    const completedTasks = sprint.tasks.filter(t => t.status === 'COMPLETED').length
    
    return {
      totalStoryPoints,
      completedStoryPoints,
      progress,
      totalTasks: sprint.tasks.length,
      completedTasks
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return 'bg-amber-100 text-amber-800 border border-amber-200'
      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200'
      case 'COMPLETED':
        return 'bg-[#161f46]/10 text-[#161f46] border border-[#161f46]/20'
      case 'CANCELLED':
        return 'bg-rose-100 text-rose-800 border border-rose-200'
      default:
        return 'bg-gray-100 text-gray-800 border border-muted'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return <Calendar className="w-4 h-4" />
      case 'ACTIVE':
        return <Play className="w-4 h-4" />
      case 'COMPLETED':
        return <CheckCircle2 className="w-4 h-4" />
      case 'CANCELLED':
        return <Pause className="w-4 h-4" />
      default:
        return <Calendar className="w-4 h-4" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
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

  const getDaysRemaining = (sprint: Sprint) => {
    const today = new Date()
    const endDate = new Date(sprint.endDate)
    const startDate = new Date(sprint.startDate)
    
    if (sprint.status === 'COMPLETED' || sprint.status === 'CANCELLED') {
      return null
    }
    
    if (today < startDate) {
      const daysToStart = differenceInDays(startDate, today)
      return `Inicia em ${daysToStart} dia${daysToStart !== 1 ? 's' : ''}`
    }
    
    if (today > endDate) {
      const daysOverdue = differenceInDays(today, endDate)
      return `Atrasada ${daysOverdue} dia${daysOverdue !== 1 ? 's' : ''}`
    }
    
    const daysRemaining = differenceInDays(endDate, today)
    return `${daysRemaining} dia${daysRemaining !== 1 ? 's' : ''} restante${daysRemaining !== 1 ? 's' : ''}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#161f46]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Todas as Sprints</h1>
          <p className="text-muted-foreground">Visualize e gerencie todas as sprints dos seus projetos</p>
        </div>
        <Button
          onClick={() => setShowCreateSprint(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Sprint
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar sprints, projetos ou clientes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">Todos os Status</option>
                <option value="PLANNING">Planejamento</option>
                <option value="ACTIVE">Ativa</option>
                <option value="COMPLETED">Concluída</option>
                <option value="CANCELLED">Cancelada</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Sprints */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredSprints.map(sprint => {
          const metrics = getSprintMetrics(sprint)
          const daysRemaining = getDaysRemaining(sprint)
          
          return (
            <Card key={sprint.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-1">{sprint.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {sprint.project?.name || (sprint.projects && sprint.projects.length > 0 
                        ? `${sprint.projects.length} projeto${sprint.projects.length > 1 ? 's' : ''}` 
                        : 'Nenhum projeto')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {sprint.project?.client?.name || (sprint.projects && sprint.projects.length > 0 
                        ? sprint.projects.map(p => p.client.name).join(', ')
                        : 'Sem cliente')}
                    </p>
                  </div>
                  <Badge className={`${getStatusColor(sprint.status)} flex items-center gap-1 ml-2`}>
                    {getStatusIcon(sprint.status)}
                    {getStatusLabel(sprint.status)}
                  </Badge>
                </div>
                
                {sprint.goal && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{sprint.goal}</p>
                )}
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {/* Datas */}
                  <div className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {format(new Date(sprint.startDate), 'dd/MM', { locale: ptBR })} - {format(new Date(sprint.endDate), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    </div>
                    {daysRemaining && (
                      <p className="text-xs text-muted-foreground ml-6">{daysRemaining}</p>
                    )}
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-[#161f46]" />
                      <span>{metrics.completedTasks}/{metrics.totalTasks} tarefas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#161f46]" />
                      <span>{metrics.completedStoryPoints}/{metrics.totalStoryPoints} SP</span>
                    </div>
                  </div>

                  {/* Barra de Progresso */}
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Progresso</span>
                      <span>{metrics.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-[#161f46] h-2 rounded-full transition-all duration-300"
                        style={{ width: `${metrics.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2 pt-2">
                    <Link href={`/projects/${sprint.project?.id || (sprint.projects && sprint.projects[0]?.id) || 'unknown'}/scrum?sprint=${sprint.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Eye className="w-4 h-4 mr-2" />
                        Ver
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(sprint)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <AlertDialog open={deleteTarget?.id === sprint.id} onOpenChange={(open) => setDeleteTarget(open ? sprint : null)}>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(sprint)}>
                        <Trash className="w-4 h-4" />
                      </Button>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Deletar Sprint</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação removerá a sprint e desvinculará suas tarefas. Deseja continuar?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancelar</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>
                            Deletar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredSprints.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchTerm || statusFilter !== 'all' ? 'Nenhuma sprint encontrada' : 'Nenhuma sprint criada'}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm || statusFilter !== 'all' 
                ? 'Tente ajustar os filtros de busca' 
                : 'Crie sprints nos seus projetos para vê-las aqui'
              }
            </p>
          </CardContent>
        </Card>
      )}

      <CreateSprintModal
        isOpen={showCreateSprint}
        onClose={() => setShowCreateSprint(false)}
        onSuccess={() => {
          fetchSprints()
          setShowCreateSprint(false)
        }}
      />
      <Dialog open={showEditSprint} onOpenChange={setShowEditSprint}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Sprint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nome</Label>
              <Input id="edit-name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="edit-description">Descrição</Label>
              <Textarea id="edit-description" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-start">Início</Label>
                <Input id="edit-start" type="date" value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="edit-end">Fim</Label>
                <Input id="edit-end" type="date" value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-goal">Objetivo</Label>
              <Input id="edit-goal" value={editForm.goal} onChange={(e) => setEditForm({ ...editForm, goal: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="edit-capacity">Capacidade (SP)</Label>
              <Input id="edit-capacity" type="number" min="0" value={editForm.capacity} onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowEditSprint(false)}>Cancelar</Button>
              <Button onClick={submitEdit} className="bg-blue-600 hover:bg-blue-700">Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SprintsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#161f46]"></div>
        </div>
      }
    >
      <SprintsPageContent />
    </Suspense>
  )
}

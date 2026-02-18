'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { FileUpload } from '@/components/ui/file-upload'
import { Plus, AlertTriangle, CheckCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface Sprint {
  id: string
  name: string
  status: string
  startDate: string
  endDate: string
}

interface ReportTaskModalProps {
  collaboratorToken: string
  projects?: Array<{
    id: string
    name: string
    client: { name: string }
  }>
}

export function ReportTaskModal({ collaboratorToken, projects = [] }: ReportTaskModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [attachments, setAttachments] = useState<any[]>([])
  const fileUploadRef = useRef<any>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    projectId: '',
    sprintId: 'backlog'
  })

  // Buscar sprints disponíveis quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      fetchSprints()
    }
  }, [isOpen])

  const fetchSprints = async () => {
    try {
      console.log('Buscando sprints disponíveis para token:', collaboratorToken)
      const response = await fetch(`/api/collaborator-portal/${collaboratorToken}/available-sprints`)
      console.log('Response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Dados recebidos:', data)
        console.log('Sprints disponíveis:', data.sprints?.length || 0)
        setSprints(data.sprints || [])
      } else {
        console.error('Erro na resposta:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Erro ao buscar sprints:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      toast.error('Título da tarefa é obrigatório')
      return
    }

    setIsLoading(true)

    try {
      // Fazer upload dos arquivos primeiro se houver
      let uploadedAttachments = attachments
      if (fileUploadRef.current && attachments.some(f => f.file)) {
        try {
          uploadedAttachments = await fileUploadRef.current.handleUpload()
        } catch (uploadError) {
          toast.error('Erro ao fazer upload dos arquivos')
          setIsLoading(false)
          return
        }
      }

      const response = await fetch(`/api/collaborator-portal/${collaboratorToken}/report-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          sprintId: formData.sprintId === 'backlog' ? null : formData.sprintId,
          attachments: uploadedAttachments
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Tarefa reportada com sucesso!')
        setFormData({
          title: '',
          description: '',
          priority: 'MEDIUM',
          projectId: '',
          sprintId: 'backlog'
        })
        setAttachments([])
        setIsOpen(false)
      } else {
        toast.error(data.error || 'Erro ao reportar tarefa')
      }
    } catch (error) {
      console.error('Erro ao reportar tarefa:', error)
      toast.error('Erro ao reportar tarefa')
    } finally {
      setIsLoading(false)
    }
  }

  const priorityOptions = [
    { value: 'LOW', label: 'Baixa', color: 'bg-gray-100 text-gray-800' },
    { value: 'MEDIUM', label: 'Média', color: 'bg-blue-100 text-blue-800' },
    { value: 'HIGH', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
    { value: 'URGENT', label: 'Urgente', color: 'bg-red-100 text-red-800' }
  ]

  const selectedPriority = priorityOptions.find(p => p.value === formData.priority)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          size="sm"
        >
          <Plus className="w-4 h-4" />
          Reportar Tarefa
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-blue-600" />
            Reportar Nova Tarefa
          </DialogTitle>
        </DialogHeader>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Como funciona:</p>
              <ul className="mt-1 space-y-1 text-xs">
                <li>• Descreva a tarefa que precisa ser feita</li>
                <li>• Escolha a sprint ou deixe no backlog geral</li>
                <li>• O administrador definirá responsável e prazos</li>
              </ul>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Título da Tarefa *
            </label>
            <Input
              placeholder="Ex: Corrigir bug no login, Criar relatório mensal..."
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {formData.title.length}/100 caracteres
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Descrição (Opcional)
            </label>
            <Textarea
              placeholder="Descreva mais detalhes sobre o que precisa ser feito..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full min-h-[80px]"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {formData.description.length}/500 caracteres
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Prioridade Sugerida
            </label>
            <Select 
              value={formData.priority} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {selectedPriority && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={selectedPriority.color}>
                        {selectedPriority.label}
                      </Badge>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={option.color}>
                        {option.label}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Sprint de Destino
            </label>
            <Select 
              value={formData.sprintId} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, sprintId: value }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecionar sprint ou deixar no backlog..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="backlog">📋 Backlog Geral</SelectItem>
                {sprints.map((sprint) => (
                  <SelectItem key={sprint.id} value={sprint.id}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        sprint.status === 'ACTIVE' ? 'bg-green-500' : 'bg-blue-500'
                      }`}></span>
                      🎯 {sprint.name}
                      <Badge variant="outline" className="text-xs ml-auto">
                        {sprint.status === 'ACTIVE' ? 'Ativa' : 'Planejamento'}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {formData.sprintId && formData.sprintId !== 'backlog' ? 'Tarefa será adicionada à sprint selecionada' : 'Tarefa ficará no backlog geral para ser organizada'}
            </p>
          </div>

          {projects.length > 1 && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Projeto (Opcional)
              </label>
              <Select 
                value={formData.projectId} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecionar projeto específico..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Deixar admin decidir</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name} - {project.client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Anexos (Opcional)
            </label>
            <FileUpload
              ref={fileUploadRef}
              onFilesChange={setAttachments}
              maxFiles={3}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Adicione imagens ou PDFs para complementar a descrição da tarefa
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={isLoading || !formData.title.trim()}
            >
              {isLoading ? 'Reportando...' : 'Reportar Tarefa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

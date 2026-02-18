"use client"

import { parseISO } from "date-fns"
import { useState, useEffect } from "react"
import { DollarSign, Calendar, Tag, FileText, Repeat, Upload, X, Plus } from "lucide-react"
import toast from "react-hot-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Project {
  id: string
  name: string
}

interface Client {
  id: string
  name: string
  email: string
  company?: string
}

interface ProjectPaymentSummary {
  projectId: string
  projectName: string
  budget: number
  totalPaid: number
  remainingBudget: number
  paymentPercentage: number
}

interface FinancialEntry {
  id: string
  type: 'INCOME' | 'EXPENSE'
  category: string
  description: string
  amount: number
  date: string
  isRecurring: boolean
  recurringType?: string
  projectName?: string
  paymentId?: string // Novo campo para vincular com pagamento
  attachments?: Array<{
    id: string
    filename: string
    originalName: string
    size: number
    url: string
  }>
  createdAt: string
}

interface ProjectDistribution {
  projectId: string
  projectName: string
  amount: number
}

interface AddEntryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editingEntry?: FinancialEntry
}

// Categorias serão carregadas dinamicamente do banco de dados

const RECURRING_TYPES = [
  { value: 'MONTHLY', label: 'Mensal' },
  { value: 'QUARTERLY', label: 'Trimestral' },
  { value: 'YEARLY', label: 'Anual' }
]

export function AddEntryModal({ isOpen, onClose, onSuccess, editingEntry }: AddEntryModalProps) {
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [categories, setCategories] = useState<{INCOME: string[], EXPENSE: string[]}>({INCOME: [], EXPENSE: []})
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [clientProjectSummaries, setClientProjectSummaries] = useState<ProjectPaymentSummary[]>([])
  const [loadingClientData, setLoadingClientData] = useState(false)
  const [formData, setFormData] = useState({
    type: 'INCOME' as 'INCOME' | 'EXPENSE',
    category: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    isRecurring: false,
    recurringType: '',
    projectId: '',
    clientId: ''
  })
  const [attachments, setAttachments] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<Array<{
    id: string
    filename: string
    originalName: string
    size: number
    url: string
  }>>([])
  
  // Estados para distribuição de projetos
  const [enableProjectDistribution, setEnableProjectDistribution] = useState(false)
  const [projectDistributions, setProjectDistributions] = useState<ProjectDistribution[]>([])
  const [remainingAmount, setRemainingAmount] = useState(0)

  useEffect(() => {
    if (isOpen) {
      fetchProjects()
      fetchCategories()
      fetchClients()
      
      // Reset formulário para nova entrada ou preencher se editando
      if (editingEntry) {
        setFormData({
          type: editingEntry.type,
          category: editingEntry.category,
          description: editingEntry.description,
          amount: editingEntry.amount.toString(),
          date: editingEntry.date.split('T')[0],
          isRecurring: editingEntry.isRecurring,
          recurringType: editingEntry.recurringType || '',
          projectId: '',
          clientId: ''
        })
        setExistingAttachments(editingEntry.attachments || [])
      } else {
        // Reset formulário para nova entrada
        setFormData({
          type: 'INCOME',
          category: '',
          description: '',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          isRecurring: false,
          recurringType: '',
          projectId: '',
          clientId: ''
        })
        setSelectedClientId('')
        setClientProjectSummaries([])
        setExistingAttachments([])
      }
      setAttachments([])
    }
  }, [isOpen, editingEntry])

  // Separar useEffect para atualizar projectId quando projects carregarem
  useEffect(() => {
    if (editingEntry && projects.length > 0) {
      const project = projects.find(p => p.name === editingEntry.projectName)
      if (project) {
        setFormData(prev => ({ ...prev, projectId: project.id }))
      }
    }
  }, [editingEntry, projects])

  // Efeito para calcular valor restante
  useEffect(() => {
    const totalAmount = parseFloat(formData.amount) || 0
    const distributedAmount = projectDistributions.reduce((sum, dist) => sum + dist.amount, 0)
    setRemainingAmount(totalAmount - distributedAmount)
  }, [formData.amount, projectDistributions])

  // Reset category when type changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, category: '' }))
  }, [formData.type])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Erro ao buscar projetos:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/financial/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories)
      } else {
        // Fallback para categorias padrão se a API não existir ainda
        setCategories({
          INCOME: [
            'Pagamento de Cliente',
            'Consultoria', 
            'Desenvolvimento',
            'Manutenção',
            'Licenciamento',
            'Outros'
          ],
          EXPENSE: [
            'Salários',
            'Infraestrutura',
            'Software/Licenças',
            'Marketing',
            'Escritório',
            'Viagem',
            'Impostos',
            'Outros'
          ]
        })
      }
    } catch (error) {
      console.error('Erro ao buscar categorias:', error)
      // Fallback para categorias padrão
      setCategories({
        INCOME: [
          'Pagamento de Cliente',
          'Consultoria',
          'Desenvolvimento', 
          'Manutenção',
          'Licenciamento',
          'Outros'
        ],
        EXPENSE: [
          'Salários',
          'Infraestrutura',
          'Software/Licenças',
          'Marketing',
          'Escritório',
          'Viagem',
          'Impostos',
          'Outros'
        ]
      })
    }
  }

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients')
      if (response.ok) {
        const data = await response.json()
        setClients(data.clients || [])
      }
    } catch (error) {
      console.error('Erro ao buscar clientes:', error)
    }
  }

  const fetchClientProjectSummaries = async (clientId: string) => {
    if (!clientId) {
      setClientProjectSummaries([])
      return
    }

    setLoadingClientData(true)
    try {
      // Primeiro buscar o cliente para obter o accessToken
      const clientResponse = await fetch(`/api/clients/${clientId}`)
      if (!clientResponse.ok) {
        throw new Error('Cliente não encontrado')
      }
      
      const clientData = await clientResponse.json()
      const accessToken = clientData.accessToken
      
      if (!accessToken) {
        throw new Error('Cliente não possui token de acesso')
      }

      // Buscar dados do portal do cliente
      const portalResponse = await fetch(`/api/client-portal/${accessToken}`)
      if (portalResponse.ok) {
        const portalData = await portalResponse.json()
        setClientProjectSummaries(portalData.projectPaymentSummaries || [])
      } else {
        throw new Error('Erro ao buscar dados do portal do cliente')
      }
    } catch (error) {
      console.error('Erro ao buscar resumo de projetos do cliente:', error)
      toast.error('Erro ao carregar dados dos projetos do cliente')
      setClientProjectSummaries([])
    } finally {
      setLoadingClientData(false)
    }
  }

  // Effect para buscar dados do cliente quando selecionado
  useEffect(() => {
    if (selectedClientId && formData.category === 'Pagamento de Cliente') {
      fetchClientProjectSummaries(selectedClientId)
    } else {
      setClientProjectSummaries([])
    }
  }, [selectedClientId, formData.category])

  // Effect para limpar seleções quando categoria muda
  useEffect(() => {
    if (formData.category !== 'Pagamento de Cliente') {
      setSelectedClientId('')
      setClientProjectSummaries([])
      setFormData(prev => ({ ...prev, clientId: '', projectId: '' }))
    }
  }, [formData.category])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Debug: verificar quais campos estão vazios
    console.log('FormData:', formData)
    console.log('Campos vazios:', {
      type: !formData.type,
      category: !formData.category,
      description: !formData.description,
      amount: !formData.amount,
      date: !formData.date
    })
    
    if (!formData.type || !formData.category || !formData.description || !formData.amount || !formData.date) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Valor deve ser um número positivo')
      return
    }

    // Validação para distribuição de projetos
    if (enableProjectDistribution) {
      if (projectDistributions.length === 0) {
        toast.error('Adicione pelo menos um projeto para distribuição')
        return
      }

      const totalDistributed = projectDistributions.reduce((sum, dist) => sum + dist.amount, 0)
      if (Math.abs(totalDistributed - amount) > 0.01) {
        toast.error(`A soma das distribuições (${formatCurrency(totalDistributed)}) deve ser igual ao valor total (${formatCurrency(amount)})`)
        return
      }

      // Verificar se todos os projetos têm valores válidos
      for (const dist of projectDistributions) {
        if (dist.amount <= 0) {
          toast.error('Todos os valores de distribuição devem ser maiores que zero')
          return
        }
        if (!dist.projectId) {
          toast.error('Todos os projetos devem ser selecionados')
          return
        }
      }
    }

    setLoading(true)
    
    try {
      // Converter data para formato ISO datetime (sem Z para evitar conversão de fuso horário)
      const dateTime = formData.date + 'T12:00:00.000Z'
      
    const uploadedAttachments: Array<{ originalName: string; mimeType: string; size: number; url: string; filename?: string }> = []
    if (!editingEntry && attachments.length > 0) {
      for (const file of attachments) {
        const fd = new FormData()
        fd.append('file', file)
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({} as any))
          throw new Error(err.error || `Falha ao enviar arquivo ${file.name}`)
        }
        const data = await uploadRes.json()
        const info = data.file
        uploadedAttachments.push({
          originalName: info.originalName,
          mimeType: info.fileType,
          size: info.fileSize,
          url: info.fileUrl,
          filename: info.fileName
        })
      }
    }

    const url = editingEntry ? `/api/financial/${editingEntry.id}` : '/api/financial'
    const method = editingEntry ? 'PUT' : 'POST'

    let removeAttachmentIds: string[] = []

    const payload: any = {
      type: formData.type,
      category: formData.category,
      description: formData.description,
      amount: amount,
      date: dateTime,
      isRecurring: formData.isRecurring,
      recurringType: formData.isRecurring && formData.recurringType ? formData.recurringType : null,
      projectId: enableProjectDistribution ? null : (formData.projectId || null),
      projectDistributions: enableProjectDistribution ? projectDistributions : null
    }

    if (method === 'POST' && uploadedAttachments.length > 0) {
      payload.attachments = uploadedAttachments
    }
    // Em edição, anexos são gerenciados fora deste modal

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Erro ao ${editingEntry ? 'atualizar' : 'criar'} entrada`)
      }

      toast.success(`Entrada financeira ${editingEntry ? 'atualizada' : 'criada'} com sucesso!`)
      onSuccess()
      handleClose()
    } catch (error) {
      console.error('Erro ao criar entrada:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao criar entrada')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      type: 'INCOME',
      category: '',
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      isRecurring: false,
      recurringType: '',
      projectId: '',
      clientId: ''
    })
    setAttachments([])
    setExistingAttachments([])
    setEnableProjectDistribution(false)
    setProjectDistributions([])
    setSelectedClientId('')
    setClientProjectSummaries([])
    onClose()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(file => {
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        toast.error(`Arquivo ${file.name} é muito grande. Máximo 10MB.`)
        return false
      }
      return true
    })
    setAttachments(prev => [...prev, ...validFiles])
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const removeExistingAttachment = (attachmentId: string) => {
    setExistingAttachments(prev => prev.filter(att => att.id !== attachmentId))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatCurrencyInput = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  // Funções para distribuição de projetos
  const addProjectDistribution = () => {
    setProjectDistributions(prev => [...prev, {
      projectId: '',
      projectName: '',
      amount: 0
    }])
  }

  const updateProjectDistribution = (index: number, field: keyof ProjectDistribution, value: string | number) => {
    setProjectDistributions(prev => prev.map((dist, i) => {
      if (i === index) {
        if (field === 'projectId') {
          const project = projects.find(p => p.id === value)
          return {
            ...dist,
            projectId: value as string,
            projectName: project?.name || ''
          }
        }
        return { ...dist, [field]: value }
      }
      return dist
    }))
  }

  const removeProjectDistribution = (index: number) => {
    setProjectDistributions(prev => prev.filter((_, i) => i !== index))
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const availableCategories = categories[formData.type]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl md:max-w-3xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{editingEntry ? 'Editar Entrada Financeira' : 'Nova Entrada Financeira'}</DialogTitle>
          <DialogDescription>
            {editingEntry ? 'Edite os dados da entrada financeira.' : 'Adicione uma nova entrada financeira ao sistema.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type */}
          <div>
            <Label className="text-sm font-medium">
              Tipo *
            </Label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <Button
                type="button"
                variant={formData.type === 'INCOME' ? 'default' : 'outline'}
                onClick={() => setFormData(prev => ({ ...prev, type: 'INCOME' }))}
                className={`p-3 h-auto flex-col ${
                  formData.type === 'INCOME'
                    ? 'border-green-200 bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/40 dark:hover:bg-green-800/40'
                    : ''
                }`}
              >
                <DollarSign className="h-4 w-4 mb-1" />
                Receita
              </Button>
              <Button
                type="button"
                variant={formData.type === 'EXPENSE' ? 'default' : 'outline'}
                onClick={() => setFormData(prev => ({ ...prev, type: 'EXPENSE' }))}
                className={`p-3 h-auto flex-col ${
                  formData.type === 'EXPENSE'
                    ? 'border-red-200 bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-900/40 dark:hover:bg-red-800/40'
                    : ''
                }`}
              >
                <DollarSign className="h-4 w-4 mb-1" />
                Despesa
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category */}
            <div className="flex-1">
              <Label className="text-sm font-medium">
                Categoria *
              </Label>
              <div className="relative mt-1">
                <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger className="pl-10 w-full max-w-[560px]">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent className="w-full max-w-[560px]">
                    {availableCategories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Client Selection - Only for Client Payment */}
            {formData.category === 'Pagamento de Cliente' && (
              <div>
                <Label className="text-sm font-medium">
                  Cliente *
                </Label>
                <div className="mt-1">
                  <Select
                    value={selectedClientId}
                    onValueChange={(value) => {
                      setSelectedClientId(value)
                      setFormData(prev => ({ ...prev, clientId: value, projectId: '' }))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name} {client.company && `(${client.company})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Amount */}
            <div>
              <Label className="text-sm font-medium">
                Valor *
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground z-10">R$</span>
                <Input
                  type="text"
                  value={formData.amount ? formatCurrencyInput(parseFloat(formData.amount)) : ''}
                  onChange={(e) => {
                    // Remove tudo exceto números
                    const value = e.target.value.replace(/[^\d]/g, '')
                    if (value === '') {
                      setFormData(prev => ({ ...prev, amount: '' }))
                      return
                    }
                    // Converte centavos para reais
                    const numericValue = (parseFloat(value) / 100).toString()
                    setFormData(prev => ({ ...prev, amount: numericValue }))
                  }}
                  className="pl-10"
                  placeholder="0,00"
                  required
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <Label className="text-sm font-medium">
              Descrição *
            </Label>
            <div className="relative mt-1">
              <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400 z-10" />
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={12}
                className="pl-10 h-[150px]"
                placeholder="Descreva a entrada financeira..."
                required
              />
            </div>
          </div>

          <div className="">
            {/* Date */}
            <div className="mb-5">
              <Label className="text-sm font-medium">
                Data *
              </Label>
              <div className="relative mt-1">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Project Distribution Toggle */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Checkbox
                  id="enableProjectDistribution"
                  checked={enableProjectDistribution}
                  onCheckedChange={(checked) => {
                    setEnableProjectDistribution(checked as boolean)
                    if (!checked) {
                      setProjectDistributions([])
                      setFormData(prev => ({ ...prev, projectId: '' }))
                    }
                  }}
                />
                <Label htmlFor="enableProjectDistribution" className="text-sm font-medium">
                  Distribuir entre múltiplos projetos
                </Label>
              </div>

              {!enableProjectDistribution ? (
                // Seleção de projeto único (comportamento original)
                <div>
                  <Label className="text-sm font-medium">
                    Projeto (opcional)
                  </Label>
                  <div className="mt-1">
                    <Select
                      value={formData.projectId || undefined}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value || '' }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum projeto" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map(project => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                // Distribuição entre múltiplos projetos
                <div className="space-y-4">
                  <Label className="text-sm font-medium text-blue-700">
                    Distribuição por Projetos
                  </Label>

                  {/* Show client projects with payment info if Client Payment category */}
                  {formData.category === 'Pagamento de Cliente' && selectedClientId ? (
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="text-sm font-medium text-blue-800 mb-3">Projetos do Cliente</h4>
                      {loadingClientData ? (
                        <div className="p-3 text-center text-muted-foreground">
                          Carregando projetos...
                        </div>
                      ) : clientProjectSummaries.length > 0 ? (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {clientProjectSummaries.map(project => {
                            const distribution = projectDistributions.find(d => d.projectId === project.projectId)
                            const distributionAmount = distribution?.amount || 0
                            
                            return (
                              <div
                                key={project.projectId}
                                className="p-4 bg-card border-2 rounded-lg hover:border-blue-300 transition-colors"
                              >
                                <div className="space-y-3">
                                  {/* Project Header */}
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <h5 className="font-semibold text-sm text-gray-800">{project.projectName}</h5>
                                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                                        <div>
                                          <span className="text-muted-foreground">Orçamento:</span>
                                          <div className="font-medium text-gray-800">{formatCurrency(project.budget)}</div>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Pago:</span>
                                          <div className="font-medium text-green-600">{formatCurrency(project.totalPaid)}</div>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Restante:</span>
                                          <div className={`font-medium ${project.remainingBudget > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {formatCurrency(project.remainingBudget)}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="ml-3 text-right">
                                      <div className="text-xs text-muted-foreground">Progresso</div>
                                      <div className="text-sm font-bold text-blue-600">{project.paymentPercentage}%</div>
                                      <div className="w-16 h-2 bg-gray-200 rounded-full mt-1">
                                        <div 
                                          className="h-full bg-blue-500 rounded-full transition-all"
                                          style={{ width: `${Math.min(project.paymentPercentage, 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Value Input */}
                                  <div className="pt-3 border-t border-muted">
                                    <Label className="text-xs text-muted-foreground mb-1.5 block">Valor desta entrada</Label>
                                    <div className="flex items-center space-x-2">
                                      <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground z-10">R$</span>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={distributionAmount || ''}
                                          onChange={(e) => {
                                            const value = parseFloat(e.target.value) || 0
                                            const existingIndex = projectDistributions.findIndex(d => d.projectId === project.projectId)
                                            
                                            if (value > 0) {
                                              if (existingIndex >= 0) {
                                                updateProjectDistribution(existingIndex, 'amount', value)
                                              } else {
                                                setProjectDistributions(prev => [...prev, {
                                                  projectId: project.projectId,
                                                  projectName: project.projectName,
                                                  amount: value
                                                }])
                                              }
                                            } else if (existingIndex >= 0) {
                                              removeProjectDistribution(existingIndex)
                                            }
                                          }}
                                          className="pl-10 border-gray-300 focus:border-blue-500"
                                          placeholder="0,00"
                                        />
                                      </div>
                                      {distributionAmount > 0 && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const index = projectDistributions.findIndex(d => d.projectId === project.projectId)
                                            if (index >= 0) removeProjectDistribution(index)
                                          }}
                                          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-10 w-10 p-0"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="p-3 text-center text-muted-foreground border border-muted rounded-lg bg-card">
                          Nenhum projeto encontrado para este cliente
                        </div>
                      )}
                    </div>
                  ) : (
                    // Fallback for non-client payment or no client selected
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-sm font-medium text-gray-700">
                          Projetos
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addProjectDistribution}
                          className="border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar Projeto
                        </Button>
                      </div>

                      {projectDistributions.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-muted rounded-lg">
                          <Plus className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm">Clique em "Adicionar Projeto" para começar a distribuir</p>
                        </div>
                      )}

                      {projectDistributions.map((distribution, index) => (
                        <div key={index} className="flex items-center space-x-3 p-4 border-2 border-muted rounded-lg hover:border-blue-200 transition-colors bg-card shadow-sm mb-3">
                          <div className="flex-1">
                            <Label className="text-xs text-muted-foreground mb-1 block">Projeto</Label>
                            <Select
                              value={distribution.projectId}
                              onValueChange={(value) => updateProjectDistribution(index, 'projectId', value)}
                            >
                              <SelectTrigger className="border-muted focus:border-blue-400">
                                <SelectValue placeholder="Selecione um projeto" />
                              </SelectTrigger>
                              <SelectContent>
                                {projects.map(project => (
                                  <SelectItem key={project.id} value={project.id}>
                                    {project.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-36">
                            <Label className="text-xs text-muted-foreground mb-1 block">Valor</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground z-10">R$</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={distribution.amount || ''}
                                onChange={(e) => updateProjectDistribution(index, 'amount', parseFloat(e.target.value) || 0)}
                                className="pl-10 border-muted focus:border-blue-400"
                                placeholder="0,00"
                              />
                            </div>
                          </div>
                          <div className="pt-5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeProjectDistribution(index)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-9 w-9 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {projectDistributions.length > 0 && (
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100 space-y-3">
                      <h4 className="text-sm font-semibold text-blue-800 mb-3">Resumo da Distribuição</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground mb-1">Valor Total</div>
                          <div className="text-lg font-bold text-gray-800">{formatCurrency(parseFloat(formData.amount) || 0)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground mb-1">Distribuído</div>
                          <div className="text-lg font-bold text-blue-600">{formatCurrency(projectDistributions.reduce((sum, dist) => sum + dist.amount, 0))}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground mb-1">Restante</div>
                          <div className={`text-lg font-bold ${remainingAmount < 0 ? 'text-red-600' : remainingAmount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                            {formatCurrency(remainingAmount)}
                          </div>
                        </div>
                      </div>
                      
                      {remainingAmount !== 0 && (
                        <div className={`text-center p-3 rounded-md ${remainingAmount < 0 ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                          <div className="flex items-center justify-center space-x-2">
                            <span className="text-lg">
                              {remainingAmount < 0 ? '⚠️' : '💡'}
                            </span>
                            <span className="text-sm font-medium">
                              {remainingAmount < 0 
                                ? 'Valor distribuído excede o total!' 
                                : 'Ainda há valor para distribuir'
                              }
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {remainingAmount === 0 && projectDistributions.length > 0 && (
                        <div className="text-center p-3 bg-green-100 text-green-800 rounded-md">
                          <div className="flex items-center justify-center space-x-2">
                            <span className="text-lg">✅</span>
                            <span className="text-sm font-medium">Distribuição completa!</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Recurring */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isRecurring"
                checked={formData.isRecurring}
                onCheckedChange={(checked) => setFormData(prev => ({ 
                  ...prev, 
                  isRecurring: checked as boolean,
                  recurringType: checked ? prev.recurringType : ''
                }))}
              />
              <Label htmlFor="isRecurring" className="text-sm font-medium flex items-center">
                <Repeat className="h-4 w-4 mr-1" />
                Entrada recorrente
              </Label>
            </div>

            {formData.isRecurring && (
              <div>
                <Label className="text-sm font-medium">
                  Frequência
                </Label>
                <div className="mt-1">
                  <Select
                    value={formData.recurringType}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, recurringType: value }))}
                    required={formData.isRecurring}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a frequência" />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRING_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Attachments (somente na criação) */}
          {!editingEntry && (
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center">
                <Upload className="h-4 w-4 mr-1" />
                Anexos
              </Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,.xml"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-muted-foreground">Clique para adicionar arquivos</p>
                  <p className="text-xs text-gray-400 mt-1">PDF e imagens (máx. 10MB cada)</p>
                </label>
              </div>

              {attachments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Novos anexos:</p>
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-card rounded border border-border">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{file.name}</span>
                        <span className="text-xs text-muted-foreground">({formatFileSize(file.size)})</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(index)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading 
                ? (editingEntry ? 'Salvando...' : 'Criando...') 
                : (editingEntry ? 'Salvar Alterações' : 'Criar Entrada')
              }
            </Button>
          </div>
        </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

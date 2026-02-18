'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { StatsCard } from '@/components/ui/stats-card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'react-hot-toast'
import {
  Users,
  UserPlus,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Link,
  Copy,
  Building,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  FolderOpen,
  ExternalLink
} from 'lucide-react'
import { parseISO } from 'date-fns'
import { FileUpload } from '@/components/ui/file-upload'
import { Button } from '@/components/ui/button'

interface Client {
  id: string
  name: string
  email: string
  phone: string
  company: string
  createdAt: string
  totalProjects: number
  totalValue: number
  accessToken: string
  lastAccess?: string
}

interface NewClient {
  name: string
  email: string
  phone: string
  company: string
}

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [filteredClients, setFilteredClients] = useState<Client[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  const [isAddClientOpen, setIsAddClientOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [isViewClientOpen, setIsViewClientOpen] = useState(false)
  const [isEditClientOpen, setIsEditClientOpen] = useState(false)
  const [editClient, setEditClient] = useState<NewClient>({
    name: '',
    email: '',
    phone: '',
    company: ''
  })
  const [newClient, setNewClient] = useState<NewClient>({
    name: '',
    email: '',
    phone: '',
    company: ''
  })
  const [clientFsAttachments, setClientFsAttachments] = useState<Array<{ filename: string; url: string; size: number; uploadedAt: string }>>([])
  const [paymentAttachments, setPaymentAttachments] = useState<Array<{ id?: string; filename: string; originalName?: string; size: number; url: string; date?: string }>>([])
  const [attachmentsTab, setAttachmentsTab] = useState<'contratos' | 'pagamentos'>('pagamentos')
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const fileUploadRef = useRef<{ handleUpload: (idOverride?: string) => Promise<any> }>(null)

  // Load clients from API
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch('/api/clients')
        if (response.ok) {
          const data = await response.json()
          const transformedClients = data.clients.map((client: any) => ({
            id: client.id,
            name: client.name,
            email: client.email,
            phone: client.phone || '',
            company: client.company || '',
            address: client.address || '',
            createdAt: new Date(client.createdAt).toISOString().split('T')[0],
            totalProjects: client._count?.projects || 0,
            totalValue: client.projects?.reduce((sum: number, project: any) => sum + (project.budget || 0), 0) || 0,
            accessToken: client.accessToken,
            lastAccess: client.lastAccess ? new Date(client.lastAccess).toISOString().split('T')[0] : undefined
          }))
          setClients(transformedClients)
          setFilteredClients(transformedClients)
        } else {
          toast.error('Erro ao carregar clientes')
        }
      } catch (error) {
        console.error('Erro ao buscar clientes:', error)
        toast.error('Erro ao carregar clientes')
      }
    }

    fetchClients()
  }, [])

  // Filter clients based on search and status
  useEffect(() => {
    let filtered = clients

    if (searchTerm) {
      filtered = filtered.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.company.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }



    setFilteredClients(filtered)
  }, [clients, searchTerm])

  useEffect(() => {
    const loadAttachments = async () => {
      if (!selectedClient || !isViewClientOpen) return
      try {
        const [fsRes, finRes] = await Promise.all([
          fetch(`/api/clients/${selectedClient.id}/attachments`),
          fetch(`/api/financial?clientId=${selectedClient.id}&limit=100`)
        ])
        if (fsRes.ok) {
          const fsData = await fsRes.json()
          setClientFsAttachments(fsData.attachments || [])
        } else {
          setClientFsAttachments([])
        }
        if (finRes.ok) {
          const finData = await finRes.json()
          const flattened = (finData.entries || []).flatMap((entry: any) => {
            const atts = (entry.attachments || []).map((a: any) => ({
              id: a.id,
              filename: a.filename || a.originalName,
              originalName: a.originalName,
              size: a.size,
              url: a.url,
              date: entry.date
            }))
            return atts
          })
          setPaymentAttachments(flattened)
        } else {
          setPaymentAttachments([])
        }
      } catch (e) {
        setClientFsAttachments([])
        setPaymentAttachments([])
      }
    }
    loadAttachments()
  }, [selectedClient, isViewClientOpen])

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newClient.name,
          email: newClient.email,
          phone: newClient.phone,
          company: newClient.company,

        })
      })

      if (response.ok) {
        const createdClient = await response.json()
        const transformedClient = {
          id: createdClient.id,
          name: createdClient.name,
          email: createdClient.email,
          phone: createdClient.phone || '',
          company: createdClient.company || '',
          address: createdClient.address || '',
          createdAt: new Date(createdClient.createdAt).toISOString().split('T')[0],
          totalProjects: createdClient._count?.projects || 0,
          totalValue: 0,
          accessToken: createdClient.accessToken
        }
        
        setClients(prev => [...prev, transformedClient])
        setNewClient({
          name: '',
          email: '',
          phone: '',
          company: ''
        })
        setIsAddClientOpen(false)
        toast.success('Cliente adicionado com sucesso!')
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Erro ao adicionar cliente')
      }
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error)
      toast.error('Erro ao adicionar cliente')
    }
  }

  const handleDeleteClient = async (clientId: string) => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
      try {
        const response = await fetch(`/api/clients/${clientId}`, {
          method: 'DELETE'
        })

        if (response.ok) {
          setClients(prev => prev.filter(client => client.id !== clientId))
          toast.success('Cliente excluído com sucesso!')
        } else {
          const errorData = await response.json()
          toast.error(errorData.error || 'Erro ao excluir cliente')
        }
      } catch (error) {
        console.error('Erro ao excluir cliente:', error)
        toast.error('Erro ao excluir cliente')
      }
    }
  }

  const generateClientLink = (client: Client) => {
    const baseUrl = window.location.origin
    return `${baseUrl}/client-portal/${client.accessToken}`
  }

  const copyClientLink = (client: Client) => {
    const link = generateClientLink(client)
    navigator.clipboard.writeText(link)
    toast.success('Link copiado para a área de transferência!')
  }
  
  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClient) return
    try {
      const response = await fetch(`/api/clients/${selectedClient.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editClient.name,
          email: editClient.email,
          phone: editClient.phone,
          company: editClient.company,
        })
      })
      if (response.ok) {
        const updatedClient = await response.json()
        setClients(prev => prev.map(c => c.id === updatedClient.id ? {
          ...c,
          name: updatedClient.name,
          email: updatedClient.email,
          phone: updatedClient.phone || '',
          company: updatedClient.company || ''
        } : c))
        setFilteredClients(prev => prev.map(c => c.id === updatedClient.id ? {
          ...c,
          name: updatedClient.name,
          email: updatedClient.email,
          phone: updatedClient.phone || '',
          company: updatedClient.company || ''
        } : c))
        setSelectedClient(prev => prev ? {
          ...prev,
          name: updatedClient.name,
          email: updatedClient.email,
          phone: updatedClient.phone || '',
          company: updatedClient.company || ''
        } : prev)
        setIsEditClientOpen(false)
        toast.success('Cliente atualizado com sucesso!')
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Erro ao atualizar cliente')
      }
    } catch (error) {
      toast.error('Erro ao atualizar cliente')
    }
  }



  const stats = [
    {
      title: 'Total de Clientes',
      value: clients.length.toString(),
      icon: Users,
      change: {
         value: '+12%',
         type: 'increase' as const
       }
    },
    {
      title: 'Clientes Ativos',
      value: clients.length.toString(),
      icon: Users,
      change: {
         value: '+8%',
         type: 'increase' as const
       }
    },
    {
      title: 'Valor Total',
      value: `R$ ${clients.reduce((sum, c) => sum + c.totalValue, 0).toLocaleString()}`,
      icon: DollarSign,
      change: {
         value: '+15%',
         type: 'increase' as const
       }
    },
    {
      title: 'Projetos Ativos',
      value: clients.reduce((sum, c) => sum + c.totalProjects, 0).toString(),
      icon: FolderOpen,
      change: {
         value: '+5%',
         type: 'increase' as const
       }
    }
  ]

  return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Clientes</h1>
            <p className="text-muted-foreground">
              Gerencie seus clientes e gere links de acesso para o portal
            </p>
          </div>
          <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
            <DialogTrigger asChild>
              <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors">
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar Cliente
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Adicionar Novo Cliente</DialogTitle>
                <DialogDescription>
                  Preencha as informações do cliente. Um link de acesso será gerado automaticamente.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddClient} className="space-y-4">
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Nome</label>
                      <input
                        type="text"
                        value={newClient.name}
                        onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                      <input
                        type="email"
                        value={newClient.email}
                        onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Telefone</label>
                      <input
                        type="tel"
                        value={newClient.phone}
                        onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Empresa</label>
                      <input
                        type="text"
                        value={newClient.company}
                        onChange={(e) => setNewClient({...newClient, company: e.target.value})}
                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                        required
                      />
                    </div>
                  </div>

                </div>
                <DialogFooter>
                  <button
                    type="button"
                    onClick={() => setIsAddClientOpen(false)}
                    className="px-4 py-2 border border-input rounded-md text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
                  >
                    Adicionar Cliente
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <StatsCard key={index} {...stat} />
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <input
              type="text"
              placeholder="Buscar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-input rounded-md focus:ring-2 focus:ring-primary bg-background text-foreground"
            />
          </div>

        </div>

        {/* Clients Table */}
        <div className="bg-card shadow rounded-lg overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Contato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Empresa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Projetos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Valor Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Link de Acesso
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-foreground">{client.name}</div>
                          <div className="text-sm text-muted-foreground">Cliente desde {parseISO(client.createdAt).toLocaleDateString('pt-BR')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">{client.email}</div>
                      <div className="text-sm text-muted-foreground">{client.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">{client.company}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        Ativo
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {client.totalProjects}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      R$ {client.totalValue.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => copyClientLink(client)}
                          className="inline-flex items-center px-2 py-1 border border-input rounded text-xs font-medium text-foreground bg-card hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copiar Link
                        </button>
                        <a
                          href={generateClientLink(client)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-2 py-1 border border-primary/20 rounded text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Abrir Portal
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setSelectedClient(client)
                            setIsViewClientOpen(true)
                          }}
                          className="text-primary hover:text-primary/80 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedClient(client)
                            setEditClient({
                              name: client.name,
                              email: client.email,
                              phone: client.phone,
                              company: client.company
                            })
                            setIsEditClientOpen(true)
                          }}
                          className="text-yellow-600 hover:text-yellow-700 dark:text-yellow-500 dark:hover:text-yellow-400 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClient(client.id)}
                          className="text-destructive hover:text-destructive/80 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredClients.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium text-foreground">Nenhum cliente encontrado</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchTerm 
                ? 'Tente ajustar os filtros de busca.'
                : 'Comece adicionando um novo cliente.'
              }
            </p>
          </div>
        )}

        {/* View Client Modal */}
        <Dialog open={isViewClientOpen} onOpenChange={setIsViewClientOpen}>
          <DialogContent className="sm:max-w-[720px]">
            <DialogHeader>
              <DialogTitle>Detalhes do Cliente</DialogTitle>
            </DialogHeader>
            {selectedClient && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Nome</label>
                    <p className="mt-1 text-sm text-foreground">{selectedClient.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Email</label>
                    <p className="mt-1 text-sm text-foreground">{selectedClient.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Telefone</label>
                    <p className="mt-1 text-sm text-foreground">{selectedClient.phone}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Empresa</label>
                    <p className="mt-1 text-sm text-foreground">{selectedClient.company}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Status</label>
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                      Ativo
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Cliente desde</label>
                    <p className="mt-1 text-sm text-foreground">{parseISO(selectedClient.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Total de Projetos</label>
                    <p className="mt-1 text-sm text-foreground">{selectedClient.totalProjects}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Valor Total</label>
                    <p className="mt-1 text-sm text-foreground">R$ {selectedClient.totalValue.toLocaleString()}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">Link de Acesso</label>
                  <div className="mt-1 flex items-center space-x-2">
                    <input
                      type="text"
                      value={generateClientLink(selectedClient)}
                      readOnly
                      className="flex-1 px-3 py-2 border border-input rounded-md bg-muted text-foreground text-sm"
                    />
                    <button
                      onClick={() => copyClientLink(selectedClient)}
                      className="px-3 py-2 border border-input rounded-md text-sm font-medium text-foreground bg-card hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {selectedClient.lastAccess && (
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Último Acesso</label>
                    <p className="mt-1 text-sm text-foreground">{parseISO(selectedClient.lastAccess).toLocaleDateString('pt-BR')}</p>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-muted-foreground">Anexos</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAttachmentsTab('pagamentos')}
                        className={`px-3 py-1 text-xs rounded border ${attachmentsTab === 'pagamentos' ? 'bg-primary text-primary-foreground border-transparent' : 'bg-muted text-muted-foreground border-input'}`}
                      >
                        Pagamentos ({paymentAttachments.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttachmentsTab('contratos')}
                        className={`px-3 py-1 text-xs rounded border ${attachmentsTab === 'contratos' ? 'bg-primary text-primary-foreground border-transparent' : 'bg-muted text-muted-foreground border-input'}`}
                      >
                        Contratos ({clientFsAttachments.length})
                      </button>
                    </div>
                  </div>

                  {attachmentsTab === 'pagamentos' ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto border border-border rounded-md p-2 bg-card">
                      {paymentAttachments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum anexo de pagamentos encontrado</p>
                      ) : (
                        paymentAttachments.map((att, idx) => (
                          <div key={`${att.id || att.filename}-${idx}`} className="flex items-center justify-between px-2 py-2 hover:bg-muted/50 rounded">
                            <div className="flex items-center gap-3">
                              <Eye className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="text-sm text-foreground">{att.originalName || att.filename}</div>
                                <div className="text-xs text-muted-foreground">{(att.size / 1024).toFixed(1)} KB {att.date ? `• ${new Date(att.date).toLocaleDateString('pt-BR')}` : ''}</div>
                              </div>
                            </div>
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-2 py-1 rounded border border-input hover:bg-accent hover:text-accent-foreground"
                            >
                              Abrir
                            </a>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedClient && (
                        <>
                          <FileUpload
                            ref={fileUploadRef}
                            clientId={selectedClient.id}
                            existingFiles={clientFsAttachments.map((att) => {
                              const ext = att.filename.split('.').pop()?.toLowerCase()
                              let type = 'application/octet-stream'
                              if (ext === 'pdf') {
                                type = 'application/pdf'
                              } else if (ext && ['jpg','jpeg','png','gif','webp'].includes(ext)) {
                                type = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
                              }
                              return {
                                id: `${att.filename}-${att.uploadedAt}`,
                                originalName: att.filename,
                                fileName: att.filename,
                                filePath: `clients/${selectedClient.id}/${att.filename}`,
                                fileSize: att.size,
                                fileType: type,
                                uploadedAt: att.uploadedAt
                              }
                            })}
                            maxFiles={5}
                          />
                          <div className="flex items-center justify-end">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={async () => {
                                if (!selectedClient) return
                                setUploadingAttachment(true)
                                try {
                                  await fileUploadRef.current?.handleUpload(selectedClient.id)
                                  const refresh = await fetch(`/api/clients/${selectedClient.id}/attachments`)
                                  if (refresh.ok) {
                                    const data = await refresh.json()
                                    setClientFsAttachments(data.attachments || [])
                                  }
                                  toast.success('Contrato(s) anexado(s) com sucesso')
                                } catch {
                                  toast.error('Erro ao enviar arquivo(s)')
                                } finally {
                                  setUploadingAttachment(false)
                                }
                              }}
                              className="min-w-[140px]"
                            >
                              {uploadingAttachment ? 'Enviando...' : 'Enviar anexos'}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <button
                onClick={() => setIsViewClientOpen(false)}
                className="px-4 py-2 border border-input rounded-md text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Fechar
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <Dialog open={isEditClientOpen} onOpenChange={setIsEditClientOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Editar Cliente</DialogTitle>
              <DialogDescription>
                Atualize as informações do cliente.
              </DialogDescription>
            </DialogHeader>
            {selectedClient && (
              <form onSubmit={handleEditClient} className="space-y-4">
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Nome</label>
                      <input
                        type="text"
                        value={editClient.name}
                        onChange={(e) => setEditClient({ ...editClient, name: e.target.value })}
                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                      <input
                        type="email"
                        value={editClient.email}
                        onChange={(e) => setEditClient({ ...editClient, email: e.target.value })}
                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Telefone</label>
                      <input
                        type="tel"
                        value={editClient.phone}
                        onChange={(e) => setEditClient({ ...editClient, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Empresa</label>
                      <input
                        type="text"
                        value={editClient.company}
                        onChange={(e) => setEditClient({ ...editClient, company: e.target.value })}
                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                        required
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <button
                    type="button"
                    onClick={() => setIsEditClientOpen(false)}
                    className="px-4 py-2 border border-input rounded-md text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
                  >
                    Salvar Alterações
                  </button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
  )
}

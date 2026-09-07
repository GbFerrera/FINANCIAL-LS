'use client'

import { useState, useEffect, useRef } from 'react'
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
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Copy,
  Building2,
  Mail,
  Phone,
  FolderOpen,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FileUpload } from '@/components/ui/file-upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { PageLoadingGate } from '@/components/ui/loading-animation'
import { CurrencyAmount } from '@/components/ui/currency-amount'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 10

interface ClientSummary {
  totalProjects: number
  totalValue: number
}

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
  const [clients, setClients] = useState<Client[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalClients, setTotalClients] = useState(0)
  const [summary, setSummary] = useState<ClientSummary>({ totalProjects: 0, totalValue: 0 })
  const [loading, setLoading] = useState(true)

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

  // Debounce busca
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const fetchClients = async (pageToLoad = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pageToLoad),
        limit: String(PAGE_SIZE),
      })
      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim())
      }

      const response = await fetch(`/api/clients?${params}`)
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
        setTotalClients(data.pagination.total)
        setTotalPages(data.pagination.pages)
        if (data.summary) {
          setSummary(data.summary)
        }
      } else {
        toast.error('Erro ao carregar clientes')
      }
    } catch (error) {
      console.error('Erro ao buscar clientes:', error)
      toast.error('Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients(page)
  }, [page, debouncedSearch])

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
        await response.json()
        setNewClient({
          name: '',
          email: '',
          phone: '',
          company: ''
        })
        setIsAddClientOpen(false)
        setPage(1)
        fetchClients(1)
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
          if (clients.length === 1 && page > 1) {
            setPage(page - 1)
          } else {
            fetchClients(page)
          }
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



  const openViewClient = (client: Client) => {
    setSelectedClient(client)
    setIsViewClientOpen(true)
  }

  const openEditClient = (client: Client) => {
    setSelectedClient(client)
    setEditClient({
      name: client.name,
      email: client.email,
      phone: client.phone,
      company: client.company,
    })
    setIsEditClientOpen(true)
  }

  const clientInitials = (name: string) =>
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'C'

  return (
    <PageLoadingGate loading={loading && clients.length === 0}>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Clientes</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Gerencie clientes e links de acesso ao portal
            </p>
          </div>
          <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Adicionar cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[560px]">
              <DialogHeader className="border-b border-border px-6 py-5">
                <DialogTitle>Adicionar cliente</DialogTitle>
                <DialogDescription>
                  Preencha os dados. Um link de portal será gerado automaticamente.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddClient} className="flex flex-col">
                <div className="space-y-4 px-6 py-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="new-name">Nome</Label>
                      <Input
                        id="new-name"
                        value={newClient.name}
                        onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-email">Email</Label>
                      <Input
                        id="new-email"
                        type="email"
                        value={newClient.email}
                        onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="new-phone">Telefone</Label>
                      <Input
                        id="new-phone"
                        type="tel"
                        value={newClient.phone}
                        onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-company">Empresa</Label>
                      <Input
                        id="new-company"
                        value={newClient.company}
                        onChange={(e) => setNewClient({ ...newClient, company: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter className="border-t border-border px-6 py-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddClientOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Adicionar cliente</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard title="Total de clientes" value={totalClients} />
          <StatsCard title="Clientes ativos" value={totalClients} />
          <StatsCard
            title="Valor total"
            value={<CurrencyAmount value={summary.totalValue} size="md" />}
          />
          <StatsCard title="Projetos vinculados" value={summary.totalProjects} />
        </div>

        <Card className="gap-0 overflow-hidden py-0 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <CardHeader className="border-b border-border px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Lista de clientes</CardTitle>
                <CardDescription className="mt-0.5">
                  {totalClients} cadastro{totalClients === 1 ? '' : 's'}
                </CardDescription>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar clientes..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setPage(1)
                  }}
                  className="h-9 pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Cliente</th>
                    <th className="px-3 py-2.5 font-medium">Contato</th>
                    <th className="px-3 py-2.5 font-medium">Projetos</th>
                    <th className="px-3 py-2.5 font-medium">Valor</th>
                    <th className="px-3 py-2.5 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className={cn(loading && clients.length > 0 && 'opacity-60')}>
                  {clients.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-16 text-center">
                        <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                        <p className="text-sm font-medium text-foreground">Nenhum cliente encontrado</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {searchTerm
                            ? 'Ajuste a busca ou limpe o filtro.'
                            : 'Adicione o primeiro cliente para começar.'}
                        </p>
                        {searchTerm ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-4"
                            onClick={() => {
                              setSearchTerm('')
                              setPage(1)
                            }}
                          >
                            Limpar busca
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ) : loading && clients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        Carregando clientes…
                      </td>
                    </tr>
                  ) : (
                    clients.map((client) => (
                      <tr
                        key={client.id}
                        className="border-b border-border transition-colors last:border-b-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar className="h-9 w-9 shrink-0">
                              <AvatarFallback className="text-xs">{clientInitials(client.name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-medium text-foreground">{client.name}</p>
                                <Badge variant="secondary" className="text-[10px] font-normal">
                                  Ativo
                                </Badge>
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                {client.company ? (
                                  <span className="inline-flex items-center gap-1 truncate">
                                    <Building2 className="h-3 w-3 shrink-0" />
                                    {client.company}
                                  </span>
                                ) : null}
                                <span>
                                  desde{' '}
                                  {format(parseISO(client.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-0.5 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-[220px] text-foreground">{client.email}</span>
                            </div>
                            {client.phone ? (
                              <div className="flex items-center gap-1.5">
                                <Phone className="h-3.5 w-3.5 shrink-0" />
                                <span>{client.phone}</span>
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                            <span className="tabular-nums">{client.totalProjects}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <CurrencyAmount value={client.totalValue} size="sm" />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => openViewClient(client)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Ver detalhes
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEditClient(client)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => copyClientLink(client)}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copiar link
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <a
                                    href={generateClientLink(client)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Abrir portal
                                  </a>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => handleDeleteClient(client.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalClients > 0 && (
              <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, totalClients)} de {totalClients}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Badge variant="outline" className="min-w-[4rem] justify-center font-normal">
                    {page} / {totalPages}
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
                    <Badge variant="secondary" className="mt-1 font-normal">
                      Ativo
                    </Badge>
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
                      type="button"
                      onClick={() => copyClientLink(selectedClient)}
                      className="px-3 py-2"
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
              <Button variant="outline" onClick={() => setIsViewClientOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <Dialog open={isEditClientOpen} onOpenChange={setIsEditClientOpen}>
          <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[560px]">
            <DialogHeader className="border-b border-border px-6 py-5">
              <DialogTitle>Editar cliente</DialogTitle>
              <DialogDescription>Atualize as informações do cliente.</DialogDescription>
            </DialogHeader>
            {selectedClient && (
              <form onSubmit={handleEditClient} className="flex flex-col">
                <div className="space-y-4 px-6 py-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Nome</Label>
                      <Input
                        id="edit-name"
                        value={editClient.name}
                        onChange={(e) => setEditClient({ ...editClient, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-email">Email</Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={editClient.email}
                        onChange={(e) => setEditClient({ ...editClient, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-phone">Telefone</Label>
                      <Input
                        id="edit-phone"
                        type="tel"
                        value={editClient.phone}
                        onChange={(e) => setEditClient({ ...editClient, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-company">Empresa</Label>
                      <Input
                        id="edit-company"
                        value={editClient.company}
                        onChange={(e) => setEditClient({ ...editClient, company: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter className="border-t border-border px-6 py-4">
                  <Button type="button" variant="outline" onClick={() => setIsEditClientOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Salvar alterações</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageLoadingGate>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "react-hot-toast"
import { Plus, Search, FileText, ExternalLink, Edit, Eye, User, FilePen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Proposal {
  id: string
  code: string
  title: string
  status: string
  issuedAt: string
  validUntil: string | null
  client: { id: string; name: string }
  project: { id: string; name: string } | null
}

interface Client {
  id: string
  name: string
}

export default function ProposalsPage() {
  const router = useRouter()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClientId, setSelectedClientId] = useState<string>("all")
  
  useEffect(() => {
    const loadData = async () => {
      try {
        const [proposalsRes, clientsRes] = await Promise.all([
          fetch("/api/proposals?limit=100"),
          fetch("/api/clients?limit=100")
        ])
        
        if (proposalsRes.ok) {
          const pData = await proposalsRes.json()
          setProposals(pData.proposals || [])
        }
        
        if (clientsRes.ok) {
          const cData = await clientsRes.json()
          setClients(cData.clients || [])
        }
      } catch (error) {
        toast.error("Erro ao carregar dados")
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Rascunho</Badge>
      case "SENT":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none dark:bg-blue-900/30 dark:text-blue-400">Enviada</Badge>
      case "ACCEPTED":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none dark:bg-green-900/30 dark:text-green-400">Aceita</Badge>
      case "REJECTED":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-none dark:bg-red-900/30 dark:text-red-400">Recusada</Badge>
      case "ARCHIVED":
        return <Badge variant="outline" className="text-slate-500 border-slate-200 dark:border-slate-700">Arquivada</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const filteredProposals = proposals.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.client.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesClient = selectedClientId === "all" || p.client.id === selectedClientId
    
    return matchesSearch && matchesClient
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FilePen className="size-8 text-primary" />
            Propostas Comerciais
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie todas as propostas enviadas para seus clientes.</p>
        </div>
        
        <Button onClick={() => router.push("/proposals/new")} className="bg-[#0f2545] hover:bg-[#0f2545]/90 text-white shadow-sm">
          <Plus className="mr-2 h-4 w-4" />
          Nova Proposta
        </Button>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="bg-muted/30 pb-4 border-b border-border">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, título ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>
            <div className="w-full sm:w-[250px]">
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="bg-background">
                  <div className="flex items-center gap-2">
                    <User className="size-4 text-muted-foreground" />
                    <SelectValue placeholder="Filtrar por cliente" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando propostas...</div>
          ) : filteredProposals.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="bg-muted/50 p-4 rounded-full mb-4">
                <FileText className="size-8 text-muted-foreground opacity-50" />
              </div>
              <h3 className="text-lg font-medium text-foreground">Nenhuma proposta encontrada</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-6">
                {searchTerm || selectedClientId !== "all" 
                  ? "Tente limpar os filtros para ver todas as propostas."
                  : "Você ainda não criou nenhuma proposta comercial. Clique no botão acima para criar a primeira."}
              </p>
              {!(searchTerm || selectedClientId !== "all") && (
                <Button onClick={() => router.push("/proposals/new")} variant="outline">
                  Criar Primeira Proposta
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredProposals.map((proposal) => (
                <div key={proposal.id} className="p-4 sm:p-6 hover:bg-muted/20 transition-colors flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className="hidden sm:flex size-12 rounded-xl bg-primary/10 items-center justify-center text-primary font-bold text-xs shrink-0">
                      {proposal.code.replace("PROP-", "")}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground sm:hidden">
                          {proposal.code}
                        </span>
                        {getStatusBadge(proposal.status)}
                      </div>
                      <h4 className="text-base font-semibold text-foreground line-clamp-1">{proposal.title}</h4>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <User className="size-3.5" />
                          <span className="font-medium text-foreground/80">{proposal.client.name}</span>
                        </span>
                        {proposal.project && (
                          <>
                            <span className="hidden sm:inline text-border">•</span>
                            <span className="truncate max-w-[200px]">Proj: {proposal.project.name}</span>
                          </>
                        )}
                        <span className="hidden sm:inline text-border">•</span>
                        <span>
                          Emissão: {format(new Date(proposal.issuedAt), "dd/MM/yyyy")}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 sm:shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => router.push(`/proposta?code=${proposal.code}`)}
                      className="flex-1 sm:flex-none"
                    >
                      <ExternalLink className="size-4 mr-2" />
                      Visualizar
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={() => router.push(`/proposals/${proposal.code}/edit`)}
                      className="flex-1 sm:flex-none"
                    >
                      <Edit className="size-4 mr-2" />
                      Editar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

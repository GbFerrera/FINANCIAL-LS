'use client'

import { parseISO } from "date-fns"
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Users, 
  Key, 
  Copy, 
  Trash2, 
  Plus,
  ExternalLink,
  RefreshCw,
  Search,
  Eye,
  EyeOff
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ROUTE_REGISTRY } from '@/lib/access-control'
import toast from 'react-hot-toast'

interface User {
  id: string
  name: string
  email: string
  role: string
  accessToken?: string
  createdAt: string
  updatedAt: string
}

interface CollaboratorWithToken {
  user: User
  portalUrl?: string
}

export default function CollaboratorsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [collaborators, setCollaborators] = useState<CollaboratorWithToken[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showTokens, setShowTokens] = useState<Set<string>>(new Set())
  const [permissionsOpen, setPermissionsOpen] = useState<Set<string>>(new Set())
  const [userPermissions, setUserPermissions] = useState<Record<string, string[]>>({})

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session) {
      router.push('/auth/signin')
      return
    }
    
    if (session.user?.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }
    
    fetchCollaborators()
  }, [session, status, router])

  const fetchCollaborators = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/collaborator/token')
      
      if (!response.ok) {
        throw new Error('Erro ao carregar colaboradores')
      }
      
      const data = await response.json()
      const collaboratorsWithUrls = data.collaborators.map((collab: User) => ({
        user: collab,
        portalUrl: collab.accessToken 
          ? `${window.location.origin}/collaborator-portal/${collab.accessToken}`
          : undefined
      }))
      
      setCollaborators(collaboratorsWithUrls)
    } catch (error) {
      console.error('Erro ao buscar colaboradores:', error)
      toast.error('Erro ao carregar colaboradores')
    } finally {
      setLoading(false)
    }
  }

  const generateToken = async (userId: string) => {
    try {
      const response = await fetch('/api/collaborator/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao gerar token')
      }
      
      const data = await response.json()
      toast.success('Token gerado com sucesso!')
      fetchCollaborators() // Refresh the list
    } catch (error) {
      console.error('Erro ao gerar token:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar token')
    }
  }

  const revokeToken = async (userId: string) => {
    try {
      const response = await fetch('/api/collaborator/token', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao revogar token')
      }
      
      toast.success('Token revogado com sucesso!')
      fetchCollaborators() // Refresh the list
    } catch (error) {
      console.error('Erro ao revogar token:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao revogar token')
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Link copiado para a área de transferência!')
    } catch (error) {
      console.error('Erro ao copiar:', error)
      toast.error('Erro ao copiar link')
    }
  }

  const toggleTokenVisibility = (userId: string) => {
    setShowTokens(prev => {
      const newSet = new Set(prev)
      if (newSet.has(userId)) {
        newSet.delete(userId)
      } else {
        newSet.add(userId)
      }
      return newSet
    })
  }

  const filteredCollaborators = collaborators.filter(collab =>
    collab.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    collab.user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const togglePermissions = async (userId: string) => {
    setPermissionsOpen(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
    if (!userPermissions[userId]) {
      try {
        const res = await fetch(`/api/users/${userId}/permissions`)
        if (res.ok) {
          const data = await res.json()
          setUserPermissions(prev => ({ ...prev, [userId]: data.allowedPaths || [] }))
        }
      } catch (e) {
        console.error(e)
      }
    }
  }

  const onTogglePath = (userId: string, path: string, checked: boolean) => {
    setUserPermissions(prev => {
      const current = prev[userId] || []
      const set = new Set(current)
      if (checked) set.add(path)
      else set.delete(path)
      return { ...prev, [userId]: Array.from(set) }
    })
  }

  const savePermissions = async (userId: string) => {
    try {
      const allowedPaths = userPermissions[userId] || []
      const res = await fetch(`/api/users/${userId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedPaths }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao salvar permissões')
      }
      toast.success('Permissões atualizadas')
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Erro ao salvar permissões')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gerenciar Colaboradores</h1>
            <p className="text-muted-foreground">
              Gerencie tokens de acesso e links do portal para colaboradores.
            </p>
          </div>
          <Button onClick={fetchCollaborators} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Buscar Colaboradores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="search">Nome ou Email</Label>
                <Input
                  id="search"
                  placeholder="Digite o nome ou email do colaborador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Colaboradores</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{collaborators.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Com Token Ativo</CardTitle>
              <Key className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {collaborators.filter(c => c.user.accessToken).length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sem Token</CardTitle>
              <Key className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                {collaborators.filter(c => !c.user.accessToken).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Collaborators List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Lista de Colaboradores</h2>
          
          {filteredCollaborators.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    {searchTerm ? 'Nenhum colaborador encontrado' : 'Nenhum colaborador cadastrado'}
                  </h3>
                  <p className="text-muted-foreground">
                    {searchTerm 
                      ? 'Tente ajustar os termos de busca.' 
                      : 'Cadastre colaboradores para gerenciar seus acessos.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredCollaborators.map((collab) => (
                <Card key={collab.user.id} className="transition-all duration-200 hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{collab.user.name}</CardTitle>
                          <Badge variant="outline">{collab.user.role}</Badge>
                          {collab.user.accessToken && (
                            <Badge className="bg-green-500 text-white">
                              Token Ativo
                            </Badge>
                          )}
                        </div>
                        <CardDescription>{collab.user.email}</CardDescription>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {collab.user.accessToken ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleTokenVisibility(collab.user.id)}
                              className="gap-1"
                            >
                              {showTokens.has(collab.user.id) ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                              {showTokens.has(collab.user.id) ? 'Ocultar' : 'Ver Token'}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => copyToClipboard(collab.portalUrl!)}
                              className="gap-1"
                            >
                              <Copy className="h-4 w-4" />
                              Copiar Link
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(collab.portalUrl, '_blank')}
                              className="gap-1"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Abrir Portal
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => revokeToken(collab.user.id)}
                              className="gap-1"
                            >
                              <Trash2 className="h-4 w-4" />
                              Revogar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => togglePermissions(collab.user.id)}
                              className="gap-1"
                            >
                              Gerenciar Acesso
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => generateToken(collab.user.id)}
                            className="gap-1"
                          >
                            <Plus className="h-4 w-4" />
                            Gerar Token
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  {collab.user.accessToken && (
                    <CardContent className="space-y-4">
                      {showTokens.has(collab.user.id) && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Token de Acesso:</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              value={collab.user.accessToken}
                              readOnly
                              className="font-mono text-sm"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(collab.user.accessToken!)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Link do Portal:</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={collab.portalUrl}
                            readOnly
                            className="text-sm"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(collab.portalUrl!)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        Criado em: {parseISO(collab.user.createdAt).toLocaleDateString('pt-BR')}
                        {collab.user.updatedAt !== collab.user.createdAt && (
                          <> • Atualizado em: {parseISO(collab.user.updatedAt).toLocaleDateString('pt-BR')}</>
                        )}
                      </div>
                      
                      {permissionsOpen.has(collab.user.id) && (
                        <div className="space-y-4 border-t pt-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Permissões de Páginas</Label>
                            <Button size="sm" onClick={() => savePermissions(collab.user.id)}>
                              Salvar
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {ROUTE_REGISTRY.map((route) => {
                              const checked = (userPermissions[collab.user.id] || []).includes(route.path)
                              return (
                                <label key={route.key} className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => onTogglePath(collab.user.id, route.path, e.target.checked)}
                                  />
                                  <span className="text-foreground">{route.label}</span>
                                  <span className="text-muted-foreground text-xs">({route.path})</span>
                                </label>
                              )
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Dica: marcar "Projetos" libera também páginas internas de projetos.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

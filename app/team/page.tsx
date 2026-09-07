'use client'

import { parseISO, format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { PageLoadingGate } from '@/components/ui/loading-animation'
import {
  Users, 
  UserPlus, 
  Search, 
  Phone, 
  MapPin, 
  MoreVertical,
  Edit,
  Trash2,
  LockKeyhole,
  Shield,
  BarChart3
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatsCard } from '@/components/ui/stats-card'
import { cn } from '@/lib/utils'
import { getDefaultAllowedPaths, registryPaths } from '@/lib/access-control'
import {
  getDefaultWorkspaceAccess,
  type WorkspaceAccessConfig,
} from '@/lib/workspace-permissions'
import { UserPermissionsDialog } from '@/components/team/UserPermissionsDialog'
import { useTeamPresence } from '@/hooks/useTeamPresence'
import type { WorkspaceDTO } from '@/lib/workspace-utils'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'


interface TeamMember {
  id: string
  name: string
  email: string
  phone?: string
  role: string
  department: string
  avatar?: string
  status: 'online' | 'offline' | 'away'
  joinedAt: string
  lastActive: string
  permissions: string[]
  projects: string[]
  skills: string[]
  location?: string
  accessToken?: string
}

export default function TeamPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [filteredMembers, setFilteredMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [selectedRole, setSelectedRole] = useState('all')
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [isEditMemberOpen, setIsEditMemberOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    department: '',
    location: '',
    password: ''
  })
  const [editMemberData, setEditMemberData] = useState({
    name: '',
    email: '',
    role: '',
    password: ''
  })
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false)
  const [permissionsMember, setPermissionsMember] = useState<TeamMember | null>(null)
  const [allowedPaths, setAllowedPaths] = useState<string[]>([])
  const [workspaceAccess, setWorkspaceAccess] = useState<WorkspaceAccessConfig>({
    workspaceIds: null,
    canCreateWorkspaces: false,
  })
  const [permissionWorkspaces, setPermissionWorkspaces] = useState<WorkspaceDTO[]>([])
  const [loadingPermissionWorkspaces, setLoadingPermissionWorkspaces] = useState(false)
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [commissionsAccess, setCommissionsAccess] = useState<"OWN_READ" | "OWN_EDIT" | "ALL_EDIT">("OWN_READ")
  const { presenceByUser, onlineCount } = useTeamPresence()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      fetchMembers()
    }
  }, [status, router])

  useEffect(() => {
    filterMembers()
  }, [members, searchTerm, selectedDepartment, selectedRole])

  const fetchMembers = async () => {
    try {
      const response = await fetch('/api/team')
      if (response.ok) {
        const data = await response.json()
        setMembers(data.users || [])
      } else {
        toast.error('Erro ao carregar membros da equipe')
      }
    } catch (error) {
      console.error('Erro ao buscar membros:', error)
      toast.error('Erro ao carregar membros da equipe')
    } finally {
      setLoading(false)
    }
  }

  const openEditMember = (member: TeamMember) => {
    setEditingMember(member)
    setEditMemberData({
      name: member.name || '',
      email: member.email || '',
      role: member.role || '',
      password: ''
    })
    setIsEditMemberOpen(true)
  }

  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMember) return
    try {
      const response = await fetch(`/api/team/${editingMember.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editMemberData.name,
          email: editMemberData.email,
          role: editMemberData.role,
          password: editMemberData.password ? editMemberData.password : undefined
        })
      })

      if (response.ok) {
        const updated = await response.json()
        setMembers(prev =>
          prev.map(m => (m.id === updated.id ? { ...m, ...updated } : m))
        )
        toast.success('Membro atualizado com sucesso')
        setIsEditMemberOpen(false)
        setEditingMember(null)
      } else {
        const err = await response.json()
        toast.error(err.error || 'Erro ao atualizar membro')
      }
    } catch (error) {
      console.error('Erro ao editar membro:', error)
      toast.error('Erro ao editar membro')
    }
  }

  const openPermissions = async (member: TeamMember) => {
    setPermissionsMember(member)
    setLoadingPermissionWorkspaces(true)
    try {
      const [permRes, wsRes] = await Promise.all([
        fetch(`/api/users/${member.id}/permissions`),
        fetch('/api/workspaces'),
      ])
      if (permRes.ok) {
        const data = await permRes.json()
        let initial = (data.allowedPaths || getDefaultAllowedPaths(member.role as any)) as string[]
        if (initial.includes("/*")) {
          initial = registryPaths()
        }
        setAllowedPaths(Array.from(new Set(initial)))
        setCommissionsAccess((data.commissionsAccess as "OWN_READ" | "OWN_EDIT" | "ALL_EDIT") ?? (member.role === "ADMIN" ? "ALL_EDIT" : "OWN_READ"))
        setWorkspaceAccess(
          data.workspaceAccess ?? getDefaultWorkspaceAccess(member.role as any)
        )
        if (wsRes.ok) {
          const workspaces = await wsRes.json()
          setPermissionWorkspaces(Array.isArray(workspaces) ? workspaces : [])
        } else {
          setPermissionWorkspaces([])
        }
        setIsPermissionsOpen(true)
      } else {
        toast.error('Não foi possível carregar permissões')
      }
    } catch (e) {
      toast.error('Erro ao carregar permissões')
    } finally {
      setLoadingPermissionWorkspaces(false)
    }
  }

  const savePermissions = async () => {
    if (!permissionsMember) return
    try {
      setSavingPermissions(true)
      const allPaths = registryPaths()
      const selected = Array.from(new Set(allowedPaths))
      const payloadPaths =
        permissionsMember.role === 'ADMIN' && selected.length === allPaths.length
          ? ["/*"]
          : selected
      const res = await fetch(`/api/users/${permissionsMember.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedPaths: payloadPaths, commissionsAccess, workspaceAccess }),
      })
      if (res.ok) {
        toast.success('Permissões atualizadas')
        setIsPermissionsOpen(false)
        setPermissionsMember(null)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('permissionsUpdated'))
        }
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erro ao salvar permissões')
      }
    } catch (e) {
      toast.error('Erro ao salvar permissões')
    } finally {
      setSavingPermissions(false)
    }
  }

  const filterMembers = () => {
    let filtered = members

    if (searchTerm) {
      filtered = filtered.filter(member => 
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.role.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (selectedDepartment !== 'all') {
      filtered = filtered.filter(member => member.department === selectedDepartment)
    }

    if (selectedRole !== 'all') {
      filtered = filtered.filter(member => member.role === selectedRole)
    }

    setFilteredMembers(filtered)
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newMember)
      })

      if (response.ok) {
        const data = await response.json()
        setMembers([...members, data])
        setNewMember({
          name: '',
          email: '',
          phone: '',
          role: '',
          department: '',
          location: '',
          password: ''
        })
        setIsAddMemberOpen(false)
        toast.success('Membro adicionado com sucesso')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Erro ao adicionar membro')
      }
    } catch (error) {
      console.error('Erro ao adicionar membro:', error)
      toast.error('Erro ao adicionar membro')
    }
  }

  const handleGenerateToken = async (memberId: string) => {
    try {
      const response = await fetch('/api/collaborator/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: memberId })
      })

      if (response.ok) {
        const data = await response.json()
        // Atualizar o membro na lista local
        setMembers(prevMembers => 
          prevMembers.map(member => 
            member.id === memberId 
              ? { ...member, accessToken: data.user.accessToken }
              : member
          )
        )
        toast.success('Token gerado com sucesso!')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Erro ao gerar token')
      }
    } catch (error) {
      console.error('Erro ao gerar token:', error)
      toast.error('Erro ao gerar token')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500 dark:bg-green-600'
      case 'away': return 'bg-yellow-500 dark:bg-yellow-600'
      case 'offline': return 'bg-muted-foreground'
      default: return 'bg-muted-foreground'
    }
  }


  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Administrador'
      case 'TEAM':
        return 'Membro'
      case 'CLIENT':
        return 'Cliente'
      default:
        return role
    }
  }

  const departments = members.length > 0 ? [...new Set(members.map(m => m.department))] : []
  const roles = members.length > 0 ? [...new Set(members.map(m => m.role))] : []

  return (
    <PageLoadingGate loading={loading}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Equipe</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Gerencie membros, cargos e permissões
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => router.push('/team/performance')}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Performance
            </Button>
            <Button onClick={() => setIsAddMemberOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Adicionar membro
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard title="Total de membros" value={members.length} />
          <StatsCard
            title="Online agora"
            value={onlineCount}
          />
          <StatsCard title="Departamentos" value={departments.length} />
          <StatsCard
            title="Administradores"
            value={members.filter((m) => m.role === 'ADMIN').length}
          />
        </div>

        <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
          <DialogTrigger asChild>
            <div style={{display: 'none'}} />
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Membro</DialogTitle>
              <DialogDescription>
                Preencha as informações do novo membro da equipe.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="name" className="text-right text-sm font-medium">
                    Nome
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={newMember.name}
                    onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                    className="col-span-3 px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="email" className="text-right text-sm font-medium">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={newMember.email}
                    onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                    className="col-span-3 px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="password" className="text-right text-sm font-medium">
                    Senha
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={newMember.password}
                    onChange={(e) => setNewMember({...newMember, password: e.target.value})}
                    className="col-span-3 px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="phone" className="text-right text-sm font-medium">
                    Telefone
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={newMember.phone}
                    onChange={(e) => setNewMember({...newMember, phone: e.target.value})}
                    className="col-span-3 px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="role" className="text-right text-sm font-medium">
                    Cargo
                  </label>
                  <select
                    id="role"
                    value={newMember.role}
                    onChange={(e) => setNewMember({...newMember, role: e.target.value})}
                    className="col-span-3 px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    required
                  >
                    <option value="">Selecione o cargo</option>
                    <option value="ADMIN">Administrador</option>
                    <option value="TEAM">Membro da Equipe</option>
                    <option value="CLIENT">Cliente</option>
                  </select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="department" className="text-right text-sm font-medium">
                    Departamento
                  </label>
                  <select
                    id="department"
                    value={newMember.department}
                    onChange={(e) => setNewMember({...newMember, department: e.target.value})}
                    className="col-span-3 px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    required
                  >
                    <option value="">Selecione o departamento</option>
                    <option value="Tecnologia">Tecnologia</option>
                    <option value="Financeiro">Financeiro</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Recursos Humanos">Recursos Humanos</option>
                    <option value="Operações">Operações</option>
                  </select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="location" className="text-right text-sm font-medium">
                    Localização
                  </label>
                  <input
                    id="location"
                    type="text"
                    value={newMember.location}
                    onChange={(e) => setNewMember({...newMember, location: e.target.value})}
                    placeholder="Ex: São Paulo, SP"
                    className="col-span-3 px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-4 py-2 border border-input rounded-md text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
                >
                  Adicionar Membro
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar membros..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger size="sm" className="h-9 w-full sm:w-[148px] [&>span]:line-clamp-1">
                  <SelectValue placeholder="Departamento" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">Todos</SelectItem>
                  {departments.filter(Boolean).map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger size="sm" className="h-9 w-full sm:w-[132px] [&>span]:line-clamp-1">
                  <SelectValue placeholder="Cargo" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">Todos</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {getRoleLabel(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Membro</th>
                  <th className="px-3 py-2.5 font-medium">Cargo</th>
                  <th className="px-3 py-2.5 font-medium">Departamento</th>
                  <th className="px-3 py-2.5 font-medium">Presença</th>
                  <th className="px-3 py-2.5 font-medium">Contato</th>
                  <th className="px-3 py-2.5 font-medium">Desde</th>
                  <th className="px-3 py-2.5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm font-medium text-foreground">Nenhum membro encontrado</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Ajuste os filtros ou adicione um novo membro.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => {
                          setSearchTerm('')
                          setSelectedDepartment('all')
                          setSelectedRole('all')
                        }}
                      >
                        Limpar filtros
                      </Button>
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => {
                    const presence = presenceByUser[member.id]
                    const isOnline = presence?.isOnline ?? member.status === 'online'
                    return (
                    <tr
                      key={member.id}
                      className="border-b border-border transition-colors last:border-b-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="relative shrink-0">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={member.avatar} alt={member.name} />
                              <AvatarFallback className="text-xs">
                                {member.name
                                  ? member.name
                                      .split(' ')
                                      .map((n) => n[0])
                                      .join('')
                                      .toUpperCase()
                                  : 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <span
                              className={cn(
                                'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background',
                                isOnline ? 'bg-green-500 dark:bg-green-600' : getStatusColor('offline')
                              )}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{member.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="secondary" className="font-normal">
                          {getRoleLabel(member.role)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{member.department || '—'}</td>
                      <td className="px-3 py-3">
                        <div className="space-y-0.5">
                          <Badge variant={isOnline ? 'default' : 'secondary'} className="font-normal">
                            {isOnline ? 'Online' : 'Offline'}
                          </Badge>
                          {presence?.activeLabel ? (
                            <p className="text-xs tabular-nums text-muted-foreground">
                              {presence.activeLabel} hoje
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          {member.phone ? (
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              <span>{member.phone}</span>
                            </div>
                          ) : (
                            <span>—</span>
                          )}
                          {member.location && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-[140px]">{member.location}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {member.joinedAt
                          ? format(parseISO(member.joinedAt), 'dd/MM/yyyy', { locale: ptBR })
                          : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {member.accessToken && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() =>
                                window.open(
                                  `https://projects.linksystem.tech/collaborator-portal/${member.accessToken}`,
                                  '_blank'
                                )
                              }
                            >
                              <Shield className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!member.accessToken && member.role === 'TEAM' && (
                                <DropdownMenuItem onClick={() => handleGenerateToken(member.id)}>
                                  <Shield className="mr-2 h-4 w-4" />
                                  Gerar token
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => openPermissions(member)}>
                                <LockKeyhole className="mr-2 h-4 w-4" />
                                Permissões
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditMember(member)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={async () => {
                                  if (
                                    !confirm(
                                      `Tem certeza que deseja remover ${member.name}? Esta ação não pode ser desfeita.`
                                    )
                                  ) {
                                    return
                                  }
                                  try {
                                    const res = await fetch(`/api/team/${member.id}`, {
                                      method: 'DELETE',
                                    })
                                    if (!res.ok) {
                                      const err = await res.json().catch(() => ({}))
                                      throw new Error(err.error || 'Falha ao remover usuário')
                                    }
                                    setMembers((prev) => prev.filter((m) => m.id !== member.id))
                                    toast.success('Usuário removido com sucesso')
                                  } catch (e) {
                                    toast.error(
                                      e instanceof Error ? e.message : 'Erro ao remover usuário'
                                    )
                                  }
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remover
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Dialog open={isEditMemberOpen} onOpenChange={setIsEditMemberOpen}>
          <DialogTrigger asChild>
            <div style={{display: 'none'}} />
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Editar Membro</DialogTitle>
              <DialogDescription>
                Atualize as informações do membro da equipe.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditMember} className="space-y-4">
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="edit-name" className="text-right text-sm font-medium">
                    Nome
                  </label>
                  <input
                    id="edit-name"
                    type="text"
                    value={editMemberData.name}
                    onChange={(e) => setEditMemberData({...editMemberData, name: e.target.value})}
                    className="col-span-3 px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="edit-email" className="text-right text-sm font-medium">
                    Email
                  </label>
                  <input
                    id="edit-email"
                    type="email"
                    value={editMemberData.email}
                    onChange={(e) => setEditMemberData({...editMemberData, email: e.target.value})}
                    className="col-span-3 px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="edit-role" className="text-right text-sm font-medium">
                    Cargo
                  </label>
                  <select
                    id="edit-role"
                    value={editMemberData.role}
                    onChange={(e) => setEditMemberData({...editMemberData, role: e.target.value})}
                    className="col-span-3 px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    required
                  >
                    <option value="ADMIN">Administrador</option>
                    <option value="TEAM">Membro da Equipe</option>
                    <option value="CLIENT">Cliente</option>
                  </select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="edit-password" className="text-right text-sm font-medium">
                    Nova Senha
                  </label>
                  <input
                    id="edit-password"
                    type="password"
                    value={editMemberData.password}
                    onChange={(e) => setEditMemberData({...editMemberData, password: e.target.value})}
                    placeholder="Deixe em branco para manter"
                    className="col-span-3 px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    minLength={6}
                  />
                </div>
              </div>
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setIsEditMemberOpen(false)}
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
          </DialogContent>
        </Dialog>
        
        <UserPermissionsDialog
          open={isPermissionsOpen}
          onOpenChange={setIsPermissionsOpen}
          memberName={permissionsMember?.name ?? 'Usuário'}
          memberRole={permissionsMember?.role ?? 'TEAM'}
          allowedPaths={allowedPaths}
          onAllowedPathsChange={setAllowedPaths}
          workspaceAccess={workspaceAccess}
          onWorkspaceAccessChange={setWorkspaceAccess}
          commissionsAccess={commissionsAccess}
          onCommissionsAccessChange={setCommissionsAccess}
          workspaces={permissionWorkspaces}
          loadingWorkspaces={loadingPermissionWorkspaces}
          saving={savingPermissions}
          onSave={savePermissions}
        />
      </div>
    </PageLoadingGate>
  )
}

'use client'

import { parseISO, format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar,
  MessageCircle,
  Settings,
  MoreVertical,
  Edit,
  Trash2,
  LockKeyhole,
  Shield,
  Clock,
  CheckCircle,
  BarChart3
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Input } from "@/components/ui/input"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROUTE_REGISTRY, getDefaultAllowedPaths, registryPaths } from "@/lib/access-control"

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
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [commissionsAccess, setCommissionsAccess] = useState<"OWN_READ" | "OWN_EDIT" | "ALL_EDIT">("OWN_READ")

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
    try {
      const res = await fetch(`/api/users/${member.id}/permissions`)
      if (res.ok) {
        const data = await res.json()
        let initial = (data.allowedPaths || getDefaultAllowedPaths(member.role as any)) as string[]
        if (initial.includes("/*")) {
          initial = registryPaths()
        }
        setAllowedPaths(Array.from(new Set(initial)))
        setCommissionsAccess((data.commissionsAccess as "OWN_READ" | "OWN_EDIT" | "ALL_EDIT") ?? (member.role === "ADMIN" ? "ALL_EDIT" : "OWN_READ"))
        setIsPermissionsOpen(true)
      } else {
        toast.error('Não foi possível carregar permissões')
      }
    } catch (e) {
      toast.error('Erro ao carregar permissões')
    }
  }

  const togglePath = (path: string) => {
    setAllowedPaths((prev) => {
      const set = new Set(prev)
      if (set.has(path)) {
        set.delete(path)
      } else {
        set.add(path)
      }
      return Array.from(set)
    })
  }

  const allowAll = () => {
    setAllowedPaths(registryPaths())
  }

  const applyRoleDefaults = () => {
    if (!permissionsMember) return
    setAllowedPaths(getDefaultAllowedPaths(permissionsMember.role as any))
    setCommissionsAccess(permissionsMember.role === "ADMIN" ? "ALL_EDIT" : "OWN_READ")
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
        body: JSON.stringify({ allowedPaths: payloadPaths, commissionsAccess }),
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return 'Online'
      case 'away': return 'Ausente'
      case 'offline': return 'Offline'
      default: return 'Desconhecido'
    }
  }

  const departments = members.length > 0 ? [...new Set(members.map(m => m.department))] : []
  const roles = members.length > 0 ? [...new Set(members.map(m => m.role))] : []

  if (loading) {
    return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
    )
  }

  return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Equipe</h1>
            <p className="text-muted-foreground">
              Gerencie os membros da sua equipe e suas permissões
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => router.push('/team/performance')} 
              className="inline-flex items-center px-4 py-2 border border-input rounded-md shadow-sm text-sm font-medium text-foreground bg-card hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Performance
            </button>
        
            <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
              <DialogTrigger asChild>
                <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Adicionar Membro
                </button>
              </DialogTrigger>
            </Dialog>
          </div>
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

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Buscar membros..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Departamentos</SelectItem>
                  {departments.length > 0 && departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Cargos</SelectItem>
                  {roles.length > 0 && roles.map(role => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

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

        {/* Team Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Membros</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{members.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online Agora</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {members.filter(m => m.status === 'online').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Departamentos</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{departments.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Administradores</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {members.filter(m => m.role === 'admin').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Members Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map((member) => (
            <Card key={member.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={member.avatar} alt={member.name} />
                        <AvatarFallback>
                          {member.name ? member.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background ${getStatusColor(member.status)}`}></div>
                    </div>
                    <div>
                      <CardTitle className="text-lg">{member.name}</CardTitle>
                      <CardDescription>{member.role}</CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!member.accessToken && member.role === 'TEAM' && (
                        <DropdownMenuItem onClick={() => handleGenerateToken(member.id)}>
                          <Shield className="h-4 w-4 mr-2" />
                          Gerar Token
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => openPermissions(member)}>
                        <LockKeyhole className="h-4 w-4 mr-2" />
                        Permissões de Páginas
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditMember(member)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{member.department}</Badge>
                  <Badge variant={member.status === 'online' ? 'default' : 'secondary'}>
                    {getStatusText(member.status)}
                  </Badge>
                </div>
                
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4" />
                    <span>{member.email}</span>
                  </div>
                  {member.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4" />
                      <span>{member.phone}</span>
                    </div>
                  )}
                  {member.location && (
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4" />
                      <span>{member.location}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>Desde {member.joinedAt ? format(parseISO(member.joinedAt), 'dd/MM/yyyy', { locale: ptBR }) : 'Data não disponível'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4" />
                    <span>Ativo {member.lastActive ? format(parseISO(member.lastActive), 'dd/MM/yyyy', { locale: ptBR }) : 'Data não disponível'}</span>
                  </div>
                </div>

                {member.skills && member.skills.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Habilidades:</p>
                    <div className="flex flex-wrap gap-1">
                      {member.skills.slice(0, 3).map((skill, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {member.skills.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{member.skills.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex space-x-2 pt-2">
                
                  <Button size="sm" variant="outline" className="flex-1">
                    <Mail className="h-4 w-4 mr-1" />
                    Email
                  </Button>
                  {member.accessToken && (
                    <Button 
                      size="sm" 
                      variant="default" 
                      className="flex-1"
                      onClick={() => window.open(`https://projects.linksystem.tech/collaborator-portal/${member.accessToken}`, '_blank')}
                    >
                      <Shield className="h-4 w-4 mr-1" />
                      Portal
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredMembers.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum membro encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Não encontramos membros que correspondam aos filtros aplicados.
              </p>
              <Button onClick={() => {
                setSearchTerm('')
                setSelectedDepartment('all')
                setSelectedRole('all')
              }}>
                Limpar Filtros
              </Button>
            </CardContent>
          </Card>
        )}
        
        <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
          <DialogTrigger asChild>
            <div style={{display: 'none'}} />
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Permissões de Páginas</DialogTitle>
              <DialogDescription>
                Selecione quais páginas o usuário pode acessar.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                {ROUTE_REGISTRY.map((route) => (
                  <div key={route.key} className="flex items-center space-x-2">
                    <Checkbox
                      checked={allowedPaths.includes(route.path)}
                      onCheckedChange={() => togglePath(route.path)}
                      id={`perm-${route.key}`}
                    />
                    <Label htmlFor={`perm-${route.key}`} className="cursor-pointer">
                      {route.label}
                    </Label>
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ações Rápidas</CardTitle>
                    <CardDescription>Aplicar configurações pré-definidas</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="default" className="w-full" onClick={allowAll}>
                      Permitir Tudo
                    </Button>
                    <Button variant="outline" className="w-full" onClick={applyRoleDefaults}>
                      Padrões do Cargo
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => setAllowedPaths([])}>
                      Desmarcar Tudo
                    </Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Acesso a Comissões</CardTitle>
                    <CardDescription>Controle de visualização/edição de comissões</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2">
                      <label className="text-sm text-muted-foreground">Permissão</label>
                      <select
                        className="border rounded-md px-3 py-2 bg-background"
                        value={commissionsAccess}
                        onChange={(e) => setCommissionsAccess(e.target.value as "OWN_READ" | "OWN_EDIT" | "ALL_EDIT")}
                      >
                        <option value="OWN_READ">Ver somente a própria</option>
                        <option value="OWN_EDIT">Ver e editar a própria</option>
                        <option value="ALL_EDIT">Ver e editar de todos</option>
                      </select>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsPermissionsOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="default"
                onClick={savePermissions}
                disabled={savingPermissions}
              >
                {savingPermissions ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  )
}

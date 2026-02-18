'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { FileUpload } from '@/components/ui/file-upload'
import toast from 'react-hot-toast'
import { Edit, Users, Save, Plus, Trash2, Shield, TrendingUp , MessageCircleHeart } from 'lucide-react'

type ProfileUser = {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
  skillsMastered?: string[] | null
  skillsReinforcement?: string[] | null
  skillsInterests?: string[] | null
}

type TeamMember = {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<ProfileUser | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [newMastered, setNewMastered] = useState('')
  const [newReinforcement, setNewReinforcement] = useState('')
  const [newInterest, setNewInterest] = useState('')
  const [pendingMastered, setPendingMastered] = useState<string[]>([])
  const [pendingReinforcement, setPendingReinforcement] = useState<string[]>([])
  const [pendingInterests, setPendingInterests] = useState<string[]>([])
  const uploadRef = useRef<{ handleUpload: () => Promise<any[]>, openFileDialog: () => void, clearFiles: () => void }>(null)

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
    fetchData()
  }, [status])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [profileRes, teamRes] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/team?limit=50')
      ])
      if (profileRes.ok) {
        const u = await profileRes.json()
        setUser({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          avatar: u.avatar || undefined,
          skillsMastered: u.skillsMastered || [],
          skillsReinforcement: u.skillsReinforcement || [],
          skillsInterests: u.skillsInterests || [],
        })
      } else {
        toast.error('Não foi possível carregar seu perfil')
      }
      if (teamRes.ok) {
        const t = await teamRes.json()
        setMembers(t.users || [])
      }
    } catch {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const addSkill = (type: 'mastered' | 'reinforcement' | 'interests') => {
    if (!user) return
    const value = type === 'mastered' ? newMastered : type === 'reinforcement' ? newReinforcement : newInterest
    const trimmed = value.trim()
    if (!trimmed) return
    const list = type === 'mastered' ? (user.skillsMastered || []) :
      type === 'reinforcement' ? (user.skillsReinforcement || []) :
      (user.skillsInterests || [])
    const updatedList = [...list, trimmed]
    setUser({
      ...user,
      skillsMastered: type === 'mastered' ? updatedList : user.skillsMastered,
      skillsReinforcement: type === 'reinforcement' ? updatedList : user.skillsReinforcement,
      skillsInterests: type === 'interests' ? updatedList : user.skillsInterests,
    })
    if (type === 'mastered') {
      setPendingMastered(prev => prev.includes(trimmed) ? prev : [...prev, trimmed])
    }
    if (type === 'reinforcement') {
      setPendingReinforcement(prev => prev.includes(trimmed) ? prev : [...prev, trimmed])
    }
    if (type === 'interests') {
      setPendingInterests(prev => prev.includes(trimmed) ? prev : [...prev, trimmed])
    }
    if (type === 'mastered') setNewMastered('')
    if (type === 'reinforcement') setNewReinforcement('')
    if (type === 'interests') setNewInterest('')
  }

  const removeSkill = (type: 'mastered' | 'reinforcement' | 'interests', index: number) => {
    if (!user) return
    const list = type === 'mastered' ? (user.skillsMastered || []) :
      type === 'reinforcement' ? (user.skillsReinforcement || []) :
      (user.skillsInterests || [])
    const updatedList = list.filter((_, i) => i !== index)
    setUser({
      ...user,
      skillsMastered: type === 'mastered' ? updatedList : user.skillsMastered,
      skillsReinforcement: type === 'reinforcement' ? updatedList : user.skillsReinforcement,
      skillsInterests: type === 'interests' ? updatedList : user.skillsInterests,
    })
  }

  const saveProfile = async (userDataOverride?: Partial<ProfileUser> | React.MouseEvent) => {
    // Se for evento, ignorar e usar user atual
    const isEvent = userDataOverride && typeof userDataOverride === 'object' && 'preventDefault' in userDataOverride
    const override = isEvent ? undefined : (userDataOverride as Partial<ProfileUser>)
    
    const dataToUse = override ? { ...user, ...override } : user
    if (!dataToUse) return
    
    try {
      setSaving(true)
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatar: dataToUse.avatar,
          skillsMastered: dataToUse.skillsMastered || [],
          skillsReinforcement: dataToUse.skillsReinforcement || [],
          skillsInterests: dataToUse.skillsInterests || [],
        })
      })
      
      if (res.ok) {
        toast.success('Perfil atualizado')
        // Atualizar o estado local se foi usado override, para garantir sincronia
        if (override && user) {
           setUser({ ...user, ...override } as ProfileUser)
        }
         setPendingMastered([])
         setPendingReinforcement([])
         setPendingInterests([])
      } else {
        toast.error('Falha ao salvar perfil')
      }
    } catch (error) {
      console.error(error)
      toast.error('Erro ao salvar perfil')
    } finally {
      setSaving(false)
    }
  }

  const uploadAvatar = async () => {
    if (!session?.user?.id) return
    try {
      // Garantir que temos um arquivo selecionado antes de tentar upload
      // O handleUpload retorna Promise<FileInfo[]>
      const result = await uploadRef.current?.handleUpload()
      
      if (!result || result.length === 0) {
         // Se não retornou nada, talvez não tenha arquivo selecionado ou deu erro silencioso
         return
      }

      const lastFile = result.find((f: any) => !!f.fileUrl) || result[result.length - 1]
      // Garantir que temos uma URL válida
      const avatarUrl = lastFile?.fileUrl || (lastFile?.filePath ? `/api/files/${lastFile.filePath}` : undefined)
      
      if (avatarUrl && user) {
        // Atualizar estado e salvar no banco IMEDIATAMENTE com os dados novos
        await saveProfile({ avatar: avatarUrl })
        
        // Limpar arquivos após upload com sucesso
        uploadRef.current?.clearFiles()
      } 
    } catch (error) {
      console.error(error)
      toast.error('Erro ao enviar avatar')
    }
  }

  const handleFileChange = async (files: any[]) => {
    // Se houver um novo arquivo selecionado (com propriedade .file), faz o upload automático
    const hasNewFile = files.some(f => f.file)
    if (hasNewFile) {
      await uploadAvatar()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const hasPendingSkills = pendingMastered.length > 0 || pendingReinforcement.length > 0 || pendingInterests.length > 0

  return (
    <div className="mx-auto space-y-8 p-6">
      <div className="flex flex-col md:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Meu Perfil</h1>
          <p className="text-muted-foreground">Gerencie suas informações pessoais e habilidades profissionais.</p>
        </div>
        {hasPendingSkills && (
          <Button onClick={saveProfile} disabled={saving} size="lg" className="w-full md:w-auto">
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column: Avatar & Basic Info */}
        <div className="md:col-span-4 space-y-6">
          <Card className="overflow-hidden border-2">
            <div className="h-32 bg-gradient-to-r from-primary/10 to-primary/30"></div>
            <CardContent className="relative pt-0 pb-8 px-6 text-center">
              <div className="relative -mt-16 mb-4 inline-block">
                <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
                  <AvatarImage src={user?.avatar} alt={user?.name || ''} className="object-cover" />
                  <AvatarFallback className="text-4xl bg-muted">
                    {user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute bottom-0 right-0">
                  <FileUpload 
                    ref={uploadRef} 
                    userId={session?.user?.id} 
                    maxFiles={1} 
                    className="hidden"
                    onFilesChange={handleFileChange}
                  />
                  <Button 
                    size="icon" 
                    variant="secondary" 
                    className="rounded-full shadow-md h-8 w-8 -ml-4"
                    onClick={() => {
                      uploadRef.current?.clearFiles()
                      uploadRef.current?.openFileDialog()
                    }}
                    title="Atualizar foto"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-foreground">{user?.name}</h2>
              <p className="text-sm text-muted-foreground mb-4">{user?.email}</p>
              
              <div className="flex items-center justify-center gap-2 mb-6">
                <Badge variant="secondary" className="px-3 py-1">
                  {user?.role === 'admin' ? 'Administrador' : 'Membro da Equipe'}
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md border">
                <p>Mantenha sua foto atualizada para que a equipe possa te identificar facilmente.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                Minha Equipe
              </CardTitle>
              <CardDescription>Colegas de trabalho</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
                {members.map((m) => (
                  <div 
                    key={m.id} 
                    className="group flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/profile/${m.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border">
                        <AvatarImage src={m.avatar} alt={m.name} />
                        <AvatarFallback>{m.name ? m.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[120px]">{m.role}</p>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Users className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Skills */}
        <div className="md:col-span-8 space-y-6">
          <div className="grid gap-6">
            {/* Mastered Skills */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      Tecnologias que Domino
                    </CardTitle>
                    <CardDescription>Habilidades que você tem proficiência total.</CardDescription>
                  </div>
                  <Badge className="bg-muted/50 text-foreground dark:bg-muted/30 border-border">
                    {user?.skillsMastered?.length || 0} skills
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Ex: React, Node.js, TypeScript..."
                      value={newMastered}
                      onChange={(e) => setNewMastered(e.target.value)}
                      className="pr-10"
                      onKeyDown={(e) => e.key === 'Enter' && addSkill('mastered')}
                    />
                    <Plus className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                  <Button onClick={() => addSkill('mastered')}>Adicionar</Button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[60px] p-4 bg-muted/20 rounded-lg border">
                  {(user?.skillsMastered || []).length === 0 && (
                    <p className="text-sm text-muted-foreground italic w-full text-center py-2">Nenhuma habilidade adicionada ainda.</p>
                  )}
                  {(user?.skillsMastered || []).map((s, i) => (
                    <Badge 
                      key={`${s}-${i}`} 
                      className={`pl-3 pr-1 py-1 text-sm bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 gap-1 transition-all group ${pendingMastered.includes(s) ? 'opacity-60 border-dashed' : ''}`}
                    >
                      {s}
                      <button
                        className="ml-1 rounded-full p-0.5 hover:bg-green-300/50 text-green-700 dark:text-green-400 opacity-60 group-hover:opacity-100 transition-all"
                        onClick={() => removeSkill('mastered', i)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Reinforcement Skills */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <TrendingUp className="h-5 w-5 text-muted-foreground" />
                      Preciso Reforçar
                    </CardTitle>
                    <CardDescription>Tecnologias que você está aprendendo ou melhorando.</CardDescription>
                  </div>
                  <Badge className="bg-muted/50 text-foreground dark:bg-muted/30 border-border">
                    {user?.skillsReinforcement?.length || 0} skills
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Ex: Docker, GraphQL, AWS..."
                      value={newReinforcement}
                      onChange={(e) => setNewReinforcement(e.target.value)}
                      className="pr-10"
                      onKeyDown={(e) => e.key === 'Enter' && addSkill('reinforcement')}
                    />
                    <Plus className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                  <Button onClick={() => addSkill('reinforcement')}>Adicionar</Button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[60px] p-4 bg-muted/20 rounded-lg border">
                  {(user?.skillsReinforcement || []).length === 0 && (
                    <p className="text-sm text-muted-foreground italic w-full text-center py-2">Nenhuma habilidade adicionada ainda.</p>
                  )}
                  {(user?.skillsReinforcement || []).map((s, i) => (
                    <Badge 
                      key={`${s}-${i}`} 
                      variant="outline"
                      className={`pl-3 pr-1 py-1 text-sm bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 gap-1 transition-all group ${pendingReinforcement.includes(s) ? 'opacity-60 border-dashed' : ''}`}
                    >
                      {s}
                      <button
                        className="ml-1 rounded-full p-0.5 hover:bg-amber-300/50 text-amber-700 dark:text-amber-400 opacity-60 group-hover:opacity-100 transition-all"
                        onClick={() => removeSkill('reinforcement', i)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Interest Skills */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      < MessageCircleHeart className="h-5 w-5 text-muted-foreground" />
                      Interesses
                    </CardTitle>
                    <CardDescription>Tecnologias que você quer aprender no futuro.</CardDescription>
                  </div>
                  <Badge className="bg-muted/50 text-foreground dark:bg-muted/30 border-border">
                    {user?.skillsInterests?.length || 0} skills
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Ex: AI, Rust, WebAssembly..."
                      value={newInterest}
                      onChange={(e) => setNewInterest(e.target.value)}
                      className="pr-10"
                      onKeyDown={(e) => e.key === 'Enter' && addSkill('interests')}
                    />
                    <Plus className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                  <Button onClick={() => addSkill('interests')}>Adicionar</Button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[60px] p-4 bg-muted/20 rounded-lg border">
                  {(user?.skillsInterests || []).length === 0 && (
                    <p className="text-sm text-muted-foreground italic w-full text-center py-2">Nenhuma habilidade adicionada ainda.</p>
                  )}
                  {(user?.skillsInterests || []).map((s, i) => (
                    <Badge 
                      key={`${s}-${i}`} 
                      className={`pl-3 pr-1 py-1 text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 gap-1 transition-all group ${pendingInterests.includes(s) ? 'opacity-60 border-dashed' : ''}`}
                    >
                      {s}
                      <button
                        className="ml-1 rounded-full p-0.5 hover:bg-blue-300/50 text-blue-700 dark:text-blue-400 opacity-60 group-hover:opacity-100 transition-all"
                        onClick={() => removeSkill('interests', i)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

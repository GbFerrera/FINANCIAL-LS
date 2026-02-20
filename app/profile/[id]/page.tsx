'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Shield, TrendingUp, Sparkles, User, Mail, Briefcase, ArrowLeft } from 'lucide-react'

type ViewUser = {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
  skillsMastered?: string[] | null
  skillsReinforcement?: string[] | null
  skillsInterests?: string[] | null
}

export default function ProfileDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const userId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : ''
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<ViewUser | null>(null)

  const toArray = (v: unknown): string[] => {
    const splitTokens = (s: string) => s.split(/[,;\n]+/).map(x => x.trim()).filter(Boolean)
    if (Array.isArray(v)) {
      const out: string[] = []
      for (const item of v) {
        if (typeof item === 'string') {
          out.push(...splitTokens(item))
        } else if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>
          const candidate = (obj.items ?? obj.list ?? obj.skills ?? obj.value ?? Object.values(obj)) as unknown
          if (Array.isArray(candidate)) {
            out.push(...candidate.map(String))
          } else {
            out.push(String(item))
          }
        } else if (item != null) {
          out.push(String(item))
        }
      }
      return out
    }
    if (typeof v === 'string') {
      const text = v.trim()
      try {
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed)) return parsed.map(String)
      } catch {}
      return text.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
    }
    if (v && typeof v === 'object') {
      const obj = v as Record<string, unknown>
      const candidate = (obj.items ?? obj.list ?? obj.skills ?? obj.value ?? Object.values(obj)) as unknown
      return Array.isArray(candidate) ? candidate.map(String) : []
    }
    return []
  }

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
    fetchUser()
  }, [status, userId])

  const fetchUser = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/team/${userId}`)
      if (res.ok) {
        const u = await res.json()
        setUser({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          avatar: u.avatar || undefined,
          skillsMastered: toArray(u.skillsMastered),
          skillsReinforcement: toArray(u.skillsReinforcement),
          skillsInterests: toArray(u.skillsInterests),
        })
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="mx-auto space-y-8 p-6">
      <div className="flex flex-col md:flex-row items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()} title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Perfil do Membro</h1>
            <p className="text-muted-foreground">Visualize as informações e habilidades.</p>
          </div>
        </div>
        {session?.user?.id === user?.id ? (
          <Button onClick={() => router.push('/profile')}>Editar meu perfil</Button>
        ) : null}
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
              </div>
              
              <h2 className="text-2xl font-bold text-foreground mb-1">{user?.name}</h2>
              
              <div className="flex items-center justify-center gap-2 mb-6">
                <Badge variant="secondary" className="px-3 py-1">
                  {user?.role === 'admin' ? 'Administrador' : 'Membro da Equipe'}
                </Badge>
              </div>

              <div className="space-y-4 text-left">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div className="overflow-hidden">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium truncate" title={user?.email}>{user?.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Função</p>
                    <p className="text-sm font-medium capitalize">{user?.role}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Skills */}
        <div className="md:col-span-8 space-y-6">
          <div className="grid gap-6">
            {/* Mastered Skills */}
            <Card className="border-l-4 border-l-green-500 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl text-green-700 dark:text-green-400">
                      <Shield className="h-5 w-5" />
                      Tecnologias que Domina
                    </CardTitle>
                    <CardDescription>Habilidades com proficiência total.</CardDescription>
                  </div>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 border-green-200">
                    {user?.skillsMastered?.length || 0} skills
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 min-h-[60px] p-4 bg-muted/20 rounded-lg border border-dashed">
                  {(user?.skillsMastered || []).length === 0 && (
                    <p className="text-sm text-muted-foreground italic w-full text-center py-2">Nenhuma habilidade listada.</p>
                  )}
                  {(user?.skillsMastered || []).map((s, i) => (
                    <Badge 
                      key={`m-${i}`} 
                      className="px-3 py-1 text-sm bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 border-green-200"
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Reinforcement Skills */}
            <Card className="border-l-4 border-l-amber-500 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl text-amber-700 dark:text-amber-400">
                      <TrendingUp className="h-5 w-5" />
                      Precisa Reforçar
                    </CardTitle>
                    <CardDescription>Tecnologias que está aprendendo ou melhorando.</CardDescription>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-200 border-amber-200">
                    {user?.skillsReinforcement?.length || 0} skills
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 min-h-[60px] p-4 bg-muted/20 rounded-lg border border-dashed">
                  {(user?.skillsReinforcement || []).length === 0 && (
                    <p className="text-sm text-muted-foreground italic w-full text-center py-2">Nenhuma habilidade listada.</p>
                  )}
                  {(user?.skillsReinforcement || []).map((s, i) => (
                    <Badge 
                      key={`r-${i}`} 
                      variant="outline"
                      className="px-3 py-1 text-sm bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200"
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Interest Skills */}
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl text-blue-700 dark:text-blue-400">
                      <Sparkles className="h-5 w-5" />
                      Interesses
                    </CardTitle>
                    <CardDescription>Tecnologias que quer aprender no futuro.</CardDescription>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 border-blue-200">
                    {user?.skillsInterests?.length || 0} skills
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 min-h-[60px] p-4 bg-muted/20 rounded-lg border border-dashed">
                  {(user?.skillsInterests || []).length === 0 && (
                    <p className="text-sm text-muted-foreground italic w-full text-center py-2">Nenhuma habilidade listada.</p>
                  )}
                  {Array.from(new Set((user?.skillsInterests || []).filter(s => !String(s).trim().startsWith('/')))).map((s, i) => (
                    <Badge 
                      key={`i-${i}`} 
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 border-blue-200"
                    >
                      {s}
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

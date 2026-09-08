'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ChevronRight,
  FilePen,
  FileText,
  Globe,
  Lock,
  Maximize2,
  Minimize2,
  PenLine,
  Plus,
  Save,
  Search,
  Shapes,
  Trash2,
  User,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PlaneEditor } from '@/components/ui/plane-editor'
import { PLANE_TASK_DESCRIPTION_TEMPLATE } from '@/lib/plane-editor/template'
import ExcalidrawClient, { ExcalidrawClientHandle } from '@/components/ExcalidrawClient'
import { FileUpload } from '@/components/ui/file-upload'
import { cn } from '@/lib/utils'
import { LoadingAnimation } from '@/components/ui/loading-animation'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

function isNoteDiagramSurface(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest('[data-note-diagram-panel]') ||
    target.closest('.excalidraw') ||
    target.closest('.excalidraw-modal') ||
    target.closest('.excalidraw-app') ||
    target.closest('.Island')
  )
}

type ProjectOption = { id: string; name: string }
type TeamMember = { user: { id: string; name: string; email: string; avatar?: string | null } }
type NoteVisibility = 'PRIVATE' | 'PUBLIC'

type Note = {
  id: string
  title: string
  content?: string | null
  diagram?: unknown | null
  visibility?: NoteVisibility
  updatedAt?: string
  project: { id: string; name: string }
  createdBy: { id: string; name: string; email: string }
  access: { user: { id: string; name: string; email: string } }[]
}

type UploadFileInfo = {
  id: string
  originalName: string
  fileName: string
  filePath: string
  fileSize: number
  fileType: string
  uploadedAt: string
  file?: File
}

type ProjectNotesViewProps = {
  initialProjectId?: string | null
  lockedProjectId?: string | null
  variant?: 'management' | 'workspace'
  projectName?: string
  workspaceSlug?: string
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function MemberAvatar({
  name,
  avatar,
  size = 'md',
}: {
  name: string
  avatar?: string | null
  size?: 'sm' | 'md'
}) {
  const dim = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
  const text = size === 'sm' ? 'text-[10px]' : 'text-xs'
  return (
    <Avatar className={dim}>
      <AvatarImage src={avatar || undefined} alt={name} />
      <AvatarFallback className={text}>{getInitials(name) || '?'}</AvatarFallback>
    </Avatar>
  )
}

export function ProjectNotesView({
  initialProjectId,
  lockedProjectId,
  variant = 'management',
  projectName,
}: ProjectNotesViewProps) {
  const isWorkspace = variant === 'workspace'
  const fixedProjectId = lockedProjectId || initialProjectId || null
  const { data: session } = useSession()
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [projectFilter, setProjectFilter] = useState(fixedProjectId || 'all')
  const [visibilityTab, setVisibilityTab] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [searchTerm, setSearchTerm] = useState('')
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Note | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newNote, setNewNote] = useState({
    title: '',
    content: '',
    projectId: '',
    visibility: 'PRIVATE' as NoteVisibility,
    accessUserIds: [] as string[],
  })
  const [team, setTeam] = useState<TeamMember[]>([])
  const [activeTab, setActiveTab] = useState('content')
  const [diagramFullscreen, setDiagramFullscreen] = useState(false)
  const [diagramUnsaved, setDiagramUnsaved] = useState(false)
  const [diagramSaving, setDiagramSaving] = useState(false)
  const [diagramSceneCache, setDiagramSceneCache] = useState<unknown | null>(null)
  const [diagramMounted, setDiagramMounted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [visibilitySearch, setVisibilitySearch] = useState('')
  const excaliRef = useRef<ExcalidrawClientHandle>(null)
  const [newAttachments, setNewAttachments] = useState<UploadFileInfo[]>([])
  const [editAttachments, setEditAttachments] = useState<UploadFileInfo[]>([])
  const fileUploadNewRef = useRef<{ handleUpload: (id?: string) => Promise<UploadFileInfo[]> } | null>(null)
  const fileUploadEditRef = useRef<{ handleUpload: (id?: string) => Promise<UploadFileInfo[]> } | null>(null)

  useEffect(() => {
    if (fixedProjectId) setProjectFilter(fixedProjectId)
  }, [fixedProjectId])

  useEffect(() => {
    if (isWorkspace) return
    fetch('/api/projects/list')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { projects?: { id: string; name: string }[] } | null) => {
        if (data?.projects) {
          setProjects(data.projects.map((p) => ({ id: p.id, name: p.name })))
        }
      })
      .catch(() => {})
  }, [isWorkspace])

  useEffect(() => {
    if (isWorkspace && fixedProjectId && projectName) {
      setProjects([{ id: fixedProjectId, name: projectName }])
    }
  }, [isWorkspace, fixedProjectId, projectName])

  useEffect(() => {
    const pid = editing ? editing.project.id : newNote.projectId
    if (!pid) {
      setTeam([])
      return
    }
    fetch(`/api/projects/${pid}/team`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setTeam(Array.isArray(data) ? data : []))
      .catch(() => setTeam([]))
  }, [editing, newNote.projectId])

  const handleDiagramDialogDismiss = useCallback(
    (event: Event) => {
      if (isNoteDiagramSurface(event.target)) {
        event.preventDefault()
        return
      }
      if (diagramFullscreen) {
        event.preventDefault()
        setDiagramFullscreen(false)
      }
    },
    [diagramFullscreen]
  )

  const handleDiagramEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (diagramFullscreen) {
        event.preventDefault()
        event.stopPropagation()
        setDiagramFullscreen(false)
      }
    },
    [diagramFullscreen]
  )

  useEffect(() => {
    if (!diagramFullscreen) return
    window.addEventListener('keydown', handleDiagramEscape, true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handleDiagramEscape, true)
    }
  }, [diagramFullscreen, handleDiagramEscape])

  useEffect(() => {
    setDiagramSceneCache(null)
    setDiagramFullscreen(false)
    setDiagramUnsaved(false)
  }, [editing?.id, isCreating])

  useEffect(() => {
    if (activeTab !== 'diagrams') {
      const scene = excaliRef.current?.getScene()
      if (scene) setDiagramSceneCache(scene)
      setDiagramMounted(false)
      return
    }
    setDiagramMounted(true)
  }, [activeTab, editing?.id, isCreating])

  useEffect(() => {
    if (!diagramMounted || activeTab !== 'diagrams') return
    const t = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'))
    }, diagramFullscreen ? 120 : 50)
    return () => window.clearTimeout(t)
  }, [diagramMounted, activeTab, diagramFullscreen])

  const diagramInitialData = useMemo(
    () => diagramSceneCache ?? editing?.diagram ?? null,
    [diagramSceneCache, editing?.diagram]
  )

  const cacheDiagramScene = useCallback(() => {
    const scene = excaliRef.current?.getScene()
    if (scene) setDiagramSceneCache(scene)
  }, [])

  const toggleDiagramFullscreen = useCallback(() => {
    cacheDiagramScene()
    setDiagramFullscreen((v) => {
      const next = !v
      if (next) {
        window.setTimeout(() => window.dispatchEvent(new Event('resize')), 150)
      }
      return next
    })
  }, [cacheDiagramScene])

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      const pid = lockedProjectId || (projectFilter !== 'all' ? projectFilter : '')
      if (pid) qs.set('projectId', pid)
      if (searchTerm.trim()) qs.set('q', searchTerm.trim())
      const res = await fetch(`/api/notes?${qs.toString()}`)
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { notes?: Note[] }
      setNotes(data.notes || [])
    } catch {
      toast.error('Erro ao carregar notas')
    } finally {
      setLoading(false)
    }
  }, [projectFilter, searchTerm, lockedProjectId])

  const displayedNotes = useMemo(() => {
    let list = notes
    if (isWorkspace) {
      list = list.filter((n) => (n.visibility ?? 'PRIVATE') === visibilityTab)
    }
    return [...list].sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return sortOrder === 'desc' ? tb - ta : ta - tb
    })
  }, [notes, isWorkspace, visibilityTab, sortOrder])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  useEffect(() => {
    if (!editing?.id) {
      setEditAttachments([])
      return
    }
    fetch(`/api/notes/${editing.id}/attachments`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const mapped = (data?.attachments || []).map(
          (a: { originalName?: string; filename: string; filePath: string; mimeType?: string; size?: number }) => ({
            id: a.filename,
            originalName: a.originalName || a.filename,
            fileName: a.filename,
            filePath: a.filePath,
            fileSize: a.size || 0,
            fileType: a.mimeType || 'application/octet-stream',
            uploadedAt: new Date().toISOString(),
          })
        ) as UploadFileInfo[]
        setEditAttachments(mapped)
      })
      .catch(() => setEditAttachments([]))
  }, [editing?.id])

  useEffect(() => {
    if (isCreating && session?.user?.id && team.some((m) => m.user.id === session.user.id)) {
      setNewNote((p) =>
        p.accessUserIds.includes(session.user!.id)
          ? p
          : { ...p, accessUserIds: [...p.accessUserIds, session.user!.id] }
      )
    }
  }, [team, isCreating, session?.user?.id])

  const canEdit = useMemo(() => {
    if (isCreating) return true
    if (!editing || !session?.user?.id) return false
    return session.user.role === 'ADMIN' || editing.createdBy.id === session.user.id
  }, [editing, isCreating, session])

  const filteredTeam = useMemo(() => {
    const q = visibilitySearch.trim().toLowerCase()
    if (!q) return team
    return team.filter(
      (m) =>
        m.user.name.toLowerCase().includes(q) ||
        m.user.email.toLowerCase().includes(q)
    )
  }, [team, visibilitySearch])

  const hasMemberAccess = (userId: string) => {
    if (editing) return editing.access.some((a) => a.user.id === userId)
    return newNote.accessUserIds.includes(userId)
  }

  const toggleMemberAccess = (member: TeamMember) => {
    const id = member.user.id
    const isCreator = editing ? editing.createdBy.id === id : session?.user?.id === id
    if (isCreator || !canEdit) return

    if (editing) {
      const exists = editing.access.some((a) => a.user.id === id)
      const nextAccess = exists
        ? editing.access.filter((a) => a.user.id !== id)
        : [...editing.access, { user: { id, name: member.user.name, email: member.user.email } }]
      setEditing({ ...editing, access: nextAccess })
      return
    }

    const exists = newNote.accessUserIds.includes(id)
    setNewNote((p) => ({
      ...p,
      accessUserIds: exists ? p.accessUserIds.filter((x) => x !== id) : [...p.accessUserIds, id],
    }))
  }

  const setVisibility = (visibility: NoteVisibility) => {
    if (isCreating) setNewNote((p) => ({ ...p, visibility }))
    else if (editing) setEditing({ ...editing, visibility })
  }

  const startNewNote = () => {
    setEditing(null)
    setIsCreating(true)
    setActiveTab('content')
    const pid =
      lockedProjectId || (projectFilter === 'all' ? projects[0]?.id || '' : projectFilter)
    setNewNote({
      title: '',
      content: '',
      projectId: pid,
      visibility: visibilityTab,
      accessUserIds: session?.user?.id ? [session.user.id] : [],
    })
    setNewAttachments([])
  }

  const cancelEdit = () => {
    setEditing(null)
    setIsCreating(false)
    setNewAttachments([])
    setActiveTab('content')
    setDiagramFullscreen(false)
    setDiagramUnsaved(false)
    setVisibilitySearch('')
  }

  const dialogOpen = isCreating || !!editing

  const selectNote = (note: Note) => {
    setEditing(note)
    setIsCreating(false)
    setActiveTab('content')
  }

  const saveNewNote = async () => {
    if (!newNote.title.trim() || !newNote.projectId) {
      toast.error('Informe título e projeto')
      return false
    }
    let diagram: unknown | undefined
    if (activeTab === 'diagrams' && excaliRef.current) {
      diagram = excaliRef.current.getScene() || undefined
    }
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newNote, diagram }),
    })
    if (!res.ok) {
      toast.error('Erro ao criar nota')
      return false
    }
    const created = (await res.json()) as Note
    if (newAttachments.some((f) => !!f.file)) {
      try {
        await fileUploadNewRef.current?.handleUpload(created.id)
      } catch {
        /* ignore */
      }
    }
    toast.success('Nota criada')
    setDiagramUnsaved(false)
    setDiagramFullscreen(false)
    setActiveTab('content')
    setIsCreating(false)
    setNewNote({ title: '', content: '', projectId: '', visibility: 'PRIVATE', accessUserIds: [] })
    setNewAttachments([])
    await fetchNotes()
    setEditing(created)
    return true
  }

  const saveExisting = async () => {
    if (!editing) return false
    let diagram: unknown | undefined = editing.diagram ?? undefined
    if (activeTab === 'diagrams' && excaliRef.current) {
      diagram = excaliRef.current.getScene() || undefined
    }
    const res = await fetch(`/api/notes/${editing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editing.title,
        content: editing.content ?? '',
        diagram,
        visibility: editing.visibility ?? 'PRIVATE',
        accessUserIds: editing.access.map((a) => a.user.id),
      }),
    })
    if (!res.ok) {
      toast.error('Erro ao salvar nota')
      return false
    }
    const updated = (await res.json()) as Note
    setEditing(updated)
    if (editAttachments.some((f) => !!f.file)) {
      try {
        await fileUploadEditRef.current?.handleUpload(updated.id)
      } catch {
        /* ignore */
      }
    }
    toast.success('Nota salva')
    if (activeTab === 'diagrams') setDiagramUnsaved(false)
    await fetchNotes()
    return true
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isCreating) await saveNewNote()
      else await saveExisting()
    } finally {
      setSaving(false)
    }
  }

  const deleteNote = async (id: string) => {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Erro ao excluir nota')
      return
    }
    toast.success('Nota excluída')
    cancelEdit()
    await fetchNotes()
  }

  const contentValue = isCreating ? newNote.content : editing?.content || ''
  const visibilityValue = isCreating ? newNote.visibility : editing?.visibility || 'PRIVATE'

  const noteDetailBody = dialogOpen ? (
    <>
      <div className="space-y-3 border-b border-border px-5 py-4">
        <div className="flex items-start gap-3 pr-8">
          <div
            className="mt-2.5 h-5 w-5 shrink-0 rounded-full border-2 border-muted-foreground/40"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <Input
              value={isCreating ? newNote.title : editing?.title || ''}
              onChange={(e) => {
                const value = e.target.value
                if (isCreating) setNewNote((p) => ({ ...p, title: value }))
                else if (editing) setEditing({ ...editing, title: value })
              }}
              placeholder="Título da nota"
              disabled={!canEdit}
              className="h-auto border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
            />
            {!isCreating && editing && (
              <p className="mt-1 text-xs text-muted-foreground">
                {editing.project.name} · Criado por {editing.createdBy.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {isCreating ? (
            lockedProjectId ? (
              <div className="space-y-1 sm:w-48">
                <Label className="text-xs text-muted-foreground">Projeto</Label>
                <p className="text-sm font-medium">{projectName || projects[0]?.name}</p>
              </div>
            ) : (
            <div className="space-y-1.5 sm:w-48">
              <Label className="text-xs text-muted-foreground">Projeto</Label>
              <Select
                value={newNote.projectId}
                onValueChange={(v) => setNewNote((p) => ({ ...p, projectId: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )
          ) : (
            <div className="space-y-1 sm:w-48">
              <Label className="text-xs text-muted-foreground">Projeto</Label>
              <p className="text-sm font-medium">{editing?.project.name}</p>
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-2">
            <Label className="text-xs text-muted-foreground">Visibilidade</Label>
            <div className="inline-flex rounded-lg border border-border p-0.5">
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setVisibility('PRIVATE')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  visibilityValue === 'PRIVATE'
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Lock className="h-3.5 w-3.5" />
                Privada
              </button>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setVisibility('PUBLIC')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  visibilityValue === 'PUBLIC'
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Globe className="h-3.5 w-3.5" />
                Pública
              </button>
            </div>

            {visibilityValue === 'PUBLIC' ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                <div className="flex -space-x-2">
                  {team.slice(0, 6).map((m) => (
                    <MemberAvatar key={m.user.id} name={m.user.name} avatar={m.user.avatar} size="sm" />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {team.length > 0
                    ? `Visível para o time do projeto (${team.length})`
                    : 'Visível para quem estiver no projeto'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-border bg-muted/10 p-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={visibilitySearch}
                    onChange={(e) => setVisibilitySearch(e.target.value)}
                    placeholder="Buscar pessoas..."
                    disabled={!canEdit || team.length === 0}
                    className="h-8 pl-8 text-sm"
                  />
                </div>

                {team.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Selecione um projeto com membros no time.</p>
                ) : (
                  <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                    {filteredTeam.map((m) => {
                      const selected = hasMemberAccess(m.user.id)
                      const isCreator = editing
                        ? editing.createdBy.id === m.user.id
                        : session?.user?.id === m.user.id
                      return (
                        <button
                          key={m.user.id}
                          type="button"
                          disabled={isCreator || !canEdit}
                          onClick={() => toggleMemberAccess(m)}
                          title={m.user.name}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-full border px-2 py-1 text-left transition-colors',
                            selected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                              : 'border-border bg-background hover:bg-muted/40',
                            (isCreator || !canEdit) && 'cursor-default opacity-80'
                          )}
                        >
                          <MemberAvatar name={m.user.name} avatar={m.user.avatar} size="sm" />
                          <span className="max-w-[120px] truncate text-xs font-medium">{m.user.name}</span>
                        </button>
                      )
                    })}
                    {filteredTeam.length === 0 && (
                      <p className="text-xs text-muted-foreground">Nenhuma pessoa encontrada.</p>
                    )}
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground">
                  Clique para incluir ou remover quem pode ver esta nota.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border px-5">
          <TabsList className="h-10 bg-transparent p-0">
            <TabsTrigger
              value="content"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              <PenLine className="mr-1.5 h-3.5 w-3.5" />
              Conteúdo
            </TabsTrigger>
            <TabsTrigger
              value="diagrams"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              <Shapes className="mr-1.5 h-3.5 w-3.5" />
              Diagramas
            </TabsTrigger>
            <TabsTrigger
              value="attachments"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Anexos
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <TabsContent value="content" className="mt-0">
            <PlaneEditor
              key={editing?.id ?? 'create-note'}
              value={contentValue}
              onChange={(html) => {
                if (!canEdit) return
                if (isCreating) setNewNote((p) => ({ ...p, content: html }))
                else if (editing) setEditing({ ...editing, content: html })
              }}
              placeholder="Clique para adicionar descrição"
              variant="sheet"
              minHeight={200}
              readOnly={!canEdit}
              defaultTemplate={isCreating ? PLANE_TASK_DESCRIPTION_TEMPLATE : undefined}
            />
          </TabsContent>

          <TabsContent value="diagrams" className="mt-0">
            {(() => {
              if (!diagramMounted) return null

              const diagramPanel = (
                <div
                  data-note-diagram-panel
                  className={cn(
                    'flex min-h-0 flex-col overflow-hidden bg-background',
                    diagramFullscreen
                      ? 'fixed inset-0 z-[9999] h-dvh w-screen'
                      : 'relative h-[min(56vh,520px)] min-h-[320px] rounded-lg border border-border'
                  )}
                >
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">Diagrama</p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={diagramSaving}
                        onClick={async () => {
                          if (!excaliRef.current) return
                          setDiagramSaving(true)
                          try {
                            if (isCreating) {
                              await saveNewNote()
                            } else if (editing) {
                              const scene = excaliRef.current.getScene()
                              const res = await fetch(`/api/notes/${editing.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ diagram: scene }),
                              })
                              if (res.ok) {
                                setEditing(await res.json())
                                setDiagramUnsaved(false)
                                toast.success('Diagrama salvo')
                              }
                            }
                          } finally {
                            setDiagramSaving(false)
                          }
                        }}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Salvar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="bg-background shadow-sm"
                        onClick={toggleDiagramFullscreen}
                        aria-label={diagramFullscreen ? 'Sair da tela cheia' : 'Abrir em tela cheia'}
                        title={diagramFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                      >
                        {diagramFullscreen ? (
                          <>
                            <Minimize2 className="mr-2 h-4 w-4" />
                            Sair
                          </>
                        ) : (
                          <>
                            <Maximize2 className="mr-2 h-4 w-4" />
                            Tela cheia
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="relative min-h-0 flex-1 pointer-events-auto">
                    <ExcalidrawClient
                      key={editing?.id ?? 'new'}
                      ref={excaliRef}
                      initialData={diagramInitialData}
                      onChange={() => setDiagramUnsaved(true)}
                    />
                  </div>
                  {diagramUnsaved && diagramFullscreen ? (
                    <p className="shrink-0 border-t border-border px-3 py-2 text-xs text-amber-600">
                      Alterações no diagrama não salvas
                    </p>
                  ) : null}
                </div>
              )

              if (diagramFullscreen && typeof document !== 'undefined') {
                return (
                  <>
                    <div className="flex h-[min(40vh,320px)] min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/10">
                      <p className="text-sm text-muted-foreground">Diagrama aberto em tela cheia</p>
                    </div>
                    {createPortal(diagramPanel, document.body)}
                  </>
                )
              }

              return (
                <>
                  {diagramPanel}
                  {diagramUnsaved ? (
                    <p className="mt-2 text-xs text-amber-600">Alterações no diagrama não salvas</p>
                  ) : null}
                </>
              )
            })()}
          </TabsContent>

          <TabsContent value="attachments" className="mt-0">
            <div className="max-w-xl">
              {editing ? (
                <FileUpload
                  ref={(instance) => {
                    fileUploadEditRef.current = instance as unknown as {
                      handleUpload: (id?: string) => Promise<UploadFileInfo[]>
                    }
                  }}
                  noteId={editing.id}
                  existingFiles={editAttachments}
                  onFilesChange={(files) => setEditAttachments(files as UploadFileInfo[])}
                  maxFiles={5}
                  disabled={!canEdit}
                />
              ) : (
                <FileUpload
                  ref={(instance) => {
                    fileUploadNewRef.current = instance as unknown as {
                      handleUpload: (id?: string) => Promise<UploadFileInfo[]>
                    }
                  }}
                  existingFiles={newAttachments}
                  onFilesChange={(files) => setNewAttachments(files as UploadFileInfo[])}
                  maxFiles={5}
                  disabled={false}
                />
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-3">
        {editing && canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => {
              if (confirm('Excluir esta nota?')) deleteNote(editing.id)
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : (
          <span />
        )}
        {canEdit && (
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        )}
      </div>
    </>
  ) : null

  return (
    <>
      {isWorkspace ? (
        <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 md:px-8">
            <nav className="flex min-w-0 items-center gap-1.5 text-sm">
              <span className="truncate font-medium text-foreground">{projectName}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <FileText className="h-4 w-4 shrink-0" />
                Anotações
              </span>
            </nav>
            <Button size="sm" onClick={startNewNote}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar página
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 md:px-8">
            <div className="flex gap-0">
              {(['PUBLIC', 'PRIVATE'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setVisibilityTab(tab)}
                  className={cn(
                    'border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                    visibilityTab === tab
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab === 'PUBLIC' ? 'Pública' : 'Privada'}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 py-2">
              <div className="relative w-44 sm:w-52">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
              >
                Data modificada
                <ChevronRight
                  className={cn(
                    'h-3.5 w-3.5 transition-transform',
                    sortOrder === 'asc' && 'rotate-90',
                    sortOrder === 'desc' && '-rotate-90'
                  )}
                />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <LoadingAnimation size="sm" />
              </div>
            ) : displayedNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                <FileText className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-foreground">
                  Nenhuma anotação {visibilityTab === 'PUBLIC' ? 'pública' : 'privada'}
                </p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Crie uma página para documentar requisitos, decisões e contexto deste projeto.
                </p>
                <Button size="sm" className="mt-4" onClick={startNewNote}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar página
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {displayedNotes.map((note) => {
                  const active = editing?.id === note.id && dialogOpen
                  const updated = note.updatedAt ? new Date(note.updatedAt) : new Date()
                  return (
                    <li key={note.id}>
                      <button
                        type="button"
                        onClick={() => selectNote(note)}
                        className={cn(
                          'flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/30 md:px-8',
                          active && 'bg-primary/5'
                        )}
                      >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {note.title}
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px]">
                              {getInitials(note.createdBy.name)}
                            </AvatarFallback>
                          </Avatar>
                          {note.visibility === 'PUBLIC' ? (
                            <Globe className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="hidden text-xs text-muted-foreground sm:inline">
                            {format(updated, 'dd MMM yyyy', { locale: ptBR })}
                          </span>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      ) : (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Notas e documentação</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Anotações técnicas, requisitos e diagramas dos projetos
          </p>
        </div>
        <Button onClick={startNewNote}>
          <Plus className="mr-2 h-4 w-4" />
          Nova nota
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
          <Select
            value={projectFilter}
            onValueChange={setProjectFilter}
            disabled={!!lockedProjectId}
          >
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="Projeto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os projetos</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Documento</th>
                <th className="px-3 py-2.5 font-medium">Projeto</th>
                <th className="px-3 py-2.5 font-medium">Autor</th>
                <th className="px-3 py-2.5 font-medium">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                    <LoadingAnimation size="sm" />
                  </td>
                </tr>
              ) : notes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center">
                    <FilePen className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Nenhuma nota encontrada</p>
                  </td>
                </tr>
              ) : (
                notes.map((note) => {
                  const active = editing?.id === note.id && dialogOpen
                  const updated = note.updatedAt ? new Date(note.updatedAt) : new Date()
                  return (
                    <tr
                      key={note.id}
                      onClick={() => selectNote(note)}
                      className={cn(
                        'cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-muted/30',
                        active && 'bg-primary/5'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{note.title}</p>
                            <div className="mt-0.5 flex items-center gap-2">
                              {note.visibility === 'PUBLIC' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <Globe className="h-3 w-3" /> Pública
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <Lock className="h-3 w-3" /> Privada
                                </span>
                              )}
                              {note.diagram != null && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <Shapes className="h-3 w-3" /> Diagrama
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="secondary" className="max-w-[140px] truncate font-normal">
                          {note.project.name}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px]">
                              {note.createdBy.name?.[0] || <User className="h-3 w-3" />}
                            </AvatarFallback>
                          </Avatar>
                          <span className="max-w-[100px] truncate text-muted-foreground">
                            {note.createdBy.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        <span className="hidden sm:inline">
                          {format(updated, 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                        <span className="sm:hidden">
                          {formatDistanceToNow(updated, { addSuffix: true, locale: ptBR })}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {notes.length > 0 && (
          <div className="border-t border-border px-4 py-3 text-center text-sm text-muted-foreground">
            Clique em uma linha para abrir os detalhes
          </div>
        )}
      </div>
    </div>
      )}

      <Dialog
        open={dialogOpen}
        modal={!diagramFullscreen}
        onOpenChange={(open) => {
          if (!open && diagramFullscreen) {
            setDiagramFullscreen(false)
            return
          }
          if (!open) cancelEdit()
        }}
      >
        <DialogContent
          className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
          showCloseButton={!diagramFullscreen}
          onInteractOutside={handleDiagramDialogDismiss}
          onPointerDownOutside={handleDiagramDialogDismiss}
          onFocusOutside={handleDiagramDialogDismiss}
          onEscapeKeyDown={(event) => {
            if (diagramFullscreen) {
              event.preventDefault()
              setDiagramFullscreen(false)
              return
            }
            if (activeTab === 'diagrams') {
              event.preventDefault()
              setActiveTab('content')
            }
          }}
        >
          <DialogTitle className="sr-only">
            {isCreating ? 'Nova nota' : editing?.title || 'Detalhes da nota'}
          </DialogTitle>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{noteDetailBody}</div>
        </DialogContent>
      </Dialog>
    </>
  )
}

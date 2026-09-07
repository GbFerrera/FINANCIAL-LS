'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  FileText,
  Globe,
  Lock,
  Plus,
  Save,
  Search,
  Trash2,
  User,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { WorkspaceCompactCard, WorkspacePage } from '@/components/workspace/WorkspacePage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PlaneEditor } from '@/components/ui/plane-editor'
import { PLANE_TASK_DESCRIPTION_TEMPLATE } from '@/lib/plane-editor/template'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { PageLoadingGate } from '@/components/ui/loading-animation'

type NoteVisibility = 'PRIVATE' | 'PUBLIC'

type WorkspaceNote = {
  id: string
  title: string
  content?: string | null
  visibility: NoteVisibility
  updatedAt: string
  project: { id: string; name: string }
  createdBy: { id: string; name: string; email: string; image?: string | null }
}

type WorkspaceProject = {
  id: string
  name: string
}

type Props = {
  slug: string
  workspaceName: string
  projects: WorkspaceProject[]
  projectIds: string[]
}

type NotesTab = 'all' | 'public' | 'private'

export function WorkspaceNotesView({ slug, workspaceName, projects, projectIds }: Props) {
  const { data: session } = useSession()
  const [tab, setTab] = useState<NotesTab>('all')
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [notes, setNotes] = useState<WorkspaceNote[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<WorkspaceNote | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({
    title: '',
    content: '',
    projectId: '',
    visibility: 'PRIVATE' as NoteVisibility,
  })

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ tab })
      if (search.trim()) qs.set('q', search.trim())
      if (projectFilter !== 'all' && projectIds.includes(projectFilter)) {
        qs.set('projectId', projectFilter)
      }
      const res = await fetch(`/api/workspaces/${slug}/notes?${qs.toString()}`)
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { notes?: WorkspaceNote[] }
      const scoped = (data.notes || []).filter((note) => projectIds.includes(note.project.id))
      setNotes(scoped)
    } catch {
      toast.error('Erro ao carregar anotações')
    } finally {
      setLoading(false)
    }
  }, [slug, tab, search, projectFilter, projectIds])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const canEdit = useMemo(() => {
    if (!editing || !session?.user?.id) return true
    return session.user.role === 'ADMIN' || editing.createdBy.id === session.user.id
  }, [editing, session])

  const startCreate = () => {
    setEditing(null)
    setIsCreating(true)
    setDraft({
      title: '',
      content: '',
      projectId: projects[0]?.id || '',
      visibility: tab === 'public' ? 'PUBLIC' : 'PRIVATE',
    })
  }

  const cancelEditor = () => {
    setEditing(null)
    setIsCreating(false)
  }

  const saveNote = async () => {
    const title = (isCreating ? draft.title : editing?.title || '').trim()
    const content = isCreating ? draft.content : editing?.content || ''
    const projectId = isCreating ? draft.projectId : editing?.project.id
    const visibility = isCreating ? draft.visibility : editing?.visibility

    if (!title || !projectId) {
      toast.error('Informe título e projeto')
      return
    }

    setSaving(true)
    try {
      if (isCreating) {
        const res = await fetch(`/api/workspaces/${slug}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content, projectId, visibility }),
        })
        if (!res.ok) throw new Error()
        toast.success('Anotação criada')
      } else if (editing) {
        const res = await fetch(`/api/notes/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content, visibility }),
        })
        if (!res.ok) throw new Error()
        toast.success('Anotação salva')
      }
      cancelEditor()
      await fetchNotes()
    } catch {
      toast.error('Erro ao salvar anotação')
    } finally {
      setSaving(false)
    }
  }

  const deleteNote = async (id: string) => {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Erro ao excluir')
      return
    }
    toast.success('Anotação excluída')
    cancelEditor()
    await fetchNotes()
  }

  const showEditor = isCreating || editing

  return (
    <PageLoadingGate loading={loading && notes.length === 0 && !showEditor}>
      <WorkspacePage size="full" className="space-y-4 px-5 py-5 md:px-8 md:py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{workspaceName}</p>
            <h1 className="text-xl font-semibold text-foreground">Anotações</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Somente anotações dos {projects.length}{' '}
              {projects.length === 1 ? 'projeto' : 'projetos'} deste espaço
            </p>
          </div>
          <Button onClick={startCreate} disabled={projects.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Nova anotação
          </Button>
        </div>

        <WorkspaceCompactCard className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setTab('all')}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
                  tab === 'all'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setTab('public')}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
                  tab === 'public'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Globe className="h-3.5 w-3.5" />
                Públicas
              </button>
              <button
                type="button"
                onClick={() => setTab('private')}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
                  tab === 'private'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Lock className="h-3.5 w-3.5" />
                Privadas
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="h-9 w-44 pl-9 md:w-52"
                />
              </div>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="h-9 w-40">
                  <SelectValue placeholder="Projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid min-h-[420px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="border-b border-border lg:border-b-0 lg:border-r">
              {notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <FileText className="mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    {tab === 'all'
                      ? 'Nenhuma anotação nos projetos deste espaço.'
                      : tab === 'public'
                        ? 'Nenhuma anotação pública nos projetos deste espaço.'
                        : 'Você não tem anotações privadas neste espaço.'}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {notes.map((note) => {
                    const active = editing?.id === note.id
                    return (
                      <li key={note.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(note)
                            setIsCreating(false)
                          }}
                          className={cn(
                            'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30',
                            active && 'bg-primary/5'
                          )}
                        >
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{note.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{note.project.name}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={note.createdBy.image || ''} />
                              <AvatarFallback className="text-[10px]">
                                {note.createdBy.name?.[0] || <User className="h-3 w-3" />}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(note.updatedAt), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="flex min-h-[360px] flex-col">
              {!showEditor ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-muted-foreground">
                  <FileText className="mb-3 h-10 w-10 opacity-20" />
                  <p className="text-sm">Selecione uma anotação ou crie uma nova</p>
                </div>
              ) : (
                <div className="flex flex-1 flex-col">
                  <div className="space-y-4 border-b border-border p-4">
                    <Input
                      value={isCreating ? draft.title : editing?.title || ''}
                      onChange={(e) => {
                        const value = e.target.value
                        if (isCreating) setDraft((d) => ({ ...d, title: value }))
                        else if (editing) setEditing({ ...editing, title: value })
                      }}
                      placeholder="Título da anotação"
                      className="border-none px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                      disabled={!canEdit}
                    />

                    <div className="grid gap-3 sm:grid-cols-2">
                      {isCreating ? (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Projeto</Label>
                          <Select
                            value={draft.projectId}
                            onValueChange={(v) => setDraft((d) => ({ ...d, projectId: v }))}
                          >
                            <SelectTrigger>
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
                      ) : (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Projeto</Label>
                          <p className="text-sm font-medium">{editing?.project.name}</p>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Visibilidade</Label>
                        <Select
                          value={isCreating ? draft.visibility : editing?.visibility || 'PRIVATE'}
                          onValueChange={(v) => {
                            const visibility = v as NoteVisibility
                            if (isCreating) setDraft((d) => ({ ...d, visibility }))
                            else if (editing) setEditing({ ...editing, visibility })
                          }}
                          disabled={!canEdit}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PRIVATE">
                              <span className="inline-flex items-center gap-2">
                                <Lock className="h-3.5 w-3.5" />
                                Privada — só você vê
                              </span>
                            </SelectItem>
                            <SelectItem value="PUBLIC">
                              <span className="inline-flex items-center gap-2">
                                <Globe className="h-3.5 w-3.5" />
                                Pública — time do projeto
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={cancelEditor}>
                        Cancelar
                      </Button>
                      {editing && canEdit && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteNote(editing.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </Button>
                      )}
                      {canEdit && (
                        <Button size="sm" onClick={saveNote} disabled={saving}>
                          <Save className="mr-2 h-4 w-4" />
                          {saving ? 'Salvando...' : 'Salvar'}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 pb-4">
                    <PlaneEditor
                      key={editing?.id ?? 'create-note'}
                      value={isCreating ? draft.content : editing?.content || ''}
                      onChange={(html) => {
                        if (!canEdit) return
                        if (isCreating) setDraft((d) => ({ ...d, content: html }))
                        else if (editing) setEditing({ ...editing, content: html })
                      }}
                      placeholder="Clique para adicionar descrição"
                      variant="sheet"
                      minHeight={160}
                      readOnly={!canEdit}
                      defaultTemplate={isCreating ? PLANE_TASK_DESCRIPTION_TEMPLATE : undefined}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </WorkspaceCompactCard>
      </WorkspacePage>
    </PageLoadingGate>
  )
}

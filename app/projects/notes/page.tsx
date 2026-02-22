"use client"

import { Suspense, useEffect, useRef, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, Plus, FilePen, Trash2, Save, Maximize2, Minimize2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import RichTextEditor from "@/components/ui/rich-text-editor"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import ExcalidrawClient, { ExcalidrawClientHandle } from "@/components/ExcalidrawClient"
import { FileUpload } from "@/components/ui/file-upload"
import toast from "react-hot-toast"

type ProjectOption = { id: string; name: string }
type TeamMember = { user: { id: string; name: string; email: string } }

type Note = {
  id: string
  title: string
  content?: string | null
  diagram?: unknown | null
  project: { id: string; name: string }
  createdBy: { id: string; name: string; email: string }
  access: { user: { id: string; name: string; email: string } }[]
}

function ProjectNotesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Note | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newNote, setNewNote] = useState<{ title: string; content: string; projectId: string; accessUserIds: string[] }>({
    title: "",
    content: "",
    projectId: "",
    accessUserIds: [],
  })
  const [team, setTeam] = useState<TeamMember[]>([])
  const [activeTab, setActiveTab] = useState("content")
  const [diagramFullscreen, setDiagramFullscreen] = useState(false)
  const [diagramUnsaved, setDiagramUnsaved] = useState(false)
  const [diagramSaving, setDiagramSaving] = useState(false)
  const excaliRef = useRef<ExcalidrawClientHandle>(null)
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
  const [newAttachments, setNewAttachments] = useState<UploadFileInfo[]>([])
  const [editAttachments, setEditAttachments] = useState<UploadFileInfo[]>([])
  const fileUploadNewRef = useRef<{ handleUpload: (id?: string) => Promise<UploadFileInfo[]> } | null>(null)
  const fileUploadEditRef = useRef<{ handleUpload: (id?: string) => Promise<UploadFileInfo[]> } | null>(null)

  const searchParams = useSearchParams()
  useEffect(() => {
    const pid = searchParams?.get("projectId") || null
    if (pid) {
      setProjectFilter(pid)
    }
  }, [searchParams])

  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/auth/signin")
      return
    }
    fetchProjects()
  }, [session, status, router])

  

  useEffect(() => {
    const pid = editing ? editing.project.id : newNote.projectId
    if (pid) fetchTeam(pid)
    else setTeam([])
  }, [editing, newNote.projectId])

  useEffect(() => {
    if (!diagramFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDiagramFullscreen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [diagramFullscreen])

  const fetchProjects = async () => {
    const res = await fetch("/api/projects/list")
    if (!res.ok) return
    const data = (await res.json()) as { projects?: { id: string; name: string }[] }
    const opts: ProjectOption[] = (data.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
    setProjects(opts)
  }

  const fetchTeam = async (pid: string) => {
    const res = await fetch(`/api/projects/${pid}/team`)
    if (!res.ok) {
      setTeam([])
      return
    }
    const data = await res.json()
    setTeam(data)
  }

  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true)
      const qs = new URLSearchParams()
      if (projectFilter !== "all") qs.set("projectId", projectFilter)
      if (searchTerm) qs.set("q", searchTerm)
      const res = await fetch(`/api/notes?${qs.toString()}`)
      if (!res.ok) throw new Error("Falha ao carregar notas")
      const data = (await res.json()) as { notes?: Note[] }
      setNotes(data.notes || [])
    } catch {
      toast.error("Erro ao carregar notas")
    } finally {
      setLoading(false)
    }
  }, [projectFilter, searchTerm])
  
  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  useEffect(() => {
    if (editing?.id) {
      ;(async () => {
        try {
          const res = await fetch(`/api/notes/${editing.id}/attachments`)
          if (res.ok) {
            const data = await res.json()
            const mapped = (data.attachments || []).map((a: { originalName?: string; filename: string; filePath: string; mimeType?: string; size?: number }) => ({
              id: a.filename,
              originalName: a.originalName || a.filename,
              fileName: a.filename,
              filePath: a.filePath,
              fileSize: a.size || 0,
              fileType: a.mimeType || "application/octet-stream",
              uploadedAt: new Date().toISOString(),
            })) as UploadFileInfo[]
            setEditAttachments(mapped)
          } else {
            setEditAttachments([])
          }
        } catch {
          setEditAttachments([])
        }
      })()
    } else {
      setEditAttachments([])
    }
  }, [editing?.id])
  const startNewNote = () => {
    setEditing(null)
    setIsCreating(true)
    setActiveTab("content")
    setNewNote({ title: "", content: "", projectId: projectFilter === "all" ? "" : projectFilter, accessUserIds: [] })
    setNewAttachments([])
  }

  const cancelEdit = () => {
    setEditing(null)
    setIsCreating(false)
    setNewAttachments([])
  }

  const saveNewNote = async () => {
    if (!newNote.title || !newNote.projectId) {
      toast.error("Informe título e projeto")
      return
    }
    let diagram: unknown | undefined
    if (activeTab === "diagrams" && excaliRef.current) {
      const scene = excaliRef.current.getScene()
      diagram = scene || undefined
    }
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newNote, diagram }),
    })
    if (!res.ok) {
      toast.error("Erro ao criar nota")
      return
    }
    const created = await res.json()
    if (newAttachments.some((f) => !!f.file)) {
      try {
        await fileUploadNewRef.current?.handleUpload(created.id)
      } catch {}
    }
    toast.success("Nota criada")
    setIsCreating(false)
    setNewNote({ title: "", content: "", projectId: "", accessUserIds: [] })
    setNewAttachments([])
    await fetchNotes()
  }

  const saveExisting = async () => {
    if (!editing) return
    let diagram: unknown | undefined = editing.diagram ?? undefined
    if (activeTab === "diagrams" && excaliRef.current) {
      const scene = excaliRef.current.getScene()
      diagram = scene || undefined
    }
    const res = await fetch(`/api/notes/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editing.title,
        content: editing.content ?? "",
        diagram,
        accessUserIds: editing.access.map((a) => a.user.id),
      }),
    })
    if (!res.ok) {
      toast.error("Erro ao salvar nota")
      return
    }
    const updated = await res.json()
    setEditing(updated)
    if (editAttachments.some((f) => !!f.file)) {
      try {
        await fileUploadEditRef.current?.handleUpload(updated.id)
      } catch {}
    }
    toast.success("Nota salva")
    await fetchNotes()
  }

  const deleteNote = async (id: string) => {
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Erro ao excluir nota")
      return
    }
    toast.success("Nota excluída")
    if (editing?.id === id) {
        setEditing(null)
        setIsCreating(false)
    }
    await fetchNotes()
  }

  return (
    <div className="space-y-6">
      {/* Header aligned with Projects page */}
      <div className="flex flex-wrap items-center justify-between gap-3 md:flex-nowrap">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:text-3xl sm:truncate">
            Notas e Documentação
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie anotações técnicas, requisitos e diagramas dos seus projetos
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 md:mt-0 md:ml-4">
          <button
            onClick={startNewNote}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Nova Nota
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4 lg:col-span-3 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={projectFilter} onValueChange={(v) => setProjectFilter(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por projeto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os projetos</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
            {loading ? (
              <div className="text-muted-foreground text-sm text-center py-4">Carregando...</div>
            ) : notes.length === 0 ? (
              <div className="text-muted-foreground text-sm text-center py-8 border rounded-lg border-dashed">
                Nenhuma nota encontrada
              </div>
            ) : (
              notes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { setEditing(n); setIsCreating(false); setActiveTab("content"); }}
                  className={`w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm ${
                    editing?.id === n.id 
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20" 
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="font-medium truncate mb-1">{n.title}</div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate max-w-[120px]">{n.project.name}</span>
                    <span>{new Date().toLocaleDateString()}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="col-span-12 md:col-span-8 lg:col-span-9">
          {!editing && !isCreating ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-muted-foreground border rounded-lg border-dashed bg-muted/10">
              <FilePen className="h-12 w-12 mb-4 opacity-20" />
              <p>Selecione uma nota para visualizar ou crie uma nova</p>
            </div>
          ) : (
            <div className={`bg-card rounded-xl border shadow-sm ${activeTab === "diagrams" ? "h-[100vh]" : "h-full"} flex flex-col`}>
              <div className="p-6 border-b shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 space-y-4">
                    {editing ? (
                      <div className="space-y-1">
                        <Input
                          value={editing.title}
                          onChange={(e) => setEditing((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                          placeholder="Título da nota"
                          className="text-2xl font-bold border-none px-3 py-2 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/50"
                        />
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-medium">
                            {editing.project.name}
                          </span>
                          <span>•</span>
                          <span>Criado por {editing.createdBy.name}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Input
                          value={newNote.title}
                          onChange={(e) => setNewNote((p) => ({ ...p, title: e.target.value }))}
                          placeholder="Título da nota"
                          className="text-2xl font-bold border-none px-3 py-2 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/50"
                        />
                        <div className="max-w-md">
                          <Label className="text-xs uppercase text-muted-foreground font-semibold mb-1.5 block">Projeto</Label>
                          <Select value={newNote.projectId} onValueChange={(v) => setNewNote((p) => ({ ...p, projectId: v }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um projeto" />
                            </SelectTrigger>
                            <SelectContent>
                              {projects.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelEdit}
                        className="h-9"
                    >
                        Cancelar
                    </Button>
                    {editing && (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => editing && deleteNote(editing.id)}
                        className="h-9"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </Button>
                    )}
                    <Button 
                      onClick={editing ? saveExisting : saveNewNote}
                      size="sm"
                      className="h-9 min-w-[100px]"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                  <div className="px-6 border-b bg-muted/5 shrink-0">
                    <TabsList className="bg-transparent border-b-0 h-12 p-0 space-x-6">
                      <TabsTrigger 
                        value="content" 
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-full"
                      >
                        Conteúdo
                      </TabsTrigger>
                      <TabsTrigger 
                        value="diagrams" 
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-full"
                      >
                        Diagramas
                      </TabsTrigger>
                      <TabsTrigger 
                        value="access" 
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-full"
                      >
                        Acesso
                      </TabsTrigger>
                      <TabsTrigger 
                        value="attachments" 
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-full"
                      >
                        Anexos
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="flex-1 overflow-hidden p-6 bg-card">
                    <TabsContent value="content" className="mt-0 h-full">
                      {editing ? (
                        <RichTextEditor
                          value={editing.content || ""}
                          onChange={(html) => setEditing((prev) => (prev ? { ...prev, content: html } : prev))}
                          placeholder="Escreva sua nota aqui..."
                          height={{ min: 0, max: "100vh" }}
                        />
                      ) : (
                        <RichTextEditor
                          value={newNote.content}
                          onChange={(html) => setNewNote((p) => ({ ...p, content: html }))}
                          placeholder="Escreva sua nota aqui..."
                          height={{ min: 0, max: "100%" }}
                        />
                      )}
                    </TabsContent>
                    
                    <TabsContent value="diagrams" className="mt-0 h-full min-h-[500px]">
                      <div className={`${diagramFullscreen ? "fixed inset-0 z-50 bg-background" : "relative h-full"} border rounded-lg overflow-hidden shadow-sm`}>
                        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                          <button
                            onClick={async () => {
                              if (!editing?.id) return
                              if (!excaliRef.current) return
                              try {
                                setDiagramSaving(true)
                                const scene = excaliRef.current.getScene()
                                const res = await fetch(`/api/notes/${editing.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ diagram: scene }),
                                })
                                if (res.ok) {
                                  const updated = await res.json()
                                  setEditing(updated)
                                  setDiagramUnsaved(false)
                                } else {
                                  toast.error("Falha ao salvar diagrama")
                                }
                              } catch {
                                toast.error("Erro ao salvar diagrama")
                              } finally {
                                setDiagramSaving(false)
                              }
                            }}
                            disabled={!editing?.id || diagramSaving}
                            className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium shadow-sm transition-colors ${
                              !editing?.id
                                ? "opacity-60 cursor-not-allowed bg-muted"
                                : diagramSaving
                                  ? "bg-blue-300 text-white border-blue-300 cursor-not-allowed"
                                  : diagramUnsaved
                                    ? "bg-yellow-500 text-black border-yellow-600 hover:bg-yellow-600"
                                    : "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                            }`}
                            title={!editing?.id ? "Salve a nota antes de salvar o diagrama" : (diagramUnsaved ? "Salvar alterações do diagrama" : "Salvar diagrama")}
                          >
                            <Save className="h-4 w-4" />
                            {diagramSaving ? "Salvando..." : diagramUnsaved ? "Salvar alterações" : "Salvar diagrama"}
                          </button>
                          <button
                            onClick={() => setDiagramFullscreen((v) => !v)}
                            className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-muted transition-colors"
                            aria-label={diagramFullscreen ? "Sair de tela cheia" : "Tela cheia"}
                          >
                            {diagramFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            {diagramFullscreen ? "Sair" : "Tela cheia"}
                          </button>
                        </div>
                        <ExcalidrawClient
                          ref={excaliRef}
                          initialData={editing?.diagram || null}
                          onChange={() => setDiagramUnsaved(true)}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="access" className="mt-0 h-full">
                      <div className="max-w-xl">
                        <div className="mb-4">
                          <h3 className="text-lg font-medium">Controle de Acesso</h3>
                          <p className="text-sm text-muted-foreground">
                            Selecione os membros da equipe que podem visualizar e editar esta nota.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {team.map((m) => {
                            const id = m.user.id
                            const name = m.user.name
                            const checked = editing
                              ? editing.access.some((a) => a.user.id === id)
                              : newNote.accessUserIds.includes(id)
                            return (
                              <label key={id} className="flex items-center gap-3 p-3 rounded-lg border border-muted hover:bg-muted/20 transition-colors cursor-pointer">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => {
                                    if (editing) {
                                      const exists = editing.access.some((a) => a.user.id === id)
                                      const nextAccess = exists
                                        ? editing.access.filter((a) => a.user.id !== id)
                                        : [...editing.access, { user: { id, name, email: m.user.email } }]
                                      setEditing({ ...(editing as Note), access: nextAccess })
                                    } else {
                                      const exists = newNote.accessUserIds.includes(id)
                                      const next = exists
                                        ? newNote.accessUserIds.filter((x) => x !== id)
                                        : [...newNote.accessUserIds, id]
                                      setNewNote((p) => ({ ...p, accessUserIds: next }))
                                    }
                                  }}
                                />
                                <span className="text-sm font-medium">{name}</span>
                              </label>
                            )
                          })}
                          {team.length === 0 && (
                            <div className="col-span-2 text-sm text-muted-foreground italic">
                              Nenhum membro encontrado neste projeto.
                            </div>
                          )}
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="attachments" className="mt-0 h-full">
                      <div className="max-w-xl">
                        {editing ? (
                          <FileUpload
                            ref={(instance) => {
                              fileUploadEditRef.current = instance as unknown as { handleUpload: (id?: string) => Promise<UploadFileInfo[]> }
                            }}
                            noteId={editing.id}
                            existingFiles={editAttachments}
                            onFilesChange={(files) => setEditAttachments(files as UploadFileInfo[])}
                            maxFiles={5}
                            disabled={false}
                          />
                        ) : (
                          <FileUpload
                            ref={(instance) => {
                              fileUploadNewRef.current = instance as unknown as { handleUpload: (id?: string) => Promise<UploadFileInfo[]> }
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NotesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <ProjectNotesPage />
    </Suspense>
  )
}

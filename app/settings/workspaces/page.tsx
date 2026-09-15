'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingAnimation, LoadingInline, LoadingScreen, PageLoadingGate } from '@/components/ui/loading-animation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Trash2, ExternalLink, MoreVertical, Edit, GripVertical } from 'lucide-react'
import Link from 'next/link'
import type { WorkspaceDTO } from '@/lib/workspace-utils'
import { ProjectMultiPicker } from '@/components/projects/project-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { CustomStatusesManager } from '@/components/pipeline/CustomStatusesManager'
import { KanbanColumnStatusSelect } from '@/components/pipeline/KanbanColumnStatusSelect'
import {
  DEFAULT_MANAGEMENT_COLUMNS,
  newKanbanColumnId,
  type WorkspaceCustomStatus,
  type WorkspaceKanbanColumn,
} from '@/lib/workspace-settings'

type WorkspaceForm = {
  name: string
  slug: string
  icon: string
  description: string
  kind: 'DEFAULT' | 'MANAGEMENT'
  projectIds: string[]
  showCalendarAboveBoard: boolean
  kanbanColumns: WorkspaceKanbanColumn[]
  customStatuses: WorkspaceCustomStatus[]
}

const emptyForm = (): WorkspaceForm => ({
  name: '',
  slug: '',
  icon: '📁',
  description: '',
  kind: 'DEFAULT',
  projectIds: [],
  showCalendarAboveBoard: true,
  kanbanColumns: DEFAULT_MANAGEMENT_COLUMNS.map((c) => ({ ...c })),
  customStatuses: [],
})

export default function WorkspacesSettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const isAdmin = session?.user?.role === 'ADMIN'
  const [canManage, setCanManage] = useState(false)

  const [workspaces, setWorkspaces] = useState<WorkspaceDTO[]>([])
  const [form, setForm] = useState(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const wsRes = await fetch('/api/workspaces')
      if (wsRes.ok) setWorkspaces(await wsRes.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!session?.user?.id) return

    const loadAccess = async () => {
      const permRes = await fetch(`/api/users/${session.user.id}/permissions`)
      if (!permRes.ok) {
        router.replace('/dashboard')
        return
      }
      const data = await permRes.json()
      const allowed = isAdmin || data.workspaceAccess?.canCreateWorkspaces
      setCanManage(Boolean(allowed))
      if (!allowed) {
        router.replace('/dashboard')
        return
      }
      load()
    }

    void loadAccess()
  }, [session, isAdmin, router])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  const startEdit = (ws: WorkspaceDTO) => {
    setEditingId(ws.id)
    setForm({
      name: ws.name,
      slug: ws.slug,
      icon: ws.icon || '📁',
      description: ws.description || '',
      kind: ws.kind,
      projectIds: ws.projectIds,
      showCalendarAboveBoard: ws.settings?.showCalendarAboveBoard ?? true,
      kanbanColumns: ws.settings?.kanbanColumns?.length
        ? ws.settings.kanbanColumns.map((c) => ({ ...c }))
        : DEFAULT_MANAGEMENT_COLUMNS.map((c) => ({ ...c })),
      customStatuses: ws.settings?.customStatuses?.map((s) => ({ ...s })) ?? [],
    })
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingId(null)
    setForm(emptyForm())
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    setSaving(true)
    try {
      const url = editingId ? `/api/workspaces/${editingId}` : '/api/workspaces'
      const method = editingId ? 'PUT' : 'POST'
      const payload =
        form.kind === 'MANAGEMENT'
          ? {
              name: form.name,
              slug: form.slug,
              icon: form.icon,
              description: form.description,
              kind: form.kind,
              settings: {
                showCalendarAboveBoard: form.showCalendarAboveBoard,
                kanbanColumns: form.kanbanColumns,
                customStatuses: form.customStatuses,
              },
            }
          : {
              name: form.name,
              slug: form.slug,
              icon: form.icon,
              description: form.description,
              kind: form.kind,
              projectIds: form.projectIds,
            }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
      toast.success(editingId ? 'Espaço atualizado' : 'Espaço criado')
      closeDialog()
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Excluir este espaço de trabalho?')) return
    const res = await fetch(`/api/workspaces/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Erro ao excluir')
      return
    }
    toast.success('Espaço excluído')
    if (editingId === id) closeDialog()
    load()
  }

  const suggestInitial = async () => {
    try {
      const res = await fetch('/api/projects/options?limit=5')
      const data = res.ok ? await res.json() : { projects: [] }
      const ids = (data.projects || []).map((p: { id: string }) => p.id)
      setEditingId(null)
      setForm({
        name: 'Link System',
        slug: 'link-system',
        icon: '🔗',
        description: 'Produtos Link System',
        projectIds: ids,
      })
    } catch {
      setEditingId(null)
      setForm({
        name: 'Link System',
        slug: 'link-system',
        icon: '🔗',
        description: 'Produtos Link System',
        projectIds: [],
      })
    }
    setDialogOpen(true)
  }

  if (!isAdmin) return null

  return (
    <PageLoadingGate loading={loading}>
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Espaços de trabalho</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Agrupe projetos em áreas separadas (estilo Plane). Colaboradores navegam por espaço; você gerencia tudo em Gestão.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" asChild>
            <Link href="/workspace">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir espaços
            </Link>
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo espaço
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {workspaces.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum espaço criado ainda.</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Criar primeiro espaço
              </Button>
              <Button variant="secondary" onClick={suggestInitial}>
                Sugerir espaço inicial
              </Button>
            </div>
          </div>
        ) : (
          workspaces.map((ws) => (
            <Card key={ws.id} className="gap-0 py-0">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span>{ws.icon || '📁'}</span>
                    <span className="font-medium truncate">{ws.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    /workspace/{ws.slug}
                    {ws.kind === 'MANAGEMENT'
                      ? ' · Gerenciamento'
                      : ` · ${ws.projects.length} projeto(s)`}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Ações</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/workspace/${ws.slug}`}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => startEdit(ws)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => remove(ws.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar espaço' : 'Novo espaço'}</DialogTitle>
            <DialogDescription>
              {form.kind === 'MANAGEMENT'
                ? 'Espaço dedicado a desempenho do setor, com colunas Kanban personalizáveis e agenda opcional.'
                : editingId
                  ? 'Atualize nome, ícone, URL e projetos vinculados.'
                  : 'Crie um espaço de trabalho e vincule os projetos que farão parte dele.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div>
              <Label>Tipo de espaço</Label>
              <Select
                value={form.kind}
                onValueChange={(value: 'DEFAULT' | 'MANAGEMENT') =>
                  setForm((f) => ({
                    ...f,
                    kind: value,
                    ...(value === 'MANAGEMENT'
                      ? {
                          kanbanColumns:
                            f.kanbanColumns.length > 0
                              ? f.kanbanColumns
                              : DEFAULT_MANAGEMENT_COLUMNS.map((c) => ({ ...c })),
                        }
                      : {}),
                  }))
                }
                disabled={Boolean(editingId)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEFAULT">Padrão (projetos de entrega)</SelectItem>
                  <SelectItem value="MANAGEMENT">Gerenciamento (desempenho do setor)</SelectItem>
                </SelectContent>
              </Select>
              {editingId && (
                <p className="text-xs text-muted-foreground mt-1">O tipo não pode ser alterado após a criação.</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={form.kind === 'MANAGEMENT' ? 'RH · Metas Q3' : 'Link Callendar'}
                />
              </div>
              <div>
                <Label>Ícone (emoji)</Label>
                <Input
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder={form.kind === 'MANAGEMENT' ? '📊' : '📅'}
                />
              </div>
            </div>
            <div>
              <Label>Slug (URL)</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder={form.kind === 'MANAGEMENT' ? 'rh-metas' : 'link-callendar'}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>

            {form.kind === 'DEFAULT' ? (
              <div>
                <Label className="mb-2 block">Projetos neste espaço</Label>
                <ProjectMultiPicker
                  values={form.projectIds}
                  onChange={(projectIds) => setForm((f) => ({ ...f, projectIds }))}
                  placeholder="Busque e adicione projetos ao espaço"
                />
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3 rounded-lg border p-3">
                  <Checkbox
                    id="show-calendar"
                    checked={form.showCalendarAboveBoard}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({ ...f, showCalendarAboveBoard: checked === true }))
                    }
                  />
                  <div className="space-y-1">
                    <Label htmlFor="show-calendar" className="cursor-pointer font-medium">
                      Agenda acima do quadro
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Exibe o calendário de tarefas acima do Kanban na esteira deste espaço.
                    </p>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Label>Colunas Kanban</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          kanbanColumns: [
                            ...f.kanbanColumns,
                            {
                              id: newKanbanColumnId(),
                              title: 'Nova coluna',
                              status: 'TODO',
                            },
                          ],
                        }))
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Coluna
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {form.kanbanColumns.map((col, index) => (
                      <div key={col.id} className="flex items-center gap-2 rounded-lg border p-2">
                        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <Input
                          value={col.title}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              kanbanColumns: f.kanbanColumns.map((c, i) =>
                                i === index ? { ...c, title: e.target.value } : c
                              ),
                            }))
                          }
                          placeholder="Nome da coluna"
                          className="flex-1"
                        />
                        <KanbanColumnStatusSelect
                          value={col.status}
                          onChange={(status) =>
                            setForm((f) => ({
                              ...f,
                              kanbanColumns: f.kanbanColumns.map((c, i) =>
                                i === index ? { ...c, status } : c
                              ),
                            }))
                          }
                          customStatuses={form.customStatuses}
                          onCustomStatusesChange={(customStatuses) =>
                            setForm((f) => ({ ...f, customStatuses }))
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-destructive"
                          disabled={form.kanbanColumns.length <= 1}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              kanbanColumns: f.kanbanColumns.filter((_, i) => i !== index),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Crie colunas e status personalizados. Status customizados ficam salvos neste espaço de gerenciamento.
                  </p>
                </div>

                <CustomStatusesManager
                  statuses={form.customStatuses}
                  onChange={(customStatuses) => setForm((f) => ({ ...f, customStatuses }))}
                  onStatusRemoved={(removedId) =>
                    setForm((f) => ({
                      ...f,
                      kanbanColumns: f.kanbanColumns.map((col) =>
                        col.status === removedId ? { ...col, status: 'TODO' } : col
                      ),
                    }))
                  }
                />
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar espaço'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PageLoadingGate>
  )
}

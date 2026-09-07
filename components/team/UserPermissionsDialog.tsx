'use client'

import { useMemo } from 'react'
import { LayoutGrid, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getDefaultAllowedPaths,
  registryPaths,
  routesByGroup,
} from '@/lib/access-control'
import {
  syncWorkspacePaths,
  isWorkspaceFeatureEnabled,
  getDefaultWorkspaceAccess,
  type WorkspaceAccessConfig,
} from '@/lib/workspace-permissions'
import type { WorkspaceDTO } from '@/lib/workspace-utils'
import { cn } from '@/lib/utils'

type CommissionsAccess = 'OWN_READ' | 'OWN_EDIT' | 'ALL_EDIT'

type UserPermissionsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberName: string
  memberRole: string
  allowedPaths: string[]
  onAllowedPathsChange: (paths: string[]) => void
  workspaceAccess: WorkspaceAccessConfig
  onWorkspaceAccessChange: (access: WorkspaceAccessConfig) => void
  commissionsAccess: CommissionsAccess
  onCommissionsAccessChange: (value: CommissionsAccess) => void
  workspaces: WorkspaceDTO[]
  loadingWorkspaces?: boolean
  saving?: boolean
  onSave: () => void
}

export function UserPermissionsDialog({
  open,
  onOpenChange,
  memberName,
  memberRole,
  allowedPaths,
  onAllowedPathsChange,
  workspaceAccess,
  onWorkspaceAccessChange,
  commissionsAccess,
  onCommissionsAccessChange,
  workspaces,
  loadingWorkspaces = false,
  saving = false,
  onSave,
}: UserPermissionsDialogProps) {
  const groupedRoutes = useMemo(() => routesByGroup(), [])
  const workspaceEnabled = isWorkspaceFeatureEnabled(allowedPaths)

  const selectedWorkspaceIds = useMemo(() => {
    if (workspaceAccess.workspaceIds === null) {
      return new Set(workspaces.map((w) => w.id))
    }
    return new Set(workspaceAccess.workspaceIds)
  }, [workspaceAccess.workspaceIds, workspaces])

  const togglePath = (path: string) => {
    const set = new Set(allowedPaths)
    if (set.has(path)) set.delete(path)
    else set.add(path)
    onAllowedPathsChange(Array.from(set))
  }

  const toggleGroup = (paths: string[], checked: boolean) => {
    const set = new Set(allowedPaths)
    for (const path of paths) {
      if (checked) set.add(path)
      else set.delete(path)
    }
    onAllowedPathsChange(Array.from(set))
  }

  const setWorkspaceEnabled = (enabled: boolean) => {
    onAllowedPathsChange(
      syncWorkspacePaths(allowedPaths, enabled, enabled && workspaceAccess.canCreateWorkspaces)
    )
    if (!enabled) {
      onWorkspaceAccessChange({ workspaceIds: [], canCreateWorkspaces: false })
    } else if (workspaceAccess.workspaceIds?.length === 0) {
      onWorkspaceAccessChange({ ...workspaceAccess, workspaceIds: null })
    }
  }

  const setCanCreateWorkspaces = (canCreate: boolean) => {
    onWorkspaceAccessChange({ ...workspaceAccess, canCreateWorkspaces: canCreate })
    onAllowedPathsChange(syncWorkspacePaths(allowedPaths, workspaceEnabled, canCreate))
  }

  const toggleWorkspace = (workspaceId: string) => {
    const allIds = workspaces.map((w) => w.id)
    const current =
      workspaceAccess.workspaceIds === null ? allIds : [...workspaceAccess.workspaceIds]
    const set = new Set(current)
    if (set.has(workspaceId)) set.delete(workspaceId)
    else set.add(workspaceId)

    const next = Array.from(set)
    onWorkspaceAccessChange({
      ...workspaceAccess,
      workspaceIds: next.length === allIds.length ? null : next,
    })
  }

  const selectAllWorkspaces = () => {
    onWorkspaceAccessChange({ ...workspaceAccess, workspaceIds: null })
  }

  const clearWorkspaces = () => {
    onWorkspaceAccessChange({ ...workspaceAccess, workspaceIds: [] })
  }

  const allowAllPages = () => onAllowedPathsChange(registryPaths())
  const applyRoleDefaults = () => {
    onAllowedPathsChange(getDefaultAllowedPaths(memberRole as any))
    onCommissionsAccessChange(memberRole === 'ADMIN' ? 'ALL_EDIT' : 'OWN_READ')
    onWorkspaceAccessChange(getDefaultWorkspaceAccess(memberRole as any))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-6 sm:max-w-[760px]">
        <DialogHeader className="shrink-0 space-y-1 pb-4">
          <DialogTitle>Permissões — {memberName}</DialogTitle>
          <DialogDescription>
            Defina páginas, espaços de trabalho e comissões que este usuário pode acessar.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="pages" className="flex min-h-0 flex-col gap-3">
          <TabsList className="w-full shrink-0">
            <TabsTrigger value="pages" className="flex-1">
              Páginas
            </TabsTrigger>
            <TabsTrigger value="workspaces" className="flex-1">
              Espaços
            </TabsTrigger>
            <TabsTrigger value="commissions" className="flex-1">
              Comissões
            </TabsTrigger>
          </TabsList>

          <div className="relative h-[min(520px,calc(88vh-12.5rem))] shrink-0 overflow-hidden">
            <TabsContent
              value="pages"
              className="absolute inset-0 mt-0 overflow-y-auto pr-1 focus-visible:outline-none"
            >
            <div className="mb-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={allowAllPages}>
                Permitir tudo
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={applyRoleDefaults}>
                Padrões do cargo
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onAllowedPathsChange([])}
              >
                Desmarcar tudo
              </Button>
            </div>

            <div className="space-y-4">
              {groupedRoutes.map(({ group, routes }) => {
                const paths = routes.map((r) => r.path)
                const selectedCount = paths.filter((p) => allowedPaths.includes(p)).length
                const allSelected = selectedCount === paths.length && paths.length > 0
                const someSelected = selectedCount > 0 && !allSelected

                return (
                  <section
                    key={group.id}
                    className="overflow-hidden rounded-lg border border-border bg-card"
                  >
                    <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`group-${group.id}`}
                          checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                          onCheckedChange={(checked) =>
                            toggleGroup(paths, checked === true)
                          }
                        />
                        <Label htmlFor={`group-${group.id}`} className="cursor-pointer font-medium">
                          {group.label}
                        </Label>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {selectedCount}/{paths.length}
                      </span>
                    </div>
                    <div className="grid gap-1 p-2 sm:grid-cols-2">
                      {routes.map((route) => (
                        <label
                          key={route.key}
                          htmlFor={`perm-${route.key}`}
                          className={cn(
                            'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40',
                            allowedPaths.includes(route.path) && 'bg-muted/20'
                          )}
                        >
                          <Checkbox
                            id={`perm-${route.key}`}
                            checked={allowedPaths.includes(route.path)}
                            onCheckedChange={() => togglePath(route.path)}
                          />
                          <span className="truncate">{route.label}</span>
                        </label>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
            </TabsContent>

            <TabsContent
              value="workspaces"
              className="absolute inset-0 mt-0 overflow-y-auto pr-1 focus-visible:outline-none"
            >
            <div className="space-y-4">
              <section className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Acesso a espaços</p>
                        <p className="text-xs text-muted-foreground">
                          Exibe a aba Espaços na sidebar e permite navegar nos workspaces.
                        </p>
                      </div>
                      <Checkbox
                        checked={workspaceEnabled}
                        onCheckedChange={(checked) => setWorkspaceEnabled(checked === true)}
                      />
                    </div>

                    {workspaceEnabled && (
                      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">Criar e gerenciar espaços</p>
                          <p className="text-xs text-muted-foreground">
                            Permite criar novos espaços e acessar configurações.
                          </p>
                        </div>
                        <Checkbox
                          checked={workspaceAccess.canCreateWorkspaces}
                          onCheckedChange={(checked) =>
                            setCanCreateWorkspaces(checked === true)
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {workspaceEnabled ? (
                <section className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
                    <p className="text-sm font-medium">Espaços permitidos</p>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="ghost" onClick={selectAllWorkspaces}>
                        Todos
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={clearWorkspaces}>
                        Nenhum
                      </Button>
                    </div>
                  </div>

                  {loadingWorkspaces ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      Carregando espaços...
                    </p>
                  ) : workspaces.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      Nenhum espaço cadastrado ainda.
                    </p>
                  ) : (
                    <div className="space-y-1 p-2">
                      {workspaces.map((ws) => (
                        <label
                          key={ws.id}
                          htmlFor={`ws-${ws.id}`}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/40',
                            selectedWorkspaceIds.has(ws.id) && 'bg-muted/20'
                          )}
                        >
                          <Checkbox
                            id={`ws-${ws.id}`}
                            checked={selectedWorkspaceIds.has(ws.id)}
                            onCheckedChange={() => toggleWorkspace(ws.id)}
                          />
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-base">
                            {ws.icon || '📁'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{ws.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              /workspace/{ws.slug} · {ws.projects.length} projeto(s)
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {workspaceEnabled && selectedWorkspaceIds.size === 0 && (
                    <p className="border-t border-border px-3 py-2 text-xs text-amber-600 dark:text-amber-500">
                      Sem espaços selecionados — a aba Espaços ficará oculta na sidebar.
                    </p>
                  )}
                </section>
              ) : (
                <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                  <Shield className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Ative o acesso a espaços para escolher quais workspaces este usuário pode ver.
                  </p>
                </div>
              )}
            </div>
            </TabsContent>

            <TabsContent
              value="commissions"
              className="absolute inset-0 mt-0 overflow-y-auto pr-1 focus-visible:outline-none"
            >
            <section className="rounded-lg border border-border bg-card p-4">
              <p className="mb-1 text-sm font-medium">Acesso a comissões</p>
              <p className="mb-4 text-xs text-muted-foreground">
                Controle o que o usuário pode ver e editar na área financeira de comissões.
              </p>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={commissionsAccess}
                onChange={(e) =>
                  onCommissionsAccessChange(e.target.value as CommissionsAccess)
                }
              >
                <option value="OWN_READ">Ver somente a própria</option>
                <option value="OWN_EDIT">Ver e editar a própria</option>
                <option value="ALL_EDIT">Ver e editar de todos</option>
              </select>
            </section>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="mt-4 shrink-0 border-t border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar permissões'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

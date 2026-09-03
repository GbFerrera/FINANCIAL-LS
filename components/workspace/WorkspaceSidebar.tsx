'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Home,
  Pencil,
  User,
  FileText,
  Briefcase,
  LayoutGrid,
  RotateCcw,
  Layers,
  File,
  Inbox,
  Sparkles,
  SlidersHorizontal,
  PanelLeft,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkspaceDTO } from '@/lib/workspace-utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type WorkspaceSidebarProps = {
  workspace: WorkspaceDTO
  workspaces: WorkspaceDTO[]
  collapsed?: boolean
  onToggleCollapse?: () => void
}

const SIDEBAR_PAD = 'px-3'

function projectSections(slug: string, projectId: string) {
  return [
    { key: 'items', label: 'Itens', href: `/workspace/${slug}/projects/${projectId}/items`, icon: LayoutGrid },
    { key: 'cycles', label: 'Ciclos', href: `/workspace/${slug}/projects/${projectId}/cycles`, icon: RotateCcw },
    { key: 'modules', label: 'Módulos', href: `/projects/${projectId}`, icon: Layers },
    { key: 'views', label: 'Visualizações', href: `/projects/${projectId}/scrum`, icon: Layers },
    { key: 'pages', label: 'Páginas', href: `/projects/notes`, icon: File },
    { key: 'intake', label: 'Intake', href: `/pipeline`, icon: Inbox },
  ]
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex h-8 items-center gap-2 rounded-[6px] px-2 text-[13px] leading-none transition-colors',
        active
          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
          : 'text-muted-foreground hover:bg-black/[0.04] hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-70" />
      <span className="truncate">{label}</span>
    </Link>
  )
}

export function WorkspaceSidebar({ workspace, workspaces, collapsed, onToggleCollapse }: WorkspaceSidebarProps) {
  const pathname = usePathname() || ''
  const router = useRouter()
  const [expandedProjects, setExpandedProjects] = useState<string[]>([])
  const [projectsOpen, setProjectsOpen] = useState(true)

  useEffect(() => {
    const match = pathname.match(/\/workspace\/[^/]+\/projects\/([^/]+)/)
    if (match?.[1]) {
      setExpandedProjects((prev) => (prev.includes(match[1]) ? prev : [...prev, match[1]]))
    }
  }, [pathname])

  const topLinks = useMemo(
    () => [
      { label: 'Página inicial', href: `/workspace/${workspace.slug}`, icon: Home },
      { label: 'Rascunhos', href: `/projects/backlog`, icon: Pencil },
      { label: 'Seu trabalho', href: `/pipeline`, icon: User },
      { label: 'Anotações', href: `/projects/notes`, icon: FileText },
    ],
    [workspace.slug]
  )

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
    )
  }

  if (collapsed) {
    return (
      <div className="flex h-full w-14 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex flex-col items-center gap-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-black/5 text-lg">
            {workspace.icon || '📁'}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {workspaces.map((w) => (
              <DropdownMenuItem key={w.id} onClick={() => router.push(`/workspace/${w.slug}`)}>
                <span className="mr-2">{w.icon || '📁'}</span>
                {w.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => router.push('/settings/workspaces')}>
              <Building2 className="mr-2 h-4 w-4" />
              Gerenciar espaços
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {topLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-[6px]',
              pathname === item.href
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-black/[0.04]'
            )}
          >
            <item.icon className="h-4 w-4 opacity-70" />
          </Link>
        ))}
        </div>
        {onToggleCollapse && (
          <div className={cn('mt-auto shrink-0 border-t border-sidebar-border py-3', SIDEBAR_PAD)}>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-8 w-full items-center justify-center rounded-[6px] border border-border bg-card text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-background"
              aria-label="Expandir menu"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="flex h-full w-[252px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Workspace switcher */}
      <div className={cn('flex h-11 shrink-0 items-center gap-2 border-b border-sidebar-border', SIDEBAR_PAD)}>
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border border-sidebar-border bg-card text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {workspace.icon || '📁'}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex min-w-0 flex-1 items-center gap-1 rounded-[6px] px-1.5 py-1 text-left hover:bg-black/[0.04]">
            <span className="truncate text-[13px] font-medium text-foreground">{workspace.name}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            {workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                onClick={() => router.push(`/workspace/${w.slug}`)}
                className={cn(w.id === workspace.id && 'bg-accent')}
              >
                <span className="mr-2">{w.icon || '📁'}</span>
                <span className="truncate">{w.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => router.push('/settings/workspaces')}>
              <Building2 className="mr-2 h-4 w-4" />
              Gerenciar espaços
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto py-3', SIDEBAR_PAD)}>
        {/* Projects header + Novo item — bloco superior Plane */}
        <div className="mb-3 space-y-2">
          <div className="flex h-7 items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              Projects
            </span>
            <div className="flex items-center gap-0.5 text-muted-foreground">
              <button type="button" className="rounded-[4px] p-1 hover:bg-black/[0.05]" aria-label="Filtros">
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="rounded-[4px] p-1 hover:bg-black/[0.05]" aria-label="Layout">
                <PanelLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <button
            type="button"
            className="flex h-8 w-full items-center gap-2 rounded-[6px] border border-border bg-card px-2.5 text-[13px] text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-border"
            onClick={() => router.push('/projects')}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span>Novo item</span>
          </button>
        </div>

        {/* Nav principal */}
        <nav className="space-y-0.5">
          {topLinks.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={pathname === item.href}
            />
          ))}
        </nav>

        {/* Espaço de trabalho */}
        <div className="mt-5">
          <p className="mb-1.5 px-2 text-[11px] font-medium text-muted-foreground">Espaço de trabalho</p>

          <button
            type="button"
            onClick={() => setProjectsOpen((v) => !v)}
            className="flex h-8 w-full items-center gap-1.5 rounded-[6px] px-2 text-[13px] text-sidebar-foreground hover:bg-black/[0.04]"
          >
            {projectsOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <Briefcase className="h-4 w-4 shrink-0 opacity-70" />
            <span className="font-medium">Projetos</span>
          </button>

          {projectsOpen && (
            <div className="ml-[18px] mt-0.5 space-y-0.5 border-l border-border pl-2">
              {workspace.projects.length === 0 ? (
                <p className="px-2 py-1.5 text-[12px] leading-snug text-muted-foreground">
                  Nenhum projeto neste espaço.
                </p>
              ) : (
                workspace.projects.map(({ project }) => {
                  const open = expandedProjects.includes(project.id)
                  const sections = projectSections(workspace.slug, project.id)
                  return (
                    <div key={project.id} className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => toggleProject(project.id)}
                        className="flex h-7 w-full items-center gap-1 rounded-[6px] px-1.5 text-left text-[13px] text-sidebar-foreground hover:bg-black/[0.04]"
                      >
                        {open ? (
                          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate">{project.name}</span>
                      </button>
                      {open && (
                        <div className="ml-3 space-y-0.5 border-l border-border pl-2">
                          {sections.map((section) => {
                            const Icon = section.icon
                            const active =
                              pathname === section.href || pathname.startsWith(`${section.href}/`)
                            return (
                              <Link
                                key={section.key}
                                href={section.href}
                                className={cn(
                                  'flex h-7 items-center gap-2 rounded-[6px] px-2 text-[12px]',
                                  active
                                    ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                                    : 'text-muted-foreground hover:bg-black/[0.04] hover:text-sidebar-foreground'
                                )}
                              >
                                <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                {section.label}
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          <div className="mt-1">
            <NavItem
              href={`/workspace/${workspace.slug}/cycles`}
              label="Todos os ciclos"
              icon={RotateCcw}
              active={pathname === `/workspace/${workspace.slug}/cycles`}
            />
          </div>
        </div>
      </div>

      {/* Gestão CEO */}
      <div className={cn('shrink-0 border-t border-sidebar-border py-3', SIDEBAR_PAD)}>
        <Link
          href="/dashboard"
          className="flex h-8 items-center justify-center gap-2 rounded-[6px] border border-border bg-card px-3 text-[12px] font-medium text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-background"
        >
          <Building2 className="h-3.5 w-3.5" />
          Gestão CEO
        </Link>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="mt-2 flex h-8 w-full items-center justify-center gap-2 rounded-[6px] border border-border bg-card px-3 text-[12px] font-medium text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-background"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Recolher menu
          </button>
        )}
      </div>
    </aside>
  )
}

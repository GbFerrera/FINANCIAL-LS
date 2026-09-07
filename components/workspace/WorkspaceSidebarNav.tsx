'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  LayoutGrid,
  RotateCcw,
  Layers,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SidebarLottieKey } from '@/lib/sidebar-lottie-icons'
import { NavIcon } from '@/components/layout/SidebarNavIcon'
import type { WorkspaceDTO } from '@/lib/workspace-utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { WorkspaceMark, WorkspaceMarkIcon } from '@/components/workspace/WorkspaceMark'
import { useAllowedPaths } from '@/hooks/use-allowed-paths'
import { canManageWorkspaces } from '@/lib/workspace-permissions'

const SIDEBAR_PAD = 'px-3'

function projectSections(slug: string, projectId: string) {
  return [
    { key: 'items', label: 'Itens', href: `/workspace/${slug}/projects/${projectId}/items`, icon: LayoutGrid },
    { key: 'cycles', label: 'Sprints', href: `/workspace/${slug}/projects/${projectId}/cycles`, icon: RotateCcw },
    { key: 'modules', label: 'Módulos', href: `/workspace/${slug}/projects/${projectId}/modules`, icon: Layers },
    { key: 'notes', label: 'Anotações', href: `/workspace/${slug}/projects/${projectId}/notes`, icon: FileText },
  ]
}

function WorkspaceNavLink({
  href,
  label,
  lottie,
  icon,
  active,
  collapsed,
}: {
  href: string
  label: string
  lottie?: SidebarLottieKey
  icon?: React.ElementType
  active: boolean
  collapsed?: boolean
}) {
  const className = cn(
    'group/nav flex items-center rounded-[6px] transition-colors',
    collapsed ? 'h-10 w-10 justify-center' : 'h-10 gap-2 px-2 text-[13px] leading-none',
    active
      ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
      : 'text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]'
  )

  const content = (
    <>
      <NavIcon lottie={lottie} icon={icon} active={active} size="main" />
      {!collapsed && <span className="truncate">{label}</span>}
    </>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={href} className={className} aria-label={label}>
            <NavIcon lottie={lottie} icon={icon} active={active} size="main" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  )
}

type WorkspaceSidebarNavProps = {
  collapsed?: boolean
}

export function WorkspaceSidebarNav({ collapsed = false }: WorkspaceSidebarNavProps) {
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { workspaceAccess } = useAllowedPaths(session?.user?.id)
  const isAdmin = session?.user?.role === 'ADMIN'
  const canManage = canManageWorkspaces(
    workspaceAccess ?? { workspaceIds: null, canCreateWorkspaces: false },
    isAdmin
  )
  const [workspaces, setWorkspaces] = useState<WorkspaceDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedProjects, setExpandedProjects] = useState<string[]>([])
  const [projectsOpen, setProjectsOpen] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/workspaces')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setWorkspaces(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const slugFromPath = pathname.match(/\/workspace\/([^/]+)/)?.[1]

  const workspace = useMemo(() => {
    if (workspaces.length === 0) return null
    if (slugFromPath) {
      return workspaces.find((w) => w.slug === slugFromPath) ?? workspaces[0]
    }
    return workspaces[0]
  }, [workspaces, slugFromPath])

  useEffect(() => {
    const match = pathname.match(/\/workspace\/[^/]+\/projects\/([^/]+)/)
    if (match?.[1]) {
      setExpandedProjects((prev) => (prev.includes(match[1]) ? prev : [...prev, match[1]]))
      return
    }
    if (
      pathname.startsWith('/projects/notes') ||
      pathname.match(/\/workspace\/[^/]+\/projects\/[^/]+\/notes/)
    ) {
      const fromWorkspace = pathname.match(/\/workspace\/[^/]+\/projects\/([^/]+)\/notes/)?.[1]
      const fromQuery = searchParams.get('projectId')
      const projectId = fromWorkspace || fromQuery
      if (projectId) {
        setExpandedProjects((prev) => (prev.includes(projectId) ? prev : [...prev, projectId]))
      }
    }
  }, [pathname, searchParams])

  const topLinks = useMemo(() => {
    const effectiveSlug = slugFromPath ?? workspace?.slug
    if (!effectiveSlug) return []
    return [
      { label: 'Página inicial', href: `/workspace/${effectiveSlug}`, lottie: 'home' as const },
      { label: 'Rascunhos', href: `/workspace/${effectiveSlug}/drafts`, lottie: 'pen' as const },
      { label: 'Pipeline', href: `/workspace/${effectiveSlug}/pipeline`, lottie: 'pipeline' as const },
    ]
  }, [workspace, slugFromPath])

  const projectsSectionActive =
    projectsOpen ||
    Boolean(pathname.match(/\/workspace\/[^/]+\/projects\//))

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
    )
  }

  if (loading) {
    return (
      <div className={cn('py-4 text-center text-[12px] text-muted-foreground', SIDEBAR_PAD)}>
        {!collapsed && 'Carregando espaços...'}
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className={cn('space-y-2 py-4', SIDEBAR_PAD)}>
        {!collapsed && (
          <>
            <p className="text-[12px] text-muted-foreground">Nenhum espaço criado.</p>
            {canManage && (
              <Link
                href="/settings/workspaces"
                className="flex h-8 items-center justify-center gap-2 rounded-[6px] border border-border bg-card px-3 text-[12px] font-medium text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-background"
              >
                <Building2 className="h-3.5 w-3.5" />
                Criar espaço
              </Link>
            )}
          </>
        )}
      </div>
    )
  }

  if (collapsed) {
    return (
      <div className={cn('flex flex-col items-center gap-2 py-2', SIDEBAR_PAD)}>
        <DropdownMenu>
          <DropdownMenuTrigger className="group/nav flex h-10 w-10 items-center justify-center rounded-md hover:bg-black/[0.04]">
            <NavIcon lottie="workspace" active size="main" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {workspaces.map((w) => (
              <DropdownMenuItem key={w.id} onClick={() => router.push(`/workspace/${w.slug}`)}>
                <WorkspaceMarkIcon className="mr-2" />
                {w.name}
              </DropdownMenuItem>
            ))}
            {canManage && (
              <DropdownMenuItem onClick={() => router.push('/settings/workspaces')}>
                <Building2 className="mr-2 h-4 w-4" />
                Gerenciar espaços
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {topLinks.map((item) => (
          <WorkspaceNavLink
            key={item.href}
            href={item.href}
            label={item.label}
            lottie={item.lottie}
            active={
              item.href.endsWith('/drafts')
                ? pathname.includes('/drafts')
                : item.href.endsWith('/pipeline')
                  ? pathname.includes('/pipeline')
                  : pathname === item.href
            }
            collapsed
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto py-3', SIDEBAR_PAD)}>
      {/* Workspace switcher */}
      <div className="mb-3 flex h-10 items-center gap-2">
        <NavIcon lottie="workspace" active size="main" />
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
                <WorkspaceMarkIcon className="mr-2" />
                <span className="truncate">{w.name}</span>
              </DropdownMenuItem>
            ))}
            {canManage && (
              <DropdownMenuItem onClick={() => router.push('/settings/workspaces')}>
                <Building2 className="mr-2 h-4 w-4" />
                Gerenciar espaços
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mb-3">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
          Projects
        </span>
      </div>

      {/* Nav principal */}
      <nav className="space-y-0.5">
        {topLinks.map((item) => (
          <WorkspaceNavLink
            key={item.href}
            href={item.href}
            label={item.label}
            lottie={item.lottie}
            active={
              item.href.endsWith('/drafts')
                ? pathname.includes('/drafts')
                : item.href.endsWith('/pipeline')
                  ? pathname.includes('/pipeline')
                  : pathname === item.href
            }
          />
        ))}
      </nav>

      {/* Espaço de trabalho — projetos vinculados */}
      <div className="mt-5">
        <p className="mb-1.5 px-2 text-[11px] font-medium text-muted-foreground">Espaço de trabalho</p>

        <button
          type="button"
          onClick={() => setProjectsOpen((v) => !v)}
          className="group/nav flex h-10 w-full items-center gap-1.5 rounded-[6px] px-2 text-[13px] text-sidebar-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
        >
          {projectsOpen ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <NavIcon lottie="projects" active={projectsSectionActive} size="main" />
          <span className="font-medium">Projetos</span>
          <span className="ml-auto text-[11px] text-muted-foreground">{workspace.projects.length}</span>
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
                          const modulesTabActive =
                            section.key === 'modules' &&
                            pathname === `/projects/${project.id}` &&
                            (searchParams.get('tab') === 'modules' || searchParams.get('tab') === 'milestones')
                          const notesActive =
                            section.key === 'notes' &&
                            pathname.includes(`/projects/${project.id}/notes`)
                          const active =
                            pathname === section.href ||
                            pathname.startsWith(`${section.href}/`) ||
                            modulesTabActive ||
                            notesActive
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
      </div>
    </div>
  )
}

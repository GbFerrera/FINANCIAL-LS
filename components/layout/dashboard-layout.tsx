"use client"

import { useState, useEffect, useLayoutEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import NextLink from "next/link"
import {
  BarChart3,
  Building2,
  DollarSign,
  FolderOpen,
  Home,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
  Bell,
  Search,
  ChevronLeft,
  ChevronRight,
  Kanban,
  Target,
  Calendar,
  ChevronDown,
  ChevronUp,
  Activity,
  Link as LinkIcon,
  GitBranch,
  BookUser,
  User,
  ChartNoAxesColumnIncreasing,
  HatGlasses,
  ChartNetwork,
  ChartNoAxesCombined,
  FolderGit2,
  Wallet,
  FilePen,
  Megaphone,
  CreditCard,
  Mail,
  Bot,
  LayoutGrid,
  PanelLeft,
} from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card"
import { ModeToggle } from "@/components/mode-toggle"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { isPathAllowed } from "@/lib/access-control"
import { cn } from "@/lib/utils"

interface DashboardLayoutProps {
  children: React.ReactNode
}

type NavItem = {
  name: string
  href: string
  icon: React.ElementType
  submenu?: { name: string; href: string; icon: React.ElementType }[]
}

const SIDEBAR_PAD = 'px-3'
const SIDEBAR_ICON = 'h-5 w-5'
const SIDEBAR_SUB_ICON = 'h-4 w-4'

function navItemClass(active: boolean, collapsed?: boolean) {
  return cn(
    'flex h-9 w-full items-center rounded-[6px] text-[13px] leading-none transition-colors',
    collapsed ? 'justify-center px-2' : 'gap-2 px-2',
    active
      ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
      : 'text-muted-foreground hover:bg-black/[0.04] hover:text-foreground'
  )
}

function subNavItemClass(active: boolean) {
  return cn(
    'flex h-8 w-full items-center gap-2 rounded-[6px] px-2 text-[12px] transition-colors',
    active
      ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
      : 'text-muted-foreground hover:bg-black/[0.04] hover:text-foreground'
  )
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: ChartNoAxesCombined },
  { 
    name: "Projetos", 
    href: "/projects", 
    icon: FolderOpen,
    submenu: [
      { name: "Todos os Projetos", href: "/projects", icon: FolderGit2 },
      { name: "Agente PM", href: "/agent", icon: Bot },
      { name: "Anotações", href: "/projects/notes", icon: FilePen },
      { name: "Sprints", href: "/projects/sprints", icon: GitBranch },
    ]
  },
  { name: "Pipeline", href: "/pipeline", icon: Kanban },
  { name: "Marketing", href: "/mkt", icon: Megaphone },
  { 
    name: "Clientes", 
    href: "/clients", 
    icon: User,
    submenu: [
      { name: "Gestão", href: "/clients", icon: User },
      { name: "Propostas", href: "/clients/proposals", icon: FilePen },
    ]
  },
  { 
    name: "Financeiro", 
    href: "/financial", 
    icon: Wallet,
    submenu: [
      { name: "Visão", href: "/financial", icon: Wallet },
      { name: "Calendário", href: "/financial/calendar", icon: Calendar },
      { name: "Assinaturas", href: "/subscriptions", icon: CreditCard },
      { name: "Comissões", href: "/financial/commissions", icon: DollarSign },
      { name: "Lembretes", href: "/financial/reminders", icon: Mail },
    ]
  },
  { 
    name: "Equipe", 
    href: "/team", 
    icon: Users,
    submenu: [
      { name: "Membros", href: "/team", icon: Users },
      { name: "Agenda", href: "/team/agenda", icon: Calendar },
      { name: "Performance", href: "/team/performance", icon: ChartNoAxesColumnIncreasing }
    ]
  },
  { name: "Supervisor", href: "/supervisor/dashboard", icon: HatGlasses },
  { name: "Relatórios", href: "/reports", icon: ChartNetwork },
  { name: "Configurações", href: "/settings", icon: Settings,
    submenu: [
      { name: "Geral", href: "/settings", icon: Settings },
      { name: "Espaços de trabalho", href: "/settings/workspaces", icon: LayoutGrid },
    ]
  },
]

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarHidden, setSidebarHidden] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const { data: session, status } = useSession()
  const [allowedPaths, setAllowedPaths] = useState<string[] | null>(null)
  const router = useRouter()
  const pathname = usePathname() || ""
  const isFullBleed =
    pathname === '/agent' ||
    pathname === '/pipeline' ||
    (pathname.startsWith("/projects/") && pathname.includes("/canvas"))
  const isAdmin = session?.user?.role === "ADMIN"

  // Carregar estado da sidebar do localStorage sem flicker
  useLayoutEffect(() => {
    const savedCollapsed = localStorage.getItem('sidebarCollapsed')
    const savedHidden = localStorage.getItem('sidebarHidden')
    if (savedCollapsed !== null) {
      setSidebarCollapsed(JSON.parse(savedCollapsed))
    }
    if (savedHidden !== null) {
      setSidebarHidden(JSON.parse(savedHidden))
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (status === "loading") return
    if (!session) return
    const run = async () => {
      try {
        const res = await fetch(`/api/users/${session.user.id}/permissions`)
        if (res.ok) {
          const data = await res.json()
          setAllowedPaths(data.allowedPaths || [])
        } else {
          setAllowedPaths([])
        }
      } catch {
        setAllowedPaths([])
      }
    }
    run()
  }, [session, status])

  useEffect(() => {
    const handler = () => {
      if (!session) return
      fetch(`/api/users/${session.user.id}/permissions`)
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json()
            setAllowedPaths(data.allowedPaths || [])
          }
        })
        .catch(() => {})
    }
    window.addEventListener('permissionsUpdated', handler)
    return () => {
      window.removeEventListener('permissionsUpdated', handler)
    }
  }, [session])

  // Salvar estado da sidebar no localStorage
  const toggleSidebarCollapsed = () => {
    const newState = !sidebarCollapsed
    setSidebarCollapsed(newState)
    setSidebarHidden(false)
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState))
    localStorage.setItem('sidebarHidden', JSON.stringify(false))
  }

  const toggleSidebarHidden = () => {
    const newState = !sidebarHidden
    setSidebarHidden(newState)
    localStorage.setItem('sidebarHidden', JSON.stringify(newState))
  }

  // Fechar sidebar mobile ao navegar
  const closeMobileSidebar = () => {
    setSidebarOpen(false)
  }

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    router.push("/auth/signin")
  }

  const filteredNavigation = isAdmin
    ? navigation
    : (allowedPaths || []).length > 0
      ? navigation
          .map(item => ({
            ...item,
            submenu: item.submenu?.filter(s => isPathAllowed(s.href, allowedPaths!))
          }))
          .filter(item => {
            const allowTop = isPathAllowed(item.href, allowedPaths!)
            const allowSub = (item.submenu?.length ?? 0) > 0
            return allowTop || allowSub
          })
      : navigation

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-card">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-40 flex md:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex h-full w-[252px] max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground">
          <div className="absolute top-2 right-2">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-black/[0.04]"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <SidebarContent items={filteredNavigation} onNavigate={closeMobileSidebar} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div
        className={cn(
          'hidden shrink-0 overflow-hidden md:flex',
          hydrated ? 'transition-all duration-300' : '',
          sidebarHidden ? 'w-0' : sidebarCollapsed ? 'w-14' : 'w-[252px]'
        )}
      >
        <div
          className={cn(
            'flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
            hydrated ? 'transition-all duration-300' : '',
            sidebarHidden ? 'w-0 opacity-0' : sidebarCollapsed ? 'w-14' : 'w-[252px]'
          )}
        >
          {!sidebarHidden && (
            <SidebarContent
              items={filteredNavigation}
              collapsed={sidebarCollapsed}
              onToggleCollapse={toggleSidebarCollapsed}
            />
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardTopBar
          onMenuClick={() => setSidebarOpen(true)}
          onToggleSidebar={toggleSidebarHidden}
          sidebarHidden={sidebarHidden}
          onSignOut={handleSignOut}
        />

        <main className={`relative flex-1 bg-background ${isFullBleed ? 'overflow-hidden' : 'overflow-y-auto'} focus:outline-none`}>
          <div className={isFullBleed ? 'h-full' : 'py-5 md:py-6'}>
            <div className={isFullBleed ? 'h-full' : 'mx-auto w-full px-5 md:px-8'}>
              {children}
            </div>
          </div>
        </main>
      </div>
      </div>
    </TooltipProvider>
  )
}

function DashboardTopBar({
  onMenuClick,
  onToggleSidebar,
  sidebarHidden,
  onSignOut,
}: {
  onMenuClick?: () => void
  onToggleSidebar?: () => void
  sidebarHidden?: boolean
  onSignOut: () => void
}) {
  const { data: session } = useSession()
  const pathname = usePathname() || ''

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex min-w-0 items-center gap-2">
        {onMenuClick && (
          <button
            type="button"
            className="rounded-md p-2 hover:bg-muted md:hidden"
            onClick={onMenuClick}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {onToggleSidebar && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="hidden rounded-md p-2 text-muted-foreground hover:bg-muted md:inline-flex"
                onClick={onToggleSidebar}
                aria-label={sidebarHidden ? 'Abrir sidebar' : 'Fechar sidebar'}
              >
                <PanelLeft className={cn('h-4 w-4', sidebarHidden && 'opacity-60')} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{sidebarHidden ? 'Abrir sidebar' : 'Fechar sidebar'}</TooltipContent>
          </Tooltip>
        )}
        <span className="truncate text-sm font-medium text-foreground">
          {(pathname || '').startsWith('/workspace') ? 'Espaços' : 'Gestão CEO'}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" className="rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Buscar">
          <Search className="h-4 w-4" />
        </button>
        <NextLink href="/notifications" className="rounded-md p-2 text-muted-foreground hover:bg-muted">
          <Bell className="h-4 w-4" />
        </NextLink>
        <ModeToggle />
        <Avatar className="h-8 w-8">
          <AvatarImage src={session?.user?.image || ''} />
          <AvatarFallback>{session?.user?.name?.[0] || 'U'}</AvatarFallback>
        </Avatar>
        <button type="button" onClick={onSignOut} className="rounded-md p-2 text-muted-foreground hover:bg-muted">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}

function SidebarContent({ items, collapsed = false, onNavigate, onToggleCollapse }: { items: NavItem[]; collapsed?: boolean; onNavigate?: () => void; onToggleCollapse?: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const [currentPath, setCurrentPath] = useState(pathname || '')
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])

  // Atualizar caminho atual e expansão com base no pathname
  useEffect(() => {
    setCurrentPath(pathname || '')
    items.forEach(item => {
      if (item.submenu) {
        const hasActiveSubmenu = item.submenu.some(subItem => 
          (pathname || '').startsWith(subItem.href)
        )
        if (hasActiveSubmenu && !expandedMenus.includes(item.name)) {
          setExpandedMenus(prev => [...prev, item.name])
        }
      }
    })
  }, [pathname, expandedMenus])

  const handleNavigation = (href: string) => {
    router.push(href)
    if (onNavigate) {
      onNavigate()
    }
  }

  const toggleSubmenu = (menuName: string) => {
    if (collapsed) return // Não permitir expansão quando sidebar está colapsada
    
    setExpandedMenus(prev => 
      prev.includes(menuName) 
        ? prev.filter(name => name !== menuName)
        : [...prev, menuName]
    )
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          'flex h-11 shrink-0 items-center border-b border-sidebar-border',
          SIDEBAR_PAD,
          collapsed ? 'justify-center' : 'justify-between gap-2'
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <NextLink href="/dashboard" aria-label="Dashboard" className="flex min-w-0 items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] border border-sidebar-border bg-card text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <LinkIcon className="h-4 w-4 text-foreground" />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-foreground">Link System</span>
                  <span className="block truncate text-[11px] text-muted-foreground">Software House</span>
                </div>
              )}
            </NextLink>
          </TooltipTrigger>
          <TooltipContent side="right">Dashboard</TooltipContent>
        </Tooltip>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden rounded-[4px] p-1 text-muted-foreground hover:bg-black/[0.04] md:inline-flex"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      {!collapsed && (
        <div className={cn('pb-3 pt-3', SIDEBAR_PAD)}>
          <div className="grid grid-cols-2 gap-1 rounded-[6px] border border-sidebar-border bg-card p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <NextLink
              href="/dashboard"
              className={cn(
                'rounded-[4px] px-2 py-1.5 text-center text-[11px] font-medium transition-colors',
                (pathname || '').startsWith('/workspace')
                  ? 'text-muted-foreground hover:bg-black/[0.04]'
                  : 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
              )}
            >
              Gestão CEO
            </NextLink>
            <NextLink
              href="/workspace"
              className={cn(
                'flex items-center justify-center gap-1 rounded-[4px] px-2 py-1.5 text-center text-[11px] font-medium transition-colors',
                (pathname || '').startsWith('/workspace')
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-black/[0.04]'
              )}
            >
              <LayoutGrid className="h-3 w-3" />
              Espaços
            </NextLink>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2">
        <nav className={cn('space-y-0.5', SIDEBAR_PAD)}>
          {items.map((item) => {
            const isActive = currentPath === item.href
            const hasSubmenu = item.submenu && item.submenu.length > 0
            const isExpanded = expandedMenus.includes(item.name)
            const hasActiveSubmenu = hasSubmenu && item.submenu?.some(subItem => 
              currentPath.startsWith(subItem.href)
            )

            return (
              <div key={item.name}>
                {/* Menu principal */}
                {collapsed ? (
                  hasSubmenu ? (
                    <HoverCard openDelay={200} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <button
                          onClick={() => handleNavigation(item.href)}
                          className={navItemClass(isActive || !!hasActiveSubmenu, true)}
                          aria-label={item.name}
                        >
                          <item.icon className={cn(SIDEBAR_ICON, 'shrink-0 opacity-70')} />
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent side="right" align="start" sideOffset={10} className="w-48 border border-border bg-popover p-2 shadow-lg">
                        <div className="mb-1 border-b border-border px-2 pb-2 text-sm font-semibold">
                          {item.name}
                        </div>
                        <div className="space-y-0.5">
                          {item.submenu?.map((subItem) => {
                            const isSubActive =
                              currentPath === subItem.href ||
                              (subItem.href !== '/projects' && currentPath.startsWith(subItem.href))

                            return (
                              <button
                                key={subItem.name}
                                onClick={() => handleNavigation(subItem.href)}
                                className={subNavItemClass(isSubActive)}
                              >
                                <subItem.icon className={cn(SIDEBAR_SUB_ICON, 'shrink-0 opacity-70')} />
                                {subItem.name}
                              </button>
                            )
                          })}
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <NextLink
                          href={item.href}
                          className={navItemClass(isActive, true)}
                          aria-label={item.name}
                        >
                          <item.icon className={cn(SIDEBAR_ICON, 'shrink-0 opacity-70')} />
                        </NextLink>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.name}</TooltipContent>
                    </Tooltip>
                  )
                ) : (
                  <button
                    onClick={() => {
                      if (hasSubmenu && !collapsed) {
                        toggleSubmenu(item.name)
                      } else {
                        handleNavigation(item.href)
                      }
                    }}
                    className={navItemClass(isActive || !!hasActiveSubmenu)}
                  >
                    <item.icon className={cn(SIDEBAR_ICON, 'shrink-0 opacity-70')} />
                    <span className="flex-1 truncate text-left">{item.name}</span>
                    {hasSubmenu && (
                      isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )
                    )}
                  </button>
                )}

                {hasSubmenu && !collapsed && isExpanded && (
                  <div className="ml-[18px] mt-0.5 space-y-0.5 border-l border-border pl-2">
                    {item.submenu?.map((subItem) => {
                      const isSubActive =
                        currentPath === subItem.href ||
                        (subItem.href !== '/projects' && currentPath.startsWith(subItem.href))

                      return (
                        <button
                          key={subItem.name}
                          onClick={() => handleNavigation(subItem.href)}
                          className={subNavItemClass(isSubActive)}
                        >
                          <subItem.icon className={cn(SIDEBAR_SUB_ICON, 'shrink-0 opacity-70')} />
                          {subItem.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>

      {!collapsed && onToggleCollapse && (
        <div className={cn('shrink-0 border-t border-sidebar-border py-3', SIDEBAR_PAD)}>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-8 w-full items-center justify-center gap-2 rounded-[6px] border border-border bg-card px-3 text-[12px] font-medium text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-background"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Recolher menu
          </button>
        </div>
      )}

      {collapsed && onToggleCollapse && (
        <div className={cn('shrink-0 border-t border-sidebar-border py-3', SIDEBAR_PAD)}>
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

"use client"

import { Suspense, useState, useEffect, useLayoutEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import NextLink from "next/link"
import {
  DollarSign,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
  Bell,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  GitBranch,
  User,
  ChartNoAxesColumnIncreasing,
  FolderGit2,
  Wallet,
  FilePen,
  CreditCard,
  Mail,
  LayoutGrid,
  PanelLeft,
  Map,
  Calendar,
} from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card"
import { ModeToggle } from "@/components/mode-toggle"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { disconnectTeamSocket } from '@/lib/team-socket'
import { isPathAllowed, resolveNavHref } from "@/lib/access-control"
import { useAllowedPaths } from "@/hooks/use-allowed-paths"
import { hasWorkspaceFeatureAccess } from "@/lib/workspace-permissions"
import { cn } from "@/lib/utils"
import { WorkspaceSidebarNav } from "@/components/workspace/WorkspaceSidebarNav"
import { PresenceTracker } from "@/components/presence/PresenceTracker"
import { OfficeSessionShell } from "@/components/office/OfficeSessionShell"
import { NavIcon, SidebarNavIcon } from "@/components/layout/SidebarNavIcon"
import type { SidebarLottieKey } from "@/lib/sidebar-lottie-icons"

interface DashboardLayoutProps {
  children: React.ReactNode
}

type SidebarMode = 'gestao' | 'espacos'

type NavItem = {
  name: string
  href: string
  lottie?: SidebarLottieKey
  icon?: React.ElementType
  submenu?: { name: string; href: string; icon: React.ElementType }[]
}

const SIDEBAR_PAD = 'px-3'
const SIDEBAR_SUB_ICON = 'h-4 w-4'

function navItemClass(active: boolean, collapsed?: boolean) {
  return cn(
    'group/nav flex h-10 w-full items-center rounded-[6px] text-[13px] leading-none transition-colors',
    collapsed ? 'justify-center px-2' : 'gap-2 px-2',
    active
      ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
      : 'text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]'
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
  { name: "Dashboard", href: "/dashboard", lottie: "dashboard" },
  { 
    name: "Projetos", 
    href: "/projects", 
    lottie: "projects",
    submenu: [
      { name: "Todos os Projetos", href: "/projects", icon: FolderGit2 },
      { name: "Anotações", href: "/projects/notes", icon: FilePen },
      { name: "Sprints", href: "/projects/sprints", icon: GitBranch },
    ]
  },
  { name: "Pipeline", href: "/pipeline", lottie: "pipeline" },
  {
    name: "Chat",
    href: "/team/chat",
    lottie: "chat",
    submenu: [
      { name: "Grupos", href: "/team/chat", icon: Users },
      { name: "Escritório 2D", href: "/team/office", icon: Map },
    ],
  },
  { name: "Marketing", href: "/mkt", lottie: "marketing" },
  { 
    name: "Clientes", 
    href: "/clients", 
    lottie: "clients",
    submenu: [
      { name: "Gestão", href: "/clients", icon: User },
      { name: "Propostas", href: "/clients/proposals", icon: FilePen },
    ]
  },
  { 
    name: "Financeiro", 
    href: "/financial", 
    lottie: "financial",
    submenu: [
      { name: "Fluxo de caixa", href: "/financial", icon: Wallet },
      { name: "Cobranças", href: "/financial/calendar", icon: Calendar },
      { name: "Assinaturas", href: "/subscriptions", icon: CreditCard },
      { name: "Comissões", href: "/financial/commissions", icon: DollarSign },
      { name: "Lembretes", href: "/financial/reminders", icon: Mail },
    ]
  },
  { 
    name: "Equipe", 
    href: "/team", 
    lottie: "team",
    submenu: [
      { name: "Membros", href: "/team", icon: Users },
      { name: "Agenda", href: "/team/agenda", icon: Calendar },
      { name: "Performance", href: "/team/performance", icon: ChartNoAxesColumnIncreasing }
    ]
  },
  { name: "Supervisor", href: "/supervisor/dashboard", lottie: "supervisor" },
  { name: "Relatórios", href: "/reports", lottie: "reports" },
  { name: "Configurações", href: "/settings", lottie: "settings",
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
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('gestao')
  const [hydrated, setHydrated] = useState(false)
  const { data: session, status } = useSession()
  const { allowedPaths, workspaceAccess } = useAllowedPaths(session?.user?.id)
  const router = useRouter()
  const pathname = usePathname() || ""
  const isFullBleed =
    pathname === '/agent' ||
    pathname === '/pipeline' ||
    /^\/workspace\/[^/]+\/pipeline\/?$/.test(pathname) ||
    pathname === '/team/chat' ||
    pathname.startsWith('/team/call/') ||
    pathname === '/team/office' ||
    (pathname.startsWith("/projects/") && pathname.includes("/canvas"))
  const isAdmin = session?.user?.role === "ADMIN"

  const showEspacosTab =
    isAdmin ||
    (hasWorkspaceFeatureAccess(allowedPaths, false) &&
      Boolean(
        workspaceAccess?.canCreateWorkspaces ||
          workspaceAccess?.workspaceIds === null ||
          (workspaceAccess?.workspaceIds?.length ?? 0) > 0
      ))

  // Carregar estado da sidebar do localStorage sem flicker
  useLayoutEffect(() => {
    const savedCollapsed = localStorage.getItem('sidebarCollapsed')
    const savedHidden = localStorage.getItem('sidebarHidden')
    const savedMode = localStorage.getItem('sidebarMode')
    if (savedCollapsed !== null) {
      setSidebarCollapsed(JSON.parse(savedCollapsed))
    }
    if (savedHidden !== null) {
      setSidebarHidden(JSON.parse(savedHidden))
    }
    if (savedMode === 'gestao' || savedMode === 'espacos') {
      setSidebarMode(savedMode)
    }
    setHydrated(true)
  }, [])

  // Rotas /workspace/* sempre exibem modo Espaços na sidebar
  useEffect(() => {
    if (pathname.startsWith('/workspace') && showEspacosTab) {
      setSidebarMode('espacos')
      localStorage.setItem('sidebarMode', 'espacos')
    }
  }, [pathname, showEspacosTab])

  useEffect(() => {
    if (!showEspacosTab && sidebarMode === 'espacos') {
      setSidebarMode('gestao')
      localStorage.setItem('sidebarMode', 'gestao')
    }
  }, [showEspacosTab, sidebarMode])

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

  const handleSidebarModeChange = (mode: SidebarMode) => {
    setSidebarMode(mode)
    localStorage.setItem('sidebarMode', mode)
    if (mode === 'espacos') {
      router.push('/workspace')
    } else {
      router.push('/dashboard')
    }
    closeMobileSidebar()
  }

  const handleSignOut = async () => {
    disconnectTeamSocket()
    await signOut({ redirect: false })
    router.push("/auth/signin")
  }

  const filteredNavigation = (isAdmin
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
  ).map(item => ({
    ...item,
    href: resolveNavHref(item, allowedPaths, isAdmin),
  }))

  return (
    <TooltipProvider>
      <PresenceTracker />
      <OfficeSessionShell />
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
          <SidebarContent
            items={filteredNavigation}
            onNavigate={closeMobileSidebar}
            sidebarMode={sidebarMode}
            onSidebarModeChange={handleSidebarModeChange}
            showEspacosTab={showEspacosTab}
          />
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
              sidebarMode={sidebarMode}
              onSidebarModeChange={handleSidebarModeChange}
              showEspacosTab={showEspacosTab}
            />
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardTopBar
          onMenuClick={() => setSidebarOpen(true)}
          onToggleSidebar={toggleSidebarHidden}
          sidebarHidden={sidebarHidden}
          onSignOut={handleSignOut}
          sidebarMode={sidebarMode}
        />

        <main
          className={`relative min-h-0 flex-1 bg-background ${isFullBleed ? 'overflow-hidden' : 'overflow-y-auto'} focus:outline-none`}
        >
          <div className={isFullBleed ? 'flex h-full min-h-0 flex-col' : 'py-5 md:py-6'}>
            <div className={isFullBleed ? 'flex min-h-0 flex-1 flex-col' : 'mx-auto w-full px-5 md:px-8'}>
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
  sidebarMode,
}: {
  onMenuClick?: () => void
  onToggleSidebar?: () => void
  sidebarHidden?: boolean
  onSignOut: () => void
  sidebarMode: SidebarMode
}) {
  const { data: session } = useSession()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      setAvatarUrl(null)
      return
    }

    let cancelled = false
    fetch('/api/profile')
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.avatar) {
          setAvatarUrl(data.avatar as string)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  const profileImage = avatarUrl || session?.user?.image || null
  const profileInitial = session?.user?.name?.[0]?.toUpperCase() || 'U'

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
          {sidebarMode === 'espacos' ? 'Espaços' : 'Gestão'}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <NextLink href="/notifications" className="rounded-md p-2 text-muted-foreground hover:bg-muted">
          <Bell className="h-4 w-4" />
        </NextLink>
        <ModeToggle />
        <Tooltip>
          <TooltipTrigger asChild>
            <NextLink href="/profile" className="rounded-md p-1 hover:bg-muted" aria-label="Perfil">
              <Avatar className="h-8 w-8 border border-border/80">
                {profileImage ? (
                  <AvatarImage src={profileImage} alt={session?.user?.name || 'Perfil'} />
                ) : null}
                <AvatarFallback className="bg-muted text-xs font-medium text-foreground">
                  {profileInitial}
                </AvatarFallback>
              </Avatar>
            </NextLink>
          </TooltipTrigger>
          <TooltipContent>Perfil</TooltipContent>
        </Tooltip>
        <button type="button" onClick={onSignOut} className="rounded-md p-2 text-muted-foreground hover:bg-muted">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}

function SidebarContent({
  items,
  collapsed = false,
  onNavigate,
  onToggleCollapse,
  sidebarMode,
  onSidebarModeChange,
  showEspacosTab = true,
}: {
  items: NavItem[]
  collapsed?: boolean
  onNavigate?: () => void
  onToggleCollapse?: () => void
  sidebarMode: SidebarMode
  onSidebarModeChange: (mode: SidebarMode) => void
  showEspacosTab?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [currentPath, setCurrentPath] = useState(pathname || '')
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])

  // Atualizar caminho atual e expansão com base no pathname
  useEffect(() => {
    setCurrentPath(pathname || '')
    items.forEach(item => {
      const chatSectionActive =
        item.href === '/team/chat' &&
        ((pathname || '').startsWith('/team/chat') ||
          (pathname || '').startsWith('/team/office') ||
          (pathname || '').startsWith('/team/call'))

      if (item.submenu) {
        const hasActiveSubmenu = item.submenu.some(subItem => 
          (pathname || '').startsWith(subItem.href)
        )
        if ((hasActiveSubmenu || chatSectionActive) && !expandedMenus.includes(item.name)) {
          setExpandedMenus(prev => [...prev, item.name])
        }
      } else if (chatSectionActive && !expandedMenus.includes(item.name)) {
        setExpandedMenus(prev => [...prev, item.name])
      }
    })
  }, [pathname, expandedMenus, items])

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
          collapsed ? 'justify-center' : 'justify-start'
        )}
      >
        {onToggleCollapse ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleCollapse}
                className={cn(
                  'flex min-w-0 items-center rounded-[4px] transition-colors hover:bg-black/[0.04]',
                  collapsed ? 'justify-center p-1' : 'gap-2 p-0.5'
                )}
                aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] border border-sidebar-border bg-card text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <LinkIcon className="h-4 w-4 text-foreground" />
                </div>
                {!collapsed && (
                  <div className="min-w-0 text-left">
                    <span className="block truncate text-[13px] font-semibold text-foreground">Link System</span>
                    <span className="block truncate text-[11px] text-muted-foreground">Software House</span>
                  </div>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? 'Expandir menu' : 'Recolher menu'}
            </TooltipContent>
          </Tooltip>
        ) : (
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
        )}
      </div>

      {!collapsed && showEspacosTab && (
        <div className={cn('pb-3 pt-3', SIDEBAR_PAD)}>
          <div className="grid grid-cols-2 gap-1 rounded-[6px] border border-sidebar-border bg-card p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <button
              type="button"
              onClick={() => onSidebarModeChange('gestao')}
              className={cn(
                'flex items-center justify-center gap-1 rounded-[4px] px-2 py-1.5 text-center text-[11px] font-medium transition-colors',
                sidebarMode === 'gestao'
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-black/[0.04]'
              )}
            >
              <SidebarNavIcon
                lottie="dashboardG"
                active={sidebarMode === 'gestao'}
                invertWhenActive
                size={16}
              />
              Gestão
            </button>
            <button
              type="button"
              onClick={() => onSidebarModeChange('espacos')}
              className={cn(
                'flex items-center justify-center gap-1 rounded-[4px] px-2 py-1.5 text-center text-[11px] font-medium transition-colors',
                sidebarMode === 'espacos'
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-black/[0.04]'
              )}
            >
              <SidebarNavIcon
                lottie="spaces"
                active={sidebarMode === 'espacos'}
                invertWhenActive
                size={16}
              />
              Espaços
            </button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2">
        {sidebarMode === 'espacos' && showEspacosTab ? (
          <Suspense fallback={null}>
            <WorkspaceSidebarNav collapsed={collapsed} />
          </Suspense>
        ) : (
        <nav className={cn('space-y-0.5', SIDEBAR_PAD)}>
          {items.map((item) => {
            const isChatNav = item.href === '/team/chat'
            const isActive =
              currentPath === item.href ||
              (isChatNav &&
                (currentPath.startsWith('/team/office') ||
                  currentPath.startsWith('/team/call')))
            const hasSubmenu = item.submenu && item.submenu.length > 0
            const isExpanded = expandedMenus.includes(item.name)
            const hasActiveSubmenu =
              hasSubmenu &&
              (item.submenu?.some((subItem) => currentPath.startsWith(subItem.href)) ||
                (isChatNav &&
                  (currentPath.startsWith('/team/chat') ||
                    currentPath.startsWith('/team/office') ||
                    currentPath.startsWith('/team/call'))))

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
                          <NavIcon
                            lottie={item.lottie}
                            icon={item.icon}
                            active={isActive || !!hasActiveSubmenu}
                          />
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
                          <NavIcon
                            lottie={item.lottie}
                            icon={item.icon}
                            active={isActive || !!hasActiveSubmenu}
                          />
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
                    <NavIcon
                      lottie={item.lottie}
                      icon={item.icon}
                      active={isActive || !!hasActiveSubmenu}
                    />
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
        )}
      </div>
    </div>
  )
}

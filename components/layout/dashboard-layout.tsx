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
  FilePen
} from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { ModeToggle } from "@/components/mode-toggle"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

interface DashboardLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: ChartNoAxesCombined },
  { 
    name: "Projetos", 
    href: "/projects", 
    icon: FolderOpen,
    submenu: [
      { name: "Todos os Projetos", href: "/projects", icon: FolderGit2 },
      { name: "Anotações", href: "/projects/notes", icon: FilePen },
      { name: "Sprints", href: "/projects/sprints", icon: GitBranch },
    ]
  },
  { name: "Clientes", href: "/clients", icon: User },
  { name: "Financeiro", href: "/financial", icon: Wallet },
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
  { name: "Configurações", href: "/settings", icon: Settings },
]

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname() || ""
  const isFullBleed = pathname.startsWith("/projects/") && pathname.includes("/canvas")

  // Carregar estado da sidebar do localStorage sem flicker
  useLayoutEffect(() => {
    const savedCollapsed = localStorage.getItem('sidebarCollapsed')
    if (savedCollapsed !== null) {
      setSidebarCollapsed(JSON.parse(savedCollapsed))
    }
    setHydrated(true)
  }, [])

  // Salvar estado da sidebar no localStorage
  const toggleSidebarCollapsed = () => {
    const newState = !sidebarCollapsed
    setSidebarCollapsed(newState)
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState))
  }

  // Fechar sidebar mobile ao navegar
  const closeMobileSidebar = () => {
    setSidebarOpen(false)
  }

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    router.push("/auth/signin")
  }

  return (
    <TooltipProvider>
      <div className="h-screen flex overflow-hidden bg-background">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-sidebar text-sidebar-foreground">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <SidebarContent onNavigate={closeMobileSidebar} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={`hidden md:flex md:flex-shrink-0 ${hydrated ? 'transition-all duration-300' : ''} ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      }`}>
        <div className={`flex flex-col ${hydrated ? 'transition-all duration-300' : ''} ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        } bg-sidebar text-sidebar-foreground border-r border-sidebar-border`}>
          <SidebarContent collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebarCollapsed} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
          <button
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sidebar-ring"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" />
          </button>
        </div>

        <main className={`flex-1 relative ${isFullBleed ? 'overflow-hidden' : 'overflow-y-auto'} focus:outline-none`}>
          <div className={isFullBleed ? '' : 'py-6'}>
            <div className={isFullBleed ? '' : 'mx-auto px-4 sm:px-6 md:px-8'}>
              {children}
            </div>
          </div>
        </main>
      </div>
      </div>
    </TooltipProvider>
  )
}

function SidebarContent({ collapsed = false, onNavigate, onToggleCollapse }: { collapsed?: boolean; onNavigate?: () => void; onToggleCollapse?: () => void }) {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [currentPath, setCurrentPath] = useState(pathname || '')
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])
  const userInfo = session?.user as unknown as { name?: string; avatar?: string; image?: string }
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(userInfo?.avatar ?? userInfo?.image)

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    router.push("/auth/signin")
  }

  // Atualizar caminho atual e expansão com base no pathname
  useEffect(() => {
    setCurrentPath(pathname || '')
    navigation.forEach(item => {
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

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/profile')
        if (res.ok) {
          const u = await res.json()
          setAvatarUrl(u.avatar || userInfo?.image || userInfo?.avatar)
        }
      } catch {}
    }
    if (!avatarUrl) {
      load()
    }
  }, [session, avatarUrl])

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
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className={`flex ${collapsed ? 'flex-col items-center' : 'items-center justify-between'} flex-shrink-0 px-4 pt-5 pb-4`}>
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <NextLink href="/dashboard" aria-label="Dashboard" className="flex items-center">
                <LinkIcon className="h-8 w-8 text-sidebar-primary" />
                {!collapsed && (
                  <div className="grid ml-2">
                    <span className="text-2xl font-bold text-foreground">Link System</span>   
                    <span className="text-sm text-muted-foreground">Software House</span>     
                  </div>
                )}
              </NextLink>
            </TooltipTrigger>
            <TooltipContent side="right">Dashboard</TooltipContent>
          </Tooltip>
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={`${collapsed ? 'mt-2 flex' : 'hidden md:flex'} p-1 rounded-md text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent`}
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto">
        <nav className="flex-1 px-2 space-y-1">
          {navigation.map((item) => {
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NextLink
                        href={item.href}
                        className={`${
                          isActive
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                            : hasActiveSubmenu
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        } group w-full flex items-center ${collapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-xl text-sm font-medium transition-all duration-200`}
                        aria-label={item.name}
                      >
                        <item.icon
                          className={`${
                            isActive ? 'text-sidebar-primary-foreground' : hasActiveSubmenu ? 'text-sidebar-accent-foreground' : 'text-muted-foreground group-hover:text-sidebar-accent-foreground'
                          } ${collapsed ? '' : 'mr-3'} flex-shrink-0 h-5 w-5`}
                        />
                      </NextLink>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <button
                    onClick={() => {
                      if (hasSubmenu && !collapsed) {
                        toggleSubmenu(item.name)
                      } else {
                        handleNavigation(item.href)
                      }
                    }}
                    className={`${
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                        : hasActiveSubmenu
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    } group w-full flex items-center ${collapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-xl text-sm font-medium transition-all duration-200`}
                  >
                    <item.icon
                      className={`${
                        isActive ? 'text-sidebar-primary-foreground' : hasActiveSubmenu ? 'text-sidebar-accent-foreground' : 'text-muted-foreground group-hover:text-sidebar-accent-foreground'
                      } ${collapsed ? '' : 'mr-3'} flex-shrink-0 h-5 w-5`}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.name}</span>
                        {hasSubmenu && (
                          <div className="ml-2">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </button>
                )}

                {/* Submenu */}
                {hasSubmenu && !collapsed && isExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.submenu?.map((subItem) => {
                      const isSubActive = currentPath === subItem.href || 
                        (subItem.href !== '/projects' && currentPath.startsWith(subItem.href))
                      
                      return (
                        <Tooltip key={subItem.name}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleNavigation(subItem.href)}
                              className={`${
                                isSubActive
                                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm font-medium'
                                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                              } group w-full flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200`}
                              aria-label={subItem.name}
                            >
                              <subItem.icon
                                className={`${
                                  isSubActive ? 'text-sidebar-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-accent-foreground'
                                } mr-3 flex-shrink-0 h-5 w-5`}
                              />
                              {subItem.name}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            {subItem.name}
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>
      <div className="px-2 py-2 border-t border-muted">
        <div className={collapsed ? 'flex justify-center' : 'flex justify-end'}>
          <ModeToggle />
        </div>
      </div>
      <div className="border-t border-muted p-4">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <div className="flex items-center min-w-0">
              {avatarUrl ? (
                <Avatar
                  className="h-8 w-8 border flex-shrink-0 cursor-pointer hover:opacity-90"
                  onClick={() => handleNavigation('/profile')}
                >
                  <AvatarImage src={avatarUrl} alt={session?.user?.name || ""} className="object-cover" />
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm font-medium">
                    {session?.user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div
                  className="h-8 w-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-sm font-medium flex-shrink-0 cursor-pointer hover:opacity-90"
                  onClick={() => handleNavigation('/profile')}
                >
                  {session?.user?.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="ml-3 truncate grid">
                <button
                  onClick={() => handleNavigation('/profile')}
                  className="text-sm font-medium text-foreground truncate text-left hover:underline hover:cursor-pointer"
                  title="Abrir meu perfil"
                >
                  {session?.user?.name}
                </button>
                <span className="text-xs text-muted-foreground">({session?.user?.role})</span>
              </div>
            </div>
          )}
          
          <button 
            onClick={handleSignOut}
            className={`p-2 rounded-md text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent ${collapsed ? '' : 'ml-auto'}`}
            title="Sair"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

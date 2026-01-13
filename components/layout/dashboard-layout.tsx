"use client"

import { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
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
  Activity
} from "lucide-react"

interface DashboardLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { 
    name: "Projetos", 
    href: "/projects", 
    icon: FolderOpen,
    submenu: [
      { name: "Todos os Projetos", href: "/projects", icon: FolderOpen },
      { name: "Gestão Scrum", href: "/projects/scrum", icon: Kanban },
      { name: "Sprints", href: "/projects/sprints", icon: Target },
      { name: "Backlog", href: "/projects/backlog", icon: Calendar }
    ]
  },
  { name: "Clientes", href: "/clients", icon: Building2 },
  { name: "Financeiro", href: "/financial", icon: DollarSign },
  { 
    name: "Equipe", 
    href: "/team", 
    icon: Users,
    submenu: [
      { name: "Membros", href: "/team", icon: Users },
      { name: "Agenda", href: "/team/agenda", icon: Calendar },
      { name: "Chat", href: "/team/chat", icon: Activity },
      { name: "Performance", href: "/team/performance", icon: BarChart3 }
    ]
  },
  { name: "Supervisor", href: "/supervisor/dashboard", icon: Activity },
  { name: "Relatórios", href: "/reports", icon: BarChart3 },
  { name: "Configurações", href: "/settings", icon: Settings },
]

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { data: session } = useSession()
  const router = useRouter()

  // Carregar estado da sidebar do localStorage
  useEffect(() => {
    const savedCollapsed = localStorage.getItem('sidebarCollapsed')
    if (savedCollapsed !== null) {
      setSidebarCollapsed(JSON.parse(savedCollapsed))
    }
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
    <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
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
      <div className={`hidden md:flex md:flex-shrink-0 transition-all duration-300 ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      }`}>
        <div className={`flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}>
          <SidebarContent collapsed={sidebarCollapsed} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top bar */}
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow">
          <button
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          
          {/* Desktop sidebar toggle */}
          <button
            className="hidden md:flex items-center justify-center px-4 border-r border-gray-200 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            onClick={toggleSidebarCollapsed}
          >
            {sidebarCollapsed ? <ChevronRight className="h-6 w-6" /> : <ChevronLeft className="h-6 w-6" />}
          </button>
          
          <div className="flex-1 px-4 flex justify-between">
            <div className="flex-1 flex">
              <div className="w-full flex md:ml-0">
                <div className="relative w-full text-gray-400 focus-within:text-gray-600">
                  <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                    <Search className="h-5 w-5" />
                  </div>
                  <input
                    className="block w-full h-full pl-8 pr-3 py-2 border-transparent text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-0 focus:border-transparent"
                    placeholder="Buscar projetos, tarefas..."
                    type="search"
                  />
                </div>
              </div>
            </div>
            
            <div className="ml-4 flex items-center md:ml-6">
              {/* Notifications */}
              <button className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                <Bell className="h-6 w-6" />
              </button>

              {/* Profile dropdown */}
              <div className="ml-3 relative">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {session?.user.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <div className="text-sm font-medium text-gray-900">{session?.user.name}</div>
                    <div className="text-xs text-gray-500">{session?.user.role}</div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function SidebarContent({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const router = useRouter()
  const [currentPath, setCurrentPath] = useState('')
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])

  // Use useEffect to set the current path only on the client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname)
      
      // Auto-expand menu if current path matches submenu item
      navigation.forEach(item => {
        if (item.submenu) {
          const hasActiveSubmenu = item.submenu.some(subItem => 
            window.location.pathname.startsWith(subItem.href)
          )
          if (hasActiveSubmenu && !expandedMenus.includes(item.name)) {
            setExpandedMenus(prev => [...prev, item.name])
          }
        }
      })
    }
  }, [])

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
    <div className="flex flex-col h-full pt-5 pb-4 overflow-y-auto bg-white border-r border-gray-200">
      <div className="flex items-center flex-shrink-0 px-4">
        <div className="flex items-center">
          <Building2 className="h-8 w-8 text-indigo-600" />
          {!collapsed && (
            <span className="ml-2 text-xl font-bold text-gray-900">Link System</span>
          )}
        </div>
      </div>
      
      <div className="mt-5 flex-1 flex flex-col">
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
                <button
                  onClick={() => {
                    if (hasSubmenu && !collapsed) {
                      toggleSubmenu(item.name)
                    } else {
                      handleNavigation(item.href)
                    }
                  }}
                  className={`${
                    isActive || hasActiveSubmenu
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  } group w-full flex items-center ${collapsed ? 'justify-center px-2' : 'pl-2 pr-2'} py-2 border-l-4 text-sm font-medium transition-colors`}
                  {...(collapsed ? { title: item.name } : {})}
                >
                  <item.icon
                    className={`${
                      isActive || hasActiveSubmenu ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'
                    } ${collapsed ? '' : 'mr-3'} flex-shrink-0 h-6 w-6`}
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

                {/* Submenu */}
                {hasSubmenu && !collapsed && isExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.submenu?.map((subItem) => {
                      const isSubActive = currentPath === subItem.href || 
                        (subItem.href !== '/projects' && currentPath.startsWith(subItem.href))
                      
                      return (
                        <button
                          key={subItem.name}
                          onClick={() => handleNavigation(subItem.href)}
                          className={`${
                            isSubActive
                              ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-transparent'
                          } group w-full flex items-center pl-2 pr-2 py-2 border-l-4 text-sm transition-colors`}
                        >
                          <subItem.icon
                            className={`${
                              isSubActive ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'
                            } mr-3 flex-shrink-0 h-5 w-5`}
                          />
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
    </div>
  )
}
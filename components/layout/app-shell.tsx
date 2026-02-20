 "use client"
 
 import { useEffect, useState } from "react"
 import { usePathname, useRouter } from "next/navigation"
 import { useSession } from "next-auth/react"
 import { DashboardLayout } from "./dashboard-layout"
 import { isPathAllowed, firstAllowedPath, firstAllowedFromRole } from "@/lib/access-control"
 
 export function AppShell({ children }: { children: React.ReactNode }) {
   const pathname = usePathname() || ""
   const router = useRouter()
   const { data: session, status } = useSession()
   const [allowedPaths, setAllowedPaths] = useState<string[] | null>(null)
   const [checking, setChecking] = useState(false)
 
   const excludedPrefixes = ["/auth", "/collaborator-portal", "/client-portal"]
   const isExcluded = excludedPrefixes.some(prefix => pathname.startsWith(prefix))
 
   useEffect(() => {
     if (isExcluded) return
     if (status === "loading") return
     if (!session) return
 
     let cancelled = false
     async function loadPermissions() {
       try {
         setChecking(true)
         const res = await fetch(`/api/users/${session!.user.id}/permissions`)
         if (!res.ok) {
           setAllowedPaths([])
           return
         }
         const data = await res.json()
         if (!cancelled) {
           setAllowedPaths(data.allowedPaths || [])
         }
       } finally {
         if (!cancelled) setChecking(false)
       }
     }
     loadPermissions()
     return () => { cancelled = true }
   }, [session, status, pathname, isExcluded])
 
   useEffect(() => {
     if (isExcluded) return
     if (status === "loading") return
     if (!session) return
     if (!allowedPaths) return
     const ok = isPathAllowed(pathname, allowedPaths)
    if (!ok) {
      const dest = firstAllowedPath(allowedPaths) || firstAllowedFromRole(session.user.role) || "/auth/signin"
      router.replace(dest)
    }
   }, [allowedPaths, pathname, session, status, isExcluded, router])
 
   if (isExcluded) {
     return <>{children}</>
   }
 
   if (status === "loading" || checking || !allowedPaths) {
     return (
       <div className="flex items-center justify-center min-h-[300px]">
         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
       </div>
     )
   }
 
   return (
     <DashboardLayout>
       {children}
     </DashboardLayout>
   )
 }

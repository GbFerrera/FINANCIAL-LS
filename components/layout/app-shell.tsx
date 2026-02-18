 "use client"
 
 import { usePathname } from "next/navigation"
 import { DashboardLayout } from "./dashboard-layout"
 
 export function AppShell({ children }: { children: React.ReactNode }) {
   const pathname = usePathname() || ""
 
   const excludedPrefixes = ["/auth", "/collaborator-portal", "/client-portal"]
   const isExcluded = excludedPrefixes.some(prefix => pathname.startsWith(prefix))
 
   if (isExcluded) {
     return <>{children}</>
   }
 
   return (
     <DashboardLayout>
       {children}
     </DashboardLayout>
   )
 }

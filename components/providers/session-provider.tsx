"use client"

import { SessionProvider } from "next-auth/react"
import { LiquidToaster } from "@/components/ui/liquid-toaster"
import { WebSocketProvider } from "@/contexts/WebSocketContext"
import { RealtimeNotificationsListener } from "@/components/notifications/RealtimeNotificationsListener"
import { ThemeProvider } from "next-themes"

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0} refetchWhenOffline={false}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <WebSocketProvider>
          <RealtimeNotificationsListener />
          {children}
        </WebSocketProvider>
        <LiquidToaster />
      </ThemeProvider>
    </SessionProvider>
  )
}

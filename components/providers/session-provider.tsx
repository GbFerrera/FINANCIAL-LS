"use client"

import { SessionProvider } from "next-auth/react"
import { LiquidToaster } from "@/components/ui/liquid-toaster"
import { WebSocketProvider } from "@/contexts/WebSocketContext"
import { SocketIOProvider } from "@/contexts/SocketIOProvider"
import { RealtimeNotificationsListener } from "@/components/notifications/RealtimeNotificationsListener"
import { RealtimeSocketSoundUnlock } from "@/components/notifications/RealtimeSocketSoundUnlock"
import { ThemeProvider } from "next-themes"

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0} refetchWhenOffline={false}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <WebSocketProvider>
          <SocketIOProvider>
            <RealtimeNotificationsListener />
            <RealtimeSocketSoundUnlock />
            {children}
          </SocketIOProvider>
        </WebSocketProvider>
        <LiquidToaster />
      </ThemeProvider>
    </SessionProvider>
  )
}

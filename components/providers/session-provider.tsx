"use client"

import { SessionProvider } from "next-auth/react"
import { LiquidToaster } from "@/components/ui/liquid-toaster"
import { WebSocketProvider } from "@/contexts/WebSocketContext"
import { SocketIOProvider } from "@/contexts/SocketIOProvider"
import { RealtimeNotificationsListener } from "@/components/notifications/RealtimeNotificationsListener"
import { RealtimeSocketSoundUnlock } from "@/components/notifications/RealtimeSocketSoundUnlock"
import { OfficeSessionProvider } from "@/contexts/OfficeSessionContext"
import { CallSessionProvider } from "@/contexts/CallSessionContext"
import { AppBrandProvider } from "@/contexts/AppBrandContext"
import { ThemeProvider } from "next-themes"

interface ProvidersProps {
  children: React.ReactNode
  appName?: string
  appTagline?: string
}

export function Providers({ children, appName, appTagline }: ProvidersProps) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0} refetchWhenOffline={false}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AppBrandProvider name={appName} tagline={appTagline}>
          <WebSocketProvider>
            <OfficeSessionProvider>
              <CallSessionProvider>
                <SocketIOProvider>
                  <RealtimeNotificationsListener />
                  <RealtimeSocketSoundUnlock />
                  {children}
                </SocketIOProvider>
              </CallSessionProvider>
            </OfficeSessionProvider>
          </WebSocketProvider>
          <LiquidToaster />
        </AppBrandProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Lottie, type LottieHandle } from 'lottie-react'
import { useTheme } from 'next-themes'
import { applyLottieTheme } from '@/lib/lottie-theme'
import {
  SIDEBAR_LOTTIE_ICONS,
  type SidebarLottieKey,
} from '@/lib/sidebar-lottie-icons'
import { cn } from '@/lib/utils'

type SidebarNavIconProps = {
  lottie: SidebarLottieKey
  active?: boolean
  /** Inverte paleta claro/escuro quando ativo (ex.: pill com fundo sidebar-primary). */
  invertWhenActive?: boolean
  className?: string
  size?: number
}

function runLottie(instance: LottieHandle | null, mode: 'play' | 'pause') {
  if (!instance?.seek) return
  instance.seek(0)
  if (mode === 'play') {
    instance.play?.()
  } else {
    instance.pause?.()
  }
}

export function SidebarNavIcon({
  lottie,
  active = false,
  invertWhenActive = false,
  className,
  size = 30,
}: SidebarNavIconProps) {
  const { resolvedTheme } = useTheme()
  const lottieRef = useRef<LottieHandle>(null)
  const [mounted, setMounted] = useState(false)
  const activeRef = useRef(active)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => setMounted(true), [])

  const animationData = useMemo(() => {
    const source = SIDEBAR_LOTTIE_ICONS[lottie]
    if (!mounted) return source
    let theme = resolvedTheme === 'dark' ? 'dark' : 'light'
    if (invertWhenActive && active) {
      theme = theme === 'dark' ? 'light' : 'dark'
    }
    return applyLottieTheme(source, theme)
  }, [lottie, mounted, resolvedTheme, invertWhenActive, active])

  const syncPlayback = useCallback((mode: 'play' | 'pause') => {
    runLottie(lottieRef.current, mode)
  }, [])

  useEffect(() => {
    syncPlayback(active ? 'play' : 'pause')
  }, [active, animationData, syncPlayback])

  const play = () => syncPlayback('play')

  const subscriptions = useMemo(
    () => ({
      ready: () => {
        syncPlayback(activeRef.current ? 'play' : 'pause')
      },
    }),
    [syncPlayback]
  )

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-opacity',
        active ? 'opacity-100' : 'opacity-75 group-hover/nav:opacity-100',
        className
      )}
      style={{ width: size, height: size }}
      onMouseEnter={play}
      aria-hidden
    >
      <Lottie
        lottieRef={lottieRef}
        src={animationData}
        loop={false}
        autoplay={false}
        subscriptions={subscriptions}
        style={{ width: size, height: size }}
      />
    </span>
  )
}

type NavIconProps = {
  lottie?: SidebarLottieKey
  icon?: React.ElementType
  active?: boolean
  className?: string
  size?: 'main' | 'sub'
}

export function NavIcon({
  lottie,
  icon: Icon,
  active,
  className,
  size = 'main',
}: NavIconProps) {
  const px = size === 'main' ? 30 : 20

  if (lottie) {
    return (
      <SidebarNavIcon
        lottie={lottie}
        active={active}
        className={className}
        size={px}
      />
    )
  }

  if (!Icon) return null

  return (
    <Icon
      className={cn(
        size === 'main' ? 'h-[30px] w-[30px]' : 'h-5 w-5',
        'shrink-0 opacity-70',
        className
      )}
    />
  )
}

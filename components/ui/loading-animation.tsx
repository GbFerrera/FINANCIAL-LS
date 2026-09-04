'use client'

import type { CSSProperties, ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Lottie } from 'lottie-react'
import { cn } from '@/lib/utils'
import loadingAnimation from '../../public/loading.json'

const EASE_OUT = [0.22, 1, 0.36, 1] as const

const SIZE_MAP = {
  xs: 24,
  sm: 40,
  md: 56,
  lg: 80,
  xl: 112,
  '2xl': 144,
} as const

export type LoadingSize = keyof typeof SIZE_MAP | number

function resolveSize(size: LoadingSize) {
  return typeof size === 'number' ? size : SIZE_MAP[size]
}

type LoadingAnimationProps = {
  size?: LoadingSize
  className?: string
  label?: string
  fullScreen?: boolean
}

function LoadingLottie({
  className,
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return (
    <Lottie
      src={loadingAnimation}
      loop
      autoplay
      className={className}
      style={style}
    />
  )
}

function FullscreenLoadingOverlay({ label }: { label?: string }) {
  return (
    <motion.div
      key="loading-overlay"
      className={cn(
        'loading-glass-overlay fixed inset-0 z-[200] flex items-center justify-center',
        'border border-white/30 dark:border-white/10',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
      )}
      role="status"
      aria-label={label || 'Carregando'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.12),transparent_60%)] dark:bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.18),transparent_60%)]"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
      />

      <motion.div
        className="relative z-10 drop-shadow-[0_8px_32px_rgba(15,23,42,0.12)]"
        initial={{ opacity: 0, scale: 0.82, y: 28, filter: 'blur(10px)' }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 1.06, y: -18, filter: 'blur(12px)' }}
        transition={{ duration: 0.55, ease: EASE_OUT }}
      >
        <LoadingLottie className="aspect-video w-[98vw] max-h-[82vh]" />
      </motion.div>

      <span className="sr-only">{label || 'Carregando'}</span>
    </motion.div>
  )
}

export function PageLoadingGate({
  loading,
  children,
  label,
  className,
  fillHeight = false,
}: {
  loading: boolean
  children: ReactNode
  label?: string
  className?: string
  fillHeight?: boolean
}) {
  return (
    <div className={cn('relative min-h-0', fillHeight && 'flex h-full flex-col', className)}>
      <div
        className={cn(
          'min-h-0',
          fillHeight && 'flex h-full flex-1 flex-col',
          loading && 'pointer-events-none select-none'
        )}
      >
        {children}
      </div>

      <AnimatePresence initial={false}>
        {loading ? <FullscreenLoadingOverlay key="page-loading" label={label} /> : null}
      </AnimatePresence>
    </div>
  )
}

export function LoadingAnimation({
  size = 'md',
  className,
  label,
  fullScreen = false,
}: LoadingAnimationProps) {
  if (fullScreen) {
    return (
      <AnimatePresence mode="wait">
        <FullscreenLoadingOverlay label={label} />
      </AnimatePresence>
    )
  }

  const px = resolveSize(size)

  return (
    <motion.div
      className={cn('flex flex-col items-center justify-center gap-2', className)}
      role="status"
      aria-label={label || 'Carregando'}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
    >
      <LoadingLottie style={{ width: px, height: px }} />
      {label ? <p className="text-sm text-muted-foreground">{label}</p> : null}
      <span className="sr-only">{label || 'Carregando'}</span>
    </motion.div>
  )
}

type LoadingScreenProps = {
  label?: string
  className?: string
  fullScreen?: boolean
  size?: LoadingSize
  minHeight?: string | number
}

export function LoadingScreen({
  label,
  className,
  fullScreen = true,
  size = 'lg',
  minHeight = '300px',
}: LoadingScreenProps) {
  if (fullScreen) {
    return <LoadingAnimation fullScreen className={className} label={label} />
  }

  return (
    <div
      className={cn('flex flex-1 items-center justify-center', className)}
      style={{ minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight }}
    >
      <LoadingAnimation size={size} label={label} />
    </div>
  )
}

export function LoadingInline({ className, size = 'xs' }: { className?: string; size?: LoadingSize }) {
  return (
    <motion.span
      className={cn('inline-flex', className)}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
    >
      <LoadingAnimation size={size} />
    </motion.span>
  )
}

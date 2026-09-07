export type LottieTheme = 'light' | 'dark'

const ACCENT_SOURCE = [0.3254901960784314, 0.42745098039215684, 0.996078431372549] as const

const PALETTE = {
  light: {
    stroke: [0.12, 0.14, 0.18] as const,
    accent: ACCENT_SOURCE,
  },
  dark: {
    stroke: [0.94, 0.96, 0.99] as const,
    accent: [0.74, 0.82, 1] as const,
  },
} as const

function brightness(value: [number, number, number]) {
  return (value[0] + value[1] + value[2]) / 3
}

function isRgbTriplet(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === 'number')
  )
}

function matchesColor(value: [number, number, number], target: readonly [number, number, number]) {
  return value.every((n, i) => Math.abs(n - target[i]) < 0.02)
}

function mapStrokeColor(value: [number, number, number], theme: LottieTheme) {
  const palette = PALETTE[theme]

  if (matchesColor(value, ACCENT_SOURCE)) {
    return [...palette.accent]
  }

  if (matchesColor(value, [0, 0, 0]) || value.every((n) => n < 0.08)) {
    return [...palette.stroke]
  }

  if (theme === 'dark' && brightness(value) < 0.7) {
    return [...palette.stroke]
  }

  if (theme === 'light' && brightness(value) < 0.25) {
    return [...palette.stroke]
  }

  return value
}

function recolorNode(node: unknown, theme: LottieTheme): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => recolorNode(item, theme))
  }

  if (!node || typeof node !== 'object') {
    return node
  }

  const record = node as Record<string, unknown>

  if (theme === 'dark' && record.ty === 'fl') {
    return {
      ...record,
      o: { a: 0, k: 0, ix: 4 },
    }
  }

  const next: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(record)) {
    if (key === 'c' && value && typeof value === 'object') {
      const colorObj = value as Record<string, unknown>
      const k = colorObj.k
      const ty = record.ty

      if (isRgbTriplet(k) && ty === 'st') {
        next[key] = {
          ...colorObj,
          k: mapStrokeColor(k, theme),
        }
        continue
      }
    }

    next[key] = recolorNode(value, theme)
  }

  return next
}

export function applyLottieTheme<T>(data: T, theme: LottieTheme): T {
  return recolorNode(structuredClone(data), theme) as T
}

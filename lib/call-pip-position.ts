export const CALL_PIP_WIDTH = 380
export const CALL_PIP_HEIGHT = 560
export const CALL_PIP_STORAGE_KEY = 'link-call-pip-position'

export type PipPosition = { x: number; y: number }

export function getPipDimensions() {
  if (typeof window === 'undefined') {
    return { width: CALL_PIP_WIDTH, height: CALL_PIP_HEIGHT }
  }
  return {
    width: Math.min(CALL_PIP_WIDTH, window.innerWidth - 24),
    height: Math.min(CALL_PIP_HEIGHT, window.innerHeight - 88),
  }
}

export function clampPipPosition(x: number, y: number): PipPosition {
  if (typeof window === 'undefined') return { x, y }
  const { width, height } = getPipDimensions()
  const margin = 8
  const maxX = Math.max(margin, window.innerWidth - width - margin)
  const maxY = Math.max(margin, window.innerHeight - height - margin)
  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY),
  }
}

export function defaultPipPosition(): PipPosition {
  if (typeof window === 'undefined') return { x: 16, y: 72 }
  const { width, height } = getPipDimensions()
  return clampPipPosition(window.innerWidth - width - 16, 72)
}

export function loadPipPosition(): PipPosition {
  if (typeof window === 'undefined') return defaultPipPosition()
  try {
    const raw = localStorage.getItem(CALL_PIP_STORAGE_KEY)
    if (!raw) return defaultPipPosition()
    const parsed = JSON.parse(raw) as PipPosition
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
      return defaultPipPosition()
    }
    return clampPipPosition(parsed.x, parsed.y)
  } catch {
    return defaultPipPosition()
  }
}

export function savePipPosition(pos: PipPosition) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CALL_PIP_STORAGE_KEY, JSON.stringify(pos))
  } catch {
    /* ignore quota */
  }
}

export type CalendarPanelMode = 'docked' | 'minimized'

export type CalendarPanelGeometry = {
  x: number
  y: number
  width: number
  height: number
}

const DEFAULT_WIDTH = 320
const DEFAULT_HEIGHT = 220
const MIN_WIDTH = 220
const MIN_HEIGHT = 140
const EDGE_PADDING = 8

export function calendarPanelStorageKey(workspaceId: string) {
  return `pipeline-management-calendar:${workspaceId}`
}

export function defaultCalendarPanelGeometry(
  parentWidth: number,
  parentHeight: number
): CalendarPanelGeometry {
  const width = Math.min(DEFAULT_WIDTH, Math.max(MIN_WIDTH, parentWidth - EDGE_PADDING * 2))
  const height = Math.min(DEFAULT_HEIGHT, Math.max(MIN_HEIGHT, parentHeight - EDGE_PADDING * 2))
  return {
    x: Math.max(EDGE_PADDING, parentWidth - width - EDGE_PADDING),
    y: EDGE_PADDING,
    width,
    height,
  }
}

export function clampCalendarPanelGeometry(
  geometry: CalendarPanelGeometry,
  parentWidth: number,
  parentHeight: number
): CalendarPanelGeometry {
  const width = Math.min(
    Math.max(MIN_WIDTH, parentWidth - EDGE_PADDING * 2),
    Math.max(MIN_WIDTH, geometry.width)
  )
  const height = Math.min(
    Math.max(MIN_HEIGHT, parentHeight - EDGE_PADDING * 2),
    Math.max(MIN_HEIGHT, geometry.height)
  )
  const maxX = Math.max(EDGE_PADDING, parentWidth - width - EDGE_PADDING)
  const maxY = Math.max(EDGE_PADDING, parentHeight - height - EDGE_PADDING)
  return {
    width,
    height,
    x: Math.min(maxX, Math.max(EDGE_PADDING, geometry.x)),
    y: Math.min(maxY, Math.max(EDGE_PADDING, geometry.y)),
  }
}

export function readCalendarPanelGeometry(
  storageKey: string,
  parentWidth: number,
  parentHeight: number
): CalendarPanelGeometry {
  if (typeof window === 'undefined') {
    return defaultCalendarPanelGeometry(parentWidth, parentHeight)
  }

  const raw = window.localStorage.getItem(`${storageKey}:geometry`)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<CalendarPanelGeometry>
      if (
        typeof parsed.x === 'number' &&
        typeof parsed.y === 'number' &&
        typeof parsed.width === 'number' &&
        typeof parsed.height === 'number'
      ) {
        return clampCalendarPanelGeometry(
          {
            x: parsed.x,
            y: parsed.y,
            width: parsed.width,
            height: parsed.height,
          },
          parentWidth,
          parentHeight
        )
      }
    } catch {
      /* ignore */
    }
  }

  const legacyHeight = window.localStorage.getItem(`${storageKey}:height`)
  const base = defaultCalendarPanelGeometry(parentWidth, parentHeight)
  if (legacyHeight && Number.isFinite(Number(legacyHeight))) {
    base.height = Number(legacyHeight)
  }

  return clampCalendarPanelGeometry(base, parentWidth, parentHeight)
}

export function writeCalendarPanelGeometry(storageKey: string, geometry: CalendarPanelGeometry) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(`${storageKey}:geometry`, JSON.stringify(geometry))
}

export function readCalendarPanelMode(storageKey: string): CalendarPanelMode {
  if (typeof window === 'undefined') return 'docked'
  return window.localStorage.getItem(`${storageKey}:mode`) === 'minimized' ? 'minimized' : 'docked'
}

export function writeCalendarPanelMode(storageKey: string, mode: CalendarPanelMode) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(`${storageKey}:mode`, mode)
}

export { DEFAULT_HEIGHT, DEFAULT_WIDTH, MIN_HEIGHT, MIN_WIDTH, EDGE_PADDING }

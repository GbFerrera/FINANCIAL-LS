export const CALL_GUEST_NAME_KEY = 'link-call-guest-name'

export function normalizeGuestName(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 40)
}

export function isValidGuestName(value: string) {
  const name = normalizeGuestName(value)
  return name.length >= 2
}

export function loadStoredGuestName() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CALL_GUEST_NAME_KEY)
    if (!raw) return null
    return isValidGuestName(raw) ? normalizeGuestName(raw) : null
  } catch {
    return null
  }
}

export function storeGuestName(value: string) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(CALL_GUEST_NAME_KEY, normalizeGuestName(value))
}

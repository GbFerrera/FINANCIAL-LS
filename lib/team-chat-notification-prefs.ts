'use client'

export type TeamChatNotificationPrefs = {
  soundEnabled: boolean
  toastEnabled: boolean
  onlyWhenAway: boolean
}

const STORAGE_KEY = 'team-chat-notification-prefs-v1'
const CHANGE_EVENT = 'team-chat-notification-prefs-change'

export const DEFAULT_TEAM_CHAT_NOTIFICATION_PREFS: TeamChatNotificationPrefs = {
  soundEnabled: false,
  toastEnabled: true,
  onlyWhenAway: true,
}

export function getTeamChatNotificationPrefs(): TeamChatNotificationPrefs {
  if (typeof window === 'undefined') return DEFAULT_TEAM_CHAT_NOTIFICATION_PREFS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_TEAM_CHAT_NOTIFICATION_PREFS
    const parsed = JSON.parse(raw) as Partial<TeamChatNotificationPrefs>
    return {
      soundEnabled: Boolean(parsed.soundEnabled),
      toastEnabled: parsed.toastEnabled !== false,
      onlyWhenAway: parsed.onlyWhenAway !== false,
    }
  } catch {
    return DEFAULT_TEAM_CHAT_NOTIFICATION_PREFS
  }
}

export function setTeamChatNotificationPrefs(prefs: TeamChatNotificationPrefs) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: prefs }))
}

export function subscribeTeamChatNotificationPrefs(
  listener: (prefs: TeamChatNotificationPrefs) => void
) {
  if (typeof window === 'undefined') return () => {}
  const handler = (event: Event) => {
    listener((event as CustomEvent<TeamChatNotificationPrefs>).detail)
  }
  window.addEventListener(CHANGE_EVENT, handler)
  return () => window.removeEventListener(CHANGE_EVENT, handler)
}

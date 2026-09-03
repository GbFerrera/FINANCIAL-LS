'use client'

let audio: HTMLAudioElement | null = null
let unlocked = false

function getAudio() {
  if (typeof window === 'undefined') return null
  if (!audio) {
    audio = new Audio('/notification.mp3')
    audio.preload = 'auto'
    audio.volume = 0.75
  }
  return audio
}

export function unlockNotificationSound() {
  const el = getAudio()
  if (!el || unlocked) return

  el.play()
    .then(() => {
      el.pause()
      el.currentTime = 0
      unlocked = true
    })
    .catch(() => {
      /* aguarda interação do usuário */
    })
}

export function playNotificationSound() {
  const el = getAudio()
  if (!el) return

  el.currentTime = 0
  void el.play().catch(() => {
    /* autoplay bloqueado até unlock */
  })
}

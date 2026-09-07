/** Instância WorkAdventure Link System (Escritório 2D). */
export const WORKADVENTURE_PLAY_URL =
  process.env.NEXT_PUBLIC_WORKADVENTURE_PLAY_URL ?? 'https://office.linksystem.tech'

/** Sala padrão — escritório do map-starter-kit hospedado no map-storage. */
export const WORKADVENTURE_DEFAULT_MAP =
  process.env.NEXT_PUBLIC_WORKADVENTURE_MAP_URL ??
  '/_/global/workadventure.github.io/map-starter-kit/office.tmj'

export function buildWorkAdventureOfficeUrl(options?: {
  playUrl?: string
  mapUrl?: string
  nickname?: string | null
}) {
  const base = (options?.playUrl ?? WORKADVENTURE_PLAY_URL).replace(/\/+$/, '')
  const map = options?.mapUrl ?? WORKADVENTURE_DEFAULT_MAP
  const params = new URLSearchParams()
  params.set('map', map)
  if (options?.nickname) params.set('nickname', options.nickname.slice(0, 24))
  return `${base}?${params.toString()}`
}

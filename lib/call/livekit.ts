import { AccessToken } from 'livekit-server-sdk'

export function isLiveKitConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_URL &&
      process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET
  )
}

export function getLiveKitUrl(): string | null {
  return process.env.LIVEKIT_URL ?? process.env.NEXT_PUBLIC_LIVEKIT_URL ?? null
}

export async function createLiveKitToken(
  roomName: string,
  userId: string,
  userName: string
): Promise<string> {
  if (!isLiveKitConfigured()) {
    throw new Error('LiveKit não configurado')
  }

  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    {
      identity: userId,
      name: userName,
      ttl: '4h',
    }
  )

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  })

  return token.toJwt()
}

export function buildRoomName(prefix = 'link-call'): string {
  const slug = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  return `${prefix}-${slug}`
}

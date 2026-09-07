import type { TeamChatMessage } from '@/lib/team-chat'

export type TeamChatSocketEvent = {
  action: 'created'
  channelId: string
  message: TeamChatMessage
}

export type TeamChatAttachment = {
  id: string
  originalName: string
  fileName: string
  filePath: string
  fileUrl: string
  fileSize: number
  mimeType: string
}

export type TeamChatAuthor = {
  id: string
  name: string
  email?: string
  role?: string
  avatar?: string | null
}

export type TeamChatMessage = {
  id: string
  channelId: string
  content: string
  type: 'TEXT' | 'FILE' | 'IMAGE'
  createdAt: string
  editedAt?: string | null
  author: TeamChatAuthor
  attachments: TeamChatAttachment[]
}

export type TeamChatChannel = {
  id: string
  name: string
  type: string
  description?: string | null
  unreadCount: number
  lastMessage?: {
    content: string
    createdAt: string
    author: TeamChatAuthor
  } | null
}

export function getTeamChannelRoom(channelId: string) {
  return `team-channel:${channelId}`
}

const AUTHOR_COLORS = [
  'text-sky-600 dark:text-sky-400',
  'text-emerald-600 dark:text-emerald-400',
  'text-violet-600 dark:text-violet-400',
  'text-amber-600 dark:text-amber-400',
  'text-rose-600 dark:text-rose-400',
  'text-cyan-600 dark:text-cyan-400',
  'text-orange-600 dark:text-orange-400',
  'text-indigo-600 dark:text-indigo-400',
]

export function getAuthorColorClass(userId: string) {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i)
    hash |= 0
  }
  return AUTHOR_COLORS[Math.abs(hash) % AUTHOR_COLORS.length]
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isImageMime(mimeType: string) {
  return mimeType.startsWith('image/')
}

type DbMessage = {
  id: string
  channelId: string
  content: string
  type: string
  createdAt: Date
  editedAt: Date | null
  author: {
    id: string
    name: string
    email: string
    role: string
    avatar: string | null
  }
  attachments: Array<{
    id: string
    originalName: string
    fileName: string
    filePath: string
    fileUrl: string
    fileSize: number
    mimeType: string
  }>
}

export function serializeTeamMessage(message: DbMessage): TeamChatMessage {
  return {
    id: message.id,
    channelId: message.channelId,
    content: message.content,
    type: message.type as TeamChatMessage['type'],
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    author: {
      id: message.author.id,
      name: message.author.name,
      email: message.author.email,
      role: message.author.role,
      avatar: message.author.avatar,
    },
    attachments: message.attachments.map((a) => ({
      id: a.id,
      originalName: a.originalName,
      fileName: a.fileName,
      filePath: a.filePath,
      fileUrl: a.fileUrl,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
    })),
  }
}

export const DEFAULT_COMMS_ROOM_ID = 'link-system'

export const DEFAULT_TEAM_CHANNELS = [
  { id: 'general', name: 'geral', description: 'Canal geral da equipe', type: 'GENERAL' },
  { id: 'projects', name: 'projetos', description: 'Discussões sobre projetos', type: 'GENERAL' },
  { id: 'random', name: 'aleatório', description: 'Conversas casuais', type: 'GENERAL' },
] as const

export const DEFAULT_TEAM_CHANNEL_IDS = DEFAULT_TEAM_CHANNELS.map((c) => c.id)

export function getDefaultChannelId(commsRoomId: string, baseId: string) {
  if (commsRoomId === DEFAULT_COMMS_ROOM_ID) return baseId
  return `${commsRoomId}--${baseId}`
}

export function getDefaultChannelsForRoom(commsRoomId: string) {
  return DEFAULT_TEAM_CHANNELS.map((channel) => ({
    id: getDefaultChannelId(commsRoomId, channel.id),
    name: channel.name,
    description: channel.description,
    type: channel.type,
  }))
}

export function getDefaultTextChannelId(commsRoomId: string = DEFAULT_COMMS_ROOM_ID) {
  return getDefaultChannelsForRoom(commsRoomId)[0].id
}

export function isDefaultTeamChannel(
  channelId: string,
  commsRoomId: string = DEFAULT_COMMS_ROOM_ID
) {
  return getDefaultChannelsForRoom(commsRoomId).some((channel) => channel.id === channelId)
}

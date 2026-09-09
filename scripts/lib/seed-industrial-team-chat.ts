import { PrismaClient } from '@prisma/client'
import {
  DEMO_SECTOR_CHAT_CHANNELS,
  DEMO_TEAM,
  DEMO_TEAM_CHAT_MESSAGES,
  DEMO_WORKSPACES,
} from '../data/industrial-automation-demo'

const DEFAULT_COMMS_ROOM_ID = 'link-system'

const DEFAULT_TEAM_CHANNELS = [
  { id: 'general', name: 'geral', description: 'Canal geral da equipe', type: 'GENERAL' },
  { id: 'projects', name: 'projetos', description: 'Discussões sobre projetos', type: 'GENERAL' },
  { id: 'random', name: 'aleatório', description: 'Conversas casuais', type: 'GENERAL' },
] as const

function getDefaultChannelId(commsRoomId: string, baseId: string) {
  if (commsRoomId === DEFAULT_COMMS_ROOM_ID) return baseId
  return `${commsRoomId}--${baseId}`
}

function getDefaultChannelsForRoom(commsRoomId: string) {
  return DEFAULT_TEAM_CHANNELS.map((channel) => ({
    id: getDefaultChannelId(commsRoomId, channel.id),
    name: channel.name,
    description: channel.description,
    type: channel.type,
  }))
}

function atDayTime(daysAgo: number, hour: number, minute = 0) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, minute, 0, 0)
  return d
}

function sectorChannelId(commsRoomId: string, slug: string) {
  return `${commsRoomId}--${slug}`
}

async function ensureDefaultChannels(prisma: PrismaClient, commsRoomId: string) {
  for (const channel of getDefaultChannelsForRoom(commsRoomId)) {
    await prisma.teamChannel.upsert({
      where: { id: channel.id },
      create: {
        id: channel.id,
        name: channel.name,
        description: channel.description,
        type: channel.type,
        commsRoomId,
      },
      update: {},
    })
  }
}

export async function seedIndustrialTeamChat(prisma: PrismaClient) {
  console.log('💬 Chats por setor (team/chat)...')

  const workspaces = await prisma.workspace.findMany({
    where: { slug: { in: DEMO_WORKSPACES.map((w) => w.slug) } },
    select: { slug: true },
  })

  if (workspaces.length === 0) {
    console.log('   Nenhum workspace demo — rode seed industrial primeiro')
    return { rooms: 0, channels: 0, messages: 0 }
  }

  const commsRoomIds = [DEFAULT_COMMS_ROOM_ID, ...workspaces.map((w) => w.slug)]
  const channelIds: string[] = []

  for (const commsRoomId of commsRoomIds) {
    await ensureDefaultChannels(prisma, commsRoomId)
    channelIds.push(...getDefaultChannelsForRoom(commsRoomId).map((c) => c.id))
  }

  for (const sector of DEMO_SECTOR_CHAT_CHANNELS) {
    if (!commsRoomIds.includes(sector.commsRoomId)) continue
    for (const ch of sector.channels) {
      const id = sectorChannelId(sector.commsRoomId, ch.slug)
      await prisma.teamChannel.upsert({
        where: { id },
        create: {
          id,
          name: ch.name,
          description: ch.description,
          type: ch.type ?? 'GENERAL',
          commsRoomId: sector.commsRoomId,
        },
        update: {
          name: ch.name,
          description: ch.description,
        },
      })
      channelIds.push(id)
    }
  }

  await prisma.teamMessageAttachment.deleteMany({
    where: { message: { channelId: { in: channelIds } } },
  })
  await prisma.teamChannelMessage.deleteMany({
    where: { channelId: { in: channelIds } },
  })

  const teamUsers = await prisma.user.findMany({
    where: { email: { in: DEMO_TEAM.map((t) => t.email) } },
    select: { id: true, email: true },
  })
  const userByEmail = Object.fromEntries(teamUsers.map((u) => [u.email, u.id]))

  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true, email: true },
  })

  const channelIdByKey = (commsRoomId: string, channelKey: string) => {
    const defaults = ['general', 'projects', 'random']
    if (defaults.includes(channelKey)) {
      return getDefaultChannelId(commsRoomId, channelKey)
    }
    return sectorChannelId(commsRoomId, channelKey)
  }

  let messageCount = 0
  for (const msg of DEMO_TEAM_CHAT_MESSAGES) {
    if (!commsRoomIds.includes(msg.commsRoomId)) continue
    const channelId = channelIdByKey(msg.commsRoomId, msg.channelKey)
    if (!channelIds.includes(channelId)) continue

    const authorId =
      userByEmail[msg.authorEmail] ?? admin?.id ?? teamUsers[0]?.id
    if (!authorId) continue

    await prisma.teamChannelMessage.create({
      data: {
        channelId,
        authorId,
        content: msg.content,
        type: 'TEXT',
        createdAt: atDayTime(msg.daysAgo, msg.hour, msg.minute ?? 0),
      },
    })
    messageCount++
  }

  const extraChannels = DEMO_SECTOR_CHAT_CHANNELS.reduce(
    (sum, s) => sum + s.channels.length,
    0
  )
  const defaultChannels = commsRoomIds.length * 3

  console.log(`   ${commsRoomIds.length} salas · ${defaultChannels + extraChannels} canais · ${messageCount} mensagens`)

  return {
    rooms: commsRoomIds.length,
    channels: defaultChannels + extraChannels,
    messages: messageCount,
  }
}

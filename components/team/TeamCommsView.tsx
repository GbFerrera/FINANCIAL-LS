'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ChevronDown,
  Hash,
  Loader2,
  Mic,
  MoreVertical,
  Pencil,
  Plus,
  Settings,
  Trash2,
  Users,
  Video,
  Volume2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { LoadingAnimation } from '@/components/ui/loading-animation'
import { TeamChatPanel } from '@/components/team/TeamChatPanel'
import { TeamChatNotificationListener } from '@/components/team/TeamChatNotificationListener'
import { TeamChatNotificationSettings } from '@/components/team/TeamChatNotificationSettings'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  isDefaultTeamChannel,
  DEFAULT_COMMS_ROOM_ID,
  getDefaultChannelsForRoom,
  getDefaultTextChannelId,
} from '@/lib/team-chat'
import { cn } from '@/lib/utils'
import '@/components/team/team-comms.css'

type CommsRoom = {
  id: string
  name: string
  initial: string
}

type TextChannel = {
  id: string
  name: string
  description?: string
  unreadCount: number
}

type VoiceChannel = {
  id: string
  name: string
  kind: 'room' | 'new'
  roomId?: string
  callType?: 'audio' | 'video'
  live?: boolean
  hostName?: string
}

function mergeTextChannels(channels: TextChannel[], commsRoomId: string): TextChannel[] {
  const byId = new Map<string, TextChannel>()
  for (const def of getDefaultChannelsForRoom(commsRoomId)) {
    byId.set(def.id, {
      id: def.id,
      name: def.name,
      description: def.description,
      unreadCount: 0,
    })
  }
  for (const channel of channels) {
    byId.set(channel.id, { ...byId.get(channel.id), ...channel })
  }
  const defaults = getDefaultChannelsForRoom(commsRoomId)
    .map((def) => byId.get(def.id))
    .filter((channel): channel is TextChannel => Boolean(channel))
  const custom = channels.filter((channel) => !isDefaultTeamChannel(channel.id, commsRoomId))
  return [...defaults, ...custom]
}

const DEFAULT_ROOM: CommsRoom = {
  id: DEFAULT_COMMS_ROOM_ID,
  name: 'Link System',
  initial: 'LS',
}
const ROOMS_STORAGE_KEY = 'team-comms-rooms-v1'

function loadCustomRooms(): CommsRoom[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(ROOMS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CommsRoom[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveCustomRooms(rooms: CommsRoom[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(rooms))
}

function goToCall(path: string) {
  if (typeof window !== 'undefined') window.location.assign(path)
}

function TeamCommsContent() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [rooms, setRooms] = useState<CommsRoom[]>([DEFAULT_ROOM])
  const [activeRoomId, setActiveRoomId] = useState(DEFAULT_ROOM.id)
  const [textChannels, setTextChannels] = useState<TextChannel[]>(() =>
    mergeTextChannels([], DEFAULT_COMMS_ROOM_ID)
  )
  const [voiceChannels, setVoiceChannels] = useState<VoiceChannel[]>([])
  const [selectedTextChannelId, setSelectedTextChannelId] = useState(() =>
    getDefaultTextChannelId(DEFAULT_COMMS_ROOM_ID)
  )
  const [selectedVoiceChannel, setSelectedVoiceChannel] = useState<VoiceChannel | null>(null)
  const [mainPane, setMainPane] = useState<'text' | 'voice'>('text')
  const [loadingChannels, setLoadingChannels] = useState(true)
  const prevActiveRoomIdRef = useRef<string | null>(null)
  const channelsRequestRef = useRef(0)
  const callsRequestRef = useRef(0)
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [showCreateVoice, setShowCreateVoice] = useState(false)
  const [newVoiceTitle, setNewVoiceTitle] = useState('')
  const [joiningVoice, setJoiningVoice] = useState(false)
  const [livekitConfigured, setLivekitConfigured] = useState<boolean | null>(null)
  const [showCreateText, setShowCreateText] = useState(false)
  const [newTextChannelName, setNewTextChannelName] = useState('')
  const [creatingTextChannel, setCreatingTextChannel] = useState(false)
  const [editRoomOpen, setEditRoomOpen] = useState(false)
  const [editRoomName, setEditRoomName] = useState('')
  const [deleteRoomOpen, setDeleteRoomOpen] = useState(false)
  const [editChannelOpen, setEditChannelOpen] = useState(false)
  const [editChannelTarget, setEditChannelTarget] = useState<TextChannel | null>(null)
  const [editChannelName, setEditChannelName] = useState('')
  const [editChannelDescription, setEditChannelDescription] = useState('')
  const [deleteChannelOpen, setDeleteChannelOpen] = useState(false)
  const [deleteChannelTarget, setDeleteChannelTarget] = useState<TextChannel | null>(null)
  const [savingChannel, setSavingChannel] = useState(false)

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? DEFAULT_ROOM
  const isCustomRoom = activeRoomId !== DEFAULT_ROOM.id

  const loadCalls = useCallback((commsRoomId: string) => {
    const requestId = ++callsRequestRef.current
    const params = new URLSearchParams({ commsRoomId })
    fetch(`/api/calls?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (requestId !== callsRequestRef.current) return
        if (data.error) return
        setLivekitConfigured(Boolean(data.livekitConfigured))
        const activeRooms = (data.rooms ?? []) as Array<{
          id: string
          title: string | null
          type: string
          createdBy: { name: string }
        }>

        setVoiceChannels(
          activeRooms
            .filter((r) => r.title !== 'Salinha Link System')
            .map((r) => ({
              id: `voice-${r.id}`,
              name: r.title ?? 'Call',
              kind: 'room' as const,
              roomId: r.id,
              callType: r.type === 'audio' ? ('audio' as const) : ('video' as const),
              live: true,
              hostName: r.createdBy.name,
            }))
        )
      })
      .catch(() => {})
  }, [])

  const loadTextChannels = useCallback((commsRoomId: string) => {
    const requestId = ++channelsRequestRef.current
    setLoadingChannels(true)
    const params = new URLSearchParams({ commsRoomId })
    fetch(`/api/team/channels?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (requestId !== channelsRequestRef.current) return
        const channels = mergeTextChannels(
          (data.channels ?? []).map(
            (c: { id: string; name: string; description?: string; unreadCount?: number }) => ({
              id: c.id,
              name: c.name,
              description: c.description,
              unreadCount: c.unreadCount ?? 0,
            })
          ),
          commsRoomId
        )
        setTextChannels(channels)
        setSelectedTextChannelId((prev) => {
          const defaultId = getDefaultTextChannelId(commsRoomId)
          return channels.some((c) => c.id === prev) ? prev : defaultId
        })
      })
      .catch(() => toast.error('Erro ao carregar canais'))
      .finally(() => {
        if (requestId === channelsRequestRef.current) {
          setLoadingChannels(false)
        }
      })
  }, [])

  useEffect(() => {
    setRooms([DEFAULT_ROOM, ...loadCustomRooms()])
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) router.push('/auth/signin')
  }, [session, status, router])

  useEffect(() => {
    const roomChanged = prevActiveRoomIdRef.current !== activeRoomId
    if (roomChanged) {
      prevActiveRoomIdRef.current = activeRoomId
      setSelectedTextChannelId(getDefaultTextChannelId(activeRoomId))
      setSelectedVoiceChannel(null)
      setMainPane('text')
      setTextChannels(mergeTextChannels([], activeRoomId))
      setVoiceChannels([])
    }

    loadTextChannels(activeRoomId)
    loadCalls(activeRoomId)
    const interval = setInterval(() => loadCalls(activeRoomId), 30_000)
    return () => clearInterval(interval)
  }, [activeRoomId, loadTextChannels, loadCalls])

  useEffect(() => {
    if (mainPane !== 'voice' || !selectedVoiceChannel) return
    const exists = voiceChannels.some((v) => v.id === selectedVoiceChannel.id)
    if (!exists) {
      setSelectedVoiceChannel(null)
      setMainPane('text')
    }
  }, [voiceChannels, mainPane, selectedVoiceChannel])

  const activeTextChannel = useMemo(
    () =>
      textChannels.find((c) => c.id === selectedTextChannelId) ??
      textChannels.find((c) => c.id === getDefaultTextChannelId(activeRoomId)) ??
      null,
    [selectedTextChannelId, textChannels, activeRoomId]
  )

  const channelNamesById = useMemo(
    () => Object.fromEntries(textChannels.map((c) => [c.id, c.name])),
    [textChannels]
  )

  const activeTextChannelId = mainPane === 'text' ? selectedTextChannelId : null

  const selectTextChannel = (channelId: string) => {
    setSelectedTextChannelId(channelId)
    setMainPane('text')
  }

  const selectVoiceChannel = (channel: VoiceChannel) => {
    setSelectedVoiceChannel(channel)
    setMainPane('voice')
  }

  const addRoom = () => {
    const name = newRoomName.trim()
    if (!name) return
    const id = `room-${Date.now()}`
    const initial = name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2) || 'S'
    const next = [...rooms.filter((r) => r.id !== id), { id, name, initial }]
    setRooms(next)
    saveCustomRooms(next.filter((r) => r.id !== DEFAULT_ROOM.id))
    setActiveRoomId(id)
    setNewRoomName('')
    setCreatingRoom(false)
  }

  const openEditRoom = () => {
    setEditRoomName(activeRoom.name)
    setEditRoomOpen(true)
  }

  const saveRoomEdit = () => {
    const name = editRoomName.trim()
    if (!name || !isCustomRoom) return
    const initial = name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2) || 'S'
    const next = rooms.map((r) =>
      r.id === activeRoomId ? { ...r, name, initial } : r
    )
    setRooms(next)
    saveCustomRooms(next.filter((r) => r.id !== DEFAULT_ROOM.id))
    setEditRoomOpen(false)
    toast.success('Sala atualizada')
  }

  const confirmDeleteRoom = () => {
    if (!isCustomRoom) return
    const next = rooms.filter((r) => r.id !== activeRoomId)
    setRooms(next)
    saveCustomRooms(next.filter((r) => r.id !== DEFAULT_ROOM.id))
    setActiveRoomId(DEFAULT_ROOM.id)
    setDeleteRoomOpen(false)
    toast.success('Sala excluída')
  }

  const createTextChannel = async () => {
    const name = newTextChannelName.trim()
    if (!name || creatingTextChannel) return
    setCreatingTextChannel(true)
    try {
      const res = await fetch('/api/team/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, commsRoomId: activeRoomId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao criar canal')
        return
      }
      const channel = data.channel as TextChannel
      setTextChannels((prev) =>
        mergeTextChannels([...prev, { ...channel, unreadCount: 0 }], activeRoomId)
      )
      selectTextChannel(channel.id)
      setNewTextChannelName('')
      setShowCreateText(false)
      toast.success('Canal criado')
    } catch {
      toast.error('Erro de rede ao criar canal')
    } finally {
      setCreatingTextChannel(false)
    }
  }

  const openEditChannel = (channel: TextChannel) => {
    setEditChannelTarget(channel)
    setEditChannelName(channel.name)
    setEditChannelDescription(channel.description ?? '')
    setEditChannelOpen(true)
  }

  const saveChannelEdit = async () => {
    if (!editChannelTarget || savingChannel) return
    const name = editChannelName.trim()
    if (!name) return
    setSavingChannel(true)
    try {
      const res = await fetch(`/api/team/channels/${editChannelTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: editChannelDescription.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao atualizar canal')
        return
      }
      const updated = data.channel as TextChannel
      setTextChannels((prev) =>
        prev.map((c) =>
          c.id === updated.id
            ? { ...c, name: updated.name, description: updated.description ?? undefined }
            : c
        )
      )
      setEditChannelOpen(false)
      setEditChannelTarget(null)
      toast.success('Canal atualizado')
    } catch {
      toast.error('Erro de rede ao atualizar canal')
    } finally {
      setSavingChannel(false)
    }
  }

  const confirmDeleteChannel = async () => {
    if (!deleteChannelTarget || savingChannel) return
    setSavingChannel(true)
    try {
      const res = await fetch(`/api/team/channels/${deleteChannelTarget.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao excluir canal')
        return
      }
      setTextChannels((prev) => {
        const next = prev.filter((c) => c.id !== deleteChannelTarget.id)
        if (selectedTextChannelId === deleteChannelTarget.id) {
          const fallback =
            next.find((c) => c.id === getDefaultTextChannelId(activeRoomId)) ?? next[0]
          if (fallback) {
            setSelectedTextChannelId(fallback.id)
            setMainPane('text')
          }
        }
        return mergeTextChannels(next, activeRoomId)
      })
      setDeleteChannelOpen(false)
      setDeleteChannelTarget(null)
      toast.success('Canal excluído')
    } catch {
      toast.error('Erro de rede ao excluir canal')
    } finally {
      setSavingChannel(false)
    }
  }

  const createCall = async (type: 'audio' | 'video', title?: string) => {
    const res = await fetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title?.trim() || (type === 'audio' ? 'Chamada de voz' : 'Reunião'),
        type,
        channelId: selectedTextChannelId,
        commsRoomId: activeRoomId,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Erro ao criar call')
      return null
    }
    return data.joinPath as string
  }

  const joinVoice = async () => {
    if (!selectedVoiceChannel || joiningVoice) return
    setJoiningVoice(true)
    try {
      if (selectedVoiceChannel.roomId) {
        goToCall(`/team/call/${selectedVoiceChannel.roomId}`)
        return
      }

      const path = await createCall(selectedVoiceChannel.callType ?? 'video', selectedVoiceChannel.name)
      if (path) goToCall(path)
    } catch {
      toast.error('Erro de rede')
    } finally {
      setJoiningVoice(false)
    }
  }

  const startNewVoice = async (type: 'audio' | 'video') => {
    setJoiningVoice(true)
    try {
      const path = await createCall(type, newVoiceTitle)
      if (path) {
        setShowCreateVoice(false)
        setNewVoiceTitle('')
        goToCall(path)
      }
    } finally {
      setJoiningVoice(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingAnimation size="lg" />
      </div>
    )
  }

  return (
    <div className="team-comms">
      <TeamChatNotificationListener
        channelIds={textChannels.map((c) => c.id)}
        channelNamesById={channelNamesById}
        activeChannelId={activeTextChannelId}
      />
      {/* Coluna 1 — Salas */}
      <aside className="team-comms__rail">
        {rooms.map((room) => (
          <button
            key={room.id}
            type="button"
            title={room.name}
            onClick={() => setActiveRoomId(room.id)}
            className={cn(
              'team-comms__room-btn',
              activeRoomId === room.id && 'team-comms__room-btn--active'
            )}
          >
            {room.initial}
          </button>
        ))}

        <div className="team-comms__rail-sep" />

        {creatingRoom ? (
          <div className="flex w-[56px] flex-col gap-1 px-1">
            <input
              autoFocus
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addRoom()
                if (e.key === 'Escape') setCreatingRoom(false)
              }}
              placeholder="Nome"
              className="team-comms__room-create-input"
            />
            <button type="button" onClick={addRoom} className="team-comms__room-create-ok">
              OK
            </button>
          </div>
        ) : (
          <button
            type="button"
            title="Criar sala"
            onClick={() => setCreatingRoom(true)}
            className="team-comms__room-btn team-comms__room-btn--add"
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
      </aside>

      {/* Coluna 2 — Canais */}
      <aside className="team-comms__sidebar">
        <div className="team-comms__sidebar-header">
          <span className="min-w-0 flex-1 truncate">{activeRoom.name}</span>
          <div className="flex shrink-0 items-center gap-0.5">
            {isCustomRoom ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="team-comms__header-menu-btn"
                    aria-label="Opções da sala"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={openEditRoom}>
                    <Pencil className="h-4 w-4" />
                    Editar sala
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteRoomOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir sala
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="team-comms__header-menu-btn"
                  aria-label="Configurar alertas do chat"
                >
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" side="bottom" className="w-80 p-0">
                <TeamChatNotificationSettings />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="team-comms__channels">
          <div className="team-comms__section-label">
            <span>Canais de texto</span>
            <button
              type="button"
              onClick={() => setShowCreateText((v) => !v)}
              className="opacity-60 hover:opacity-100"
              aria-label="Novo canal"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {showCreateText ? (
            <div className="team-comms__create-voice">
              <input
                autoFocus
                value={newTextChannelName}
                onChange={(e) => setNewTextChannelName(e.target.value)}
                placeholder="Nome do canal"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void createTextChannel()
                  if (e.key === 'Escape') setShowCreateText(false)
                }}
              />
              <div className="team-comms__create-voice-actions">
                <button
                  type="button"
                  className="primary"
                  disabled={creatingTextChannel || !newTextChannelName.trim()}
                  onClick={() => void createTextChannel()}
                >
                  {creatingTextChannel ? 'Criando…' : 'Criar'}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setShowCreateText(false)
                    setNewTextChannelName('')
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ) : null}

          {loadingChannels ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          {textChannels.map((channel) => {
              const isActive =
                mainPane === 'text' && selectedTextChannelId === channel.id
              const canManage = !isDefaultTeamChannel(channel.id, activeRoomId)

              return (
                <div
                  key={channel.id}
                  className={cn(
                    'team-comms__channel-row',
                    isActive && 'team-comms__channel-row--active'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => selectTextChannel(channel.id)}
                    className={cn(
                      'team-comms__channel team-comms__channel--flex',
                      isActive && 'team-comms__channel--active'
                    )}
                  >
                    <Hash className="h-5 w-5 shrink-0 opacity-70" />
                    <span className="truncate">{channel.name}</span>
                    {channel.unreadCount > 0 ? (
                      <span className="team-comms__unread">{channel.unreadCount}</span>
                    ) : null}
                  </button>
                  {canManage ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="team-comms__channel-menu-btn"
                          aria-label={`Opções de #${channel.name}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => openEditChannel(channel)}>
                          <Pencil className="h-4 w-4" />
                          Editar canal
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => {
                            setDeleteChannelTarget(channel)
                            setDeleteChannelOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir canal
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              )
            })
          }

          <div className="team-comms__section-label mt-2">
            <span>Calls</span>
            <button
              type="button"
              onClick={() => setShowCreateVoice((v) => !v)}
              className="opacity-60 hover:opacity-100"
              aria-label="Nova call"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {showCreateVoice ? (
            <div className="team-comms__create-voice">
              <input
                value={newVoiceTitle}
                onChange={(e) => setNewVoiceTitle(e.target.value)}
                placeholder="Nome da sala (opcional)"
              />
              <div className="team-comms__create-voice-actions">
                <button
                  type="button"
                  className="primary"
                  disabled={joiningVoice}
                  onClick={() => startNewVoice('video')}
                >
                  Vídeo
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={joiningVoice}
                  onClick={() => startNewVoice('audio')}
                >
                  Áudio
                </button>
                <button type="button" className="secondary" onClick={() => setShowCreateVoice(false)}>
                  ✕
                </button>
              </div>
            </div>
          ) : null}

          {voiceChannels.map((channel) => (
            <button
              key={channel.id}
              type="button"
              onClick={() => selectVoiceChannel(channel)}
              className={cn(
                'team-comms__channel team-comms__channel--voice',
                channel.live && 'team-comms__channel--live',
                mainPane === 'voice' &&
                  selectedVoiceChannel?.id === channel.id &&
                  'team-comms__channel--active'
              )}
            >
              <Volume2 className="h-5 w-5 shrink-0 opacity-70" />
              <span className="truncate">{channel.name}</span>
              {channel.live ? <span className="team-comms__live-dot ml-auto" /> : null}
            </button>
          ))}
        </div>

        <div className="team-comms__user-bar">
          <Avatar className="h-8 w-8">
            <AvatarImage src={session?.user?.image ?? undefined} />
            <AvatarFallback className="bg-primary text-xs text-primary-foreground">
              {session?.user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">{session?.user?.name}</p>
            <p className="team-comms__online">Online</p>
          </div>
          <button type="button" className="team-comms__icon-btn">
            <Mic className="h-4 w-4" />
          </button>
          <button type="button" className="team-comms__icon-btn">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Coluna 3 — Conteúdo */}
      <main className="team-comms__main">
        {mainPane === 'text' && activeTextChannel ? (
          <TeamChatPanel
            key={`${activeRoomId}:${activeTextChannel.id}`}
            mode="main"
            channelId={activeTextChannel.id}
            channelName={activeTextChannel.name}
            channelDescription={activeTextChannel.description}
            commsRoomId={activeRoomId}
          />
        ) : mainPane === 'voice' && selectedVoiceChannel ? (
          <>
            <header className="team-comms__main-header">
              <h2>
                <Volume2 className="h-5 w-5 text-muted-foreground" />
                {selectedVoiceChannel.name}
              </h2>
              <div className="flex items-center gap-2">
                {selectedVoiceChannel.live ? (
                  <span className="team-comms__live-label">
                    <span className="team-comms__live-dot" />
                    Ao vivo
                  </span>
                ) : null}
                <button type="button" className="team-comms__icon-btn">
                  <Users className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="team-comms__voice-lobby">
              <Volume2 className="team-comms__voice-icon" />
              <h3>{selectedVoiceChannel.name}</h3>
              <p>
                {selectedVoiceChannel.live
                  ? selectedVoiceChannel.hostName
                    ? `${selectedVoiceChannel.hostName} está na call`
                    : 'Alguém está na call agora'
                  : 'Ninguém está em voz'}
              </p>
              {livekitConfigured === false ? (
                <p className="max-w-md text-xs text-amber-400">
                  LiveKit não detectado. Rode <code>npm run call:up</code> e reinicie o dev server.
                </p>
              ) : null}
              <button
                type="button"
                disabled={joiningVoice}
                onClick={joinVoice}
                className="team-comms__join-btn"
              >
                {joiningVoice ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrando…
                  </>
                ) : (
                  <>
                    {selectedVoiceChannel.callType === 'audio' ? (
                      <Mic className="h-4 w-4" />
                    ) : (
                      <Video className="h-4 w-4" />
                    )}
                    Entrar na chamada de voz
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="team-comms__empty">Selecione um canal</div>
        )}
      </main>

      <Dialog open={editRoomOpen} onOpenChange={setEditRoomOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar sala</DialogTitle>
            <DialogDescription>Altere o nome desta sala personalizada.</DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={editRoomName}
            onChange={(e) => setEditRoomName(e.target.value)}
            className="team-comms__dialog-input"
            placeholder="Nome da sala"
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveRoomEdit()
            }}
          />
          <DialogFooter>
            <button type="button" className="team-comms__dialog-btn secondary" onClick={() => setEditRoomOpen(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="team-comms__dialog-btn primary"
              disabled={!editRoomName.trim()}
              onClick={saveRoomEdit}
            >
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteRoomOpen} onOpenChange={setDeleteRoomOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sala?</AlertDialogTitle>
            <AlertDialogDescription>
              A sala <strong>{activeRoom.name}</strong> será removida. Os canais de texto não são
              apagados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRoom}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editChannelOpen} onOpenChange={setEditChannelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar canal</DialogTitle>
            <DialogDescription>Atualize o nome e a descrição do canal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <input
              autoFocus
              value={editChannelName}
              onChange={(e) => setEditChannelName(e.target.value)}
              className="team-comms__dialog-input"
              placeholder="Nome do canal"
            />
            <input
              value={editChannelDescription}
              onChange={(e) => setEditChannelDescription(e.target.value)}
              className="team-comms__dialog-input"
              placeholder="Descrição (opcional)"
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              className="team-comms__dialog-btn secondary"
              onClick={() => setEditChannelOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="team-comms__dialog-btn primary"
              disabled={!editChannelName.trim() || savingChannel}
              onClick={() => void saveChannelEdit()}
            >
              {savingChannel ? 'Salvando…' : 'Salvar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteChannelOpen} onOpenChange={setDeleteChannelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir canal?</AlertDialogTitle>
            <AlertDialogDescription>
              O canal <strong>#{deleteChannelTarget?.name}</strong> e todas as mensagens serão
              removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingChannel}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={savingChannel} onClick={() => void confirmDeleteChannel()}>
              {savingChannel ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function TeamCommsView() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <LoadingAnimation size="lg" />
        </div>
      }
    >
      <TeamCommsContent />
    </Suspense>
  )
}

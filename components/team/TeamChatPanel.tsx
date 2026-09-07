"use client"

import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { LoadingAnimation } from '@/components/ui/loading-animation'
import { TeamChatMainView } from '@/components/team/TeamChatMainView'
import {
  Send,
  Paperclip,
  Smile,
  Search,
  Phone,
  Video,
  MoreVertical,
  Users,
  Hash,
  Plus,
  Settings,
  Bell,
  BellOff
} from "lucide-react"
import toast from "react-hot-toast"

interface User {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
  isOnline: boolean
  lastSeen?: string
}

interface Channel {
  id: string
  name: string
  type: 'GENERAL' | 'PROJECT' | 'DIRECT'
  description?: string
  projectId?: string
  participants: User[]
  unreadCount: number
  lastMessage?: {
    content: string
    createdAt: string
    author: User
  }
}

interface Message {
  id: string
  content: string
  createdAt: string
  author: User
  channelId: string
  type: 'TEXT' | 'FILE' | 'IMAGE'
  fileUrl?: string
  fileName?: string
  edited?: boolean
  editedAt?: string
}

type TeamChatPanelProps = {
  mode?: 'full' | 'main'
  channelId?: string
  channelName?: string
  channelDescription?: string
  commsRoomId?: string
}

export function TeamChatPanel({
  mode = 'full',
  channelId: externalChannelId,
  channelName: externalChannelName,
  channelDescription: externalChannelDescription,
  commsRoomId,
}: TeamChatPanelProps = {}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const isMain = mode === 'main'
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(!isMain)
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showUserList, setShowUserList] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resolvedChannelId = isMain ? externalChannelId : activeChannel?.id
  const resolvedChannelName = isMain ? externalChannelName : activeChannel?.name
  const resolvedChannelDescription = isMain
    ? externalChannelDescription
    : activeChannel?.description

  useEffect(() => {
    if (isMain || status === 'loading') return
    fetchChannels()
  }, [session, status, isMain])

  useEffect(() => {
    if (isMain && externalChannelId) {
      fetchMessages(externalChannelId)
      return
    }
    if (activeChannel) {
      fetchMessages(activeChannel.id)
    }
  }, [activeChannel, externalChannelId, isMain])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const fetchChannels = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/team/channels')
      
      if (!response.ok) {
        throw new Error('Falha ao carregar canais')
      }
      
      const data = await response.json()
      setChannels(data.channels)
      
      // Selecionar o canal geral por padrão
      const generalChannel = data.channels.find((c: Channel) => c.type === 'GENERAL')
      if (generalChannel) {
        setActiveChannel(generalChannel)
      }
    } catch (error) {
      console.error('Erro ao buscar canais:', error)
      toast.error('Erro ao carregar canais')
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (channelId: string) => {
    try {
      const response = await fetch(`/api/team/channels/${channelId}/messages`)
      
      if (!response.ok) {
        throw new Error('Falha ao carregar mensagens')
      }
      
      const data = await response.json()
      setMessages(data.messages)
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error)
      toast.error('Erro ao carregar mensagens')
    }
  }

  const [startingCall, setStartingCall] = useState(false)

  const startCall = async (type: 'audio' | 'video') => {
    const channelId = resolvedChannelId
    const channelName = resolvedChannelName
    if (!channelId || !channelName || startingCall) return
    setStartingCall(true)
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: channelName,
          channelId,
          commsRoomId,
          type,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao iniciar call')
        return
      }
      router.push(data.joinPath)
    } catch {
      toast.error('Erro de rede ao iniciar call')
    } finally {
      setStartingCall(false)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.trim() || !resolvedChannelId || sending) {
      return
    }

    try {
      setSending(true)
      const response = await fetch(`/api/team/channels/${resolvedChannelId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: newMessage.trim(),
          type: 'TEXT'
        })
      })
      
      if (!response.ok) {
        throw new Error('Falha ao enviar mensagem')
      }
      
      const data = await response.json()
      setMessages(prev => [...prev, data.message])
      setNewMessage('')
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      toast.error('Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !resolvedChannelId) return

    // Implementar upload de arquivo
    toast.success('Upload de arquivos será implementado em breve')
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem'
    } else {
      return date.toLocaleDateString('pt-BR')
    }
  }

  const getChannelIcon = (channel: Channel) => {
    switch (channel.type) {
      case 'GENERAL':
        return <Hash className="h-4 w-4" />
      case 'PROJECT':
        return <Hash className="h-4 w-4" />
      case 'DIRECT':
        return <Users className="h-4 w-4" />
      default:
        return <Hash className="h-4 w-4" />
    }
  }

  if (isMain && externalChannelId && externalChannelName) {
    return (
      <TeamChatMainView
        key={externalChannelId}
        channelId={externalChannelId}
        channelName={externalChannelName}
        channelDescription={externalChannelDescription}
        commsRoomId={commsRoomId}
      />
    )
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingAnimation size="lg" />
      </div>
    )
  }

  const chatHeader = (
    <div
      className={
        isMain
          ? 'team-comms__main-header'
          : 'border-b border-muted bg-card px-6 py-4'
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center">
          <Hash className={isMain ? 'h-5 w-5 text-muted-foreground' : 'h-4 w-4'} />
          <h3
            className={
              isMain
                ? 'ml-2 truncate text-base font-semibold text-foreground'
                : 'ml-2 text-lg font-semibold text-foreground'
            }
          >
            {resolvedChannelName}
          </h3>
          {resolvedChannelDescription ? (
            <span
              className={
                isMain
                  ? 'ml-2 hidden truncate text-sm text-muted-foreground sm:inline'
                  : 'ml-2 text-sm text-muted-foreground'
              }
            >
              {resolvedChannelDescription}
            </span>
          ) : null}
        </div>
        <div className="flex items-center space-x-1">
          {!isMain ? (
            <button
              onClick={() => setShowUserList(!showUserList)}
              className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-muted-foreground"
            >
              <Users className="h-5 w-5" />
            </button>
          ) : null}
          <button
            type="button"
            disabled={startingCall}
            onClick={() => startCall('audio')}
            className={
              isMain
                ? 'team-comms__icon-btn disabled:opacity-50'
                : 'rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-muted-foreground disabled:opacity-50'
            }
            title="Chamada de voz"
          >
            <Phone className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={startingCall}
            onClick={() => startCall('video')}
            className={
              isMain
                ? 'team-comms__icon-btn disabled:opacity-50'
                : 'rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-muted-foreground disabled:opacity-50'
            }
            title="Reunião com vídeo"
          >
            <Video className="h-5 w-5" />
          </button>
          {!isMain ? (
            <button className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-muted-foreground">
              <MoreVertical className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )

  const chatMessages = resolvedChannelId ? (
    <>
      <div
        className={
          isMain
            ? 'flex-1 space-y-4 overflow-y-auto px-4 py-4'
            : 'flex-1 space-y-4 overflow-y-auto p-4'
        }
      >
        {messages.map((message, index) => {
          const showDate =
            index === 0 ||
            formatDate(messages[index - 1].createdAt) !== formatDate(message.createdAt)

          return (
            <div key={message.id}>
              {showDate ? (
                <div className="my-4 flex items-center justify-center">
                  <div className={isMain ? 'team-comms__date-pill' : 'rounded-full bg-gray-100 px-3 py-1'}>
                    <span className={isMain ? '' : 'text-xs text-muted-foreground'}>
                      {formatDate(message.createdAt)}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="flex items-start space-x-3">
                <div
                  className={
                    isMain
                      ? 'team-comms__avatar'
                      : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500'
                  }
                >
                  <span className={isMain ? '' : 'text-sm font-medium text-white'}>
                    {message.author.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className={isMain ? 'team-comms__message-author' : 'text-sm font-medium text-foreground'}>
                      {message.author.name}
                    </span>
                    <span className={isMain ? 'team-comms__message-time' : 'text-xs text-muted-foreground'}>
                      {formatTime(message.createdAt)}
                    </span>
                    {message.edited ? (
                      <span className="text-xs text-muted-foreground">(editado)</span>
                    ) : null}
                  </div>
                  <p className={isMain ? 'team-comms__message-body' : 'mt-1 whitespace-pre-wrap text-sm text-gray-700'}>
                    {message.content}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className={isMain ? 'border-t border-border px-4 py-4' : 'border-t border-muted bg-card px-4 py-4'}>
        <form onSubmit={sendMessage} className="flex items-end space-x-2">
          <div className="flex-1">
            <div className="relative">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Mensagem em #${resolvedChannelName}`}
                className={
                  isMain
                    ? 'team-comms__chat-input'
                    : 'w-full resize-none rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'
                }
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage(e)
                  }
                }}
              />
              {!isMain ? (
                <div className="absolute bottom-2 right-2 flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1 text-gray-400 hover:text-muted-foreground"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button type="button" className="p-1 text-gray-400 hover:text-muted-foreground">
                    <Smile className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className={
              isMain
                ? 'team-comms__send-btn'
                : 'rounded-md bg-indigo-600 p-2 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50'
            }
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        {!isMain ? (
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
        ) : null}
      </div>
    </>
  ) : (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <Hash className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-foreground">Selecione um canal</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha um canal para começar a conversar
        </p>
      </div>
    </div>
  )

  if (isMain) {
    return null
  }

  return (
    <div className="flex h-full overflow-hidden">
        {/* Sidebar - Canais */}
        <div className="w-64 bg-card border-r border-muted flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-muted">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Chat da Equipe</h2>
              <button className="p-1 text-gray-400 hover:text-muted-foreground">
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-muted">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar canais..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Channels List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Canais
                </h3>
                <button className="p-1 text-gray-400 hover:text-muted-foreground">
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              
              <div className="space-y-1">
                {channels
                  .filter(channel => 
                    channel.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => setActiveChannel(channel)}
                      className={`w-full flex items-center px-2 py-2 text-sm rounded-md transition-colors ${
                        activeChannel?.id === channel.id
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center flex-1 min-w-0">
                        {getChannelIcon(channel)}
                        <span className="ml-2 truncate">{channel.name}</span>
                      </div>
                      {channel.unreadCount > 0 && (
                        <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[1.25rem] text-center">
                          {channel.unreadCount}
                        </span>
                      )}
                    </button>
                  ))
                }
              </div>
            </div>
          </div>

          {/* User Status */}
          <div className="p-3 border-t border-muted">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {session?.user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="ml-2 flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {session?.user?.name}
                </p>
                <p className="text-xs text-green-600">Online</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {activeChannel ? (
            <>
              {/* Chat Header */}
              <div className="px-6 py-4 border-b border-muted bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getChannelIcon(activeChannel)}
                    <h3 className="ml-2 text-lg font-semibold text-foreground">
                      {activeChannel.name}
                    </h3>
                    {activeChannel.description && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        {activeChannel.description}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowUserList(!showUserList)}
                      className="p-2 text-gray-400 hover:text-muted-foreground rounded-md hover:bg-gray-100"
                    >
                      <Users className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      disabled={startingCall}
                      onClick={() => startCall('audio')}
                      className="p-2 text-gray-400 hover:text-muted-foreground rounded-md hover:bg-gray-100 disabled:opacity-50"
                      title="Chamada de voz"
                    >
                      <Phone className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      disabled={startingCall}
                      onClick={() => startCall('video')}
                      className="p-2 text-gray-400 hover:text-muted-foreground rounded-md hover:bg-gray-100 disabled:opacity-50"
                      title="Reunião com vídeo"
                    >
                      <Video className="h-5 w-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-muted-foreground rounded-md hover:bg-gray-100">
                      <MoreVertical className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message, index) => {
                  const showDate = index === 0 || 
                    formatDate(messages[index - 1].createdAt) !== formatDate(message.createdAt)
                  
                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div className="flex items-center justify-center my-4">
                          <div className="bg-gray-100 px-3 py-1 rounded-full">
                            <span className="text-xs text-muted-foreground">
                              {formatDate(message.createdAt)}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm font-medium">
                            {message.author.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-foreground">
                              {message.author.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(message.createdAt)}
                            </span>
                            {message.edited && (
                              <span className="text-xs text-gray-400">(editado)</span>
                            )}
                          </div>
                          <div className="mt-1">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                              {message.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="px-4 py-4 border-t border-muted bg-card">
                <form onSubmit={sendMessage} className="flex items-end space-x-2">
                  <div className="flex-1">
                    <div className="relative">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={`Mensagem para #${activeChannel.name}`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        rows={1}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendMessage(e)
                          }
                        }}
                      />
                      <div className="absolute right-2 bottom-2 flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1 text-gray-400 hover:text-muted-foreground"
                        >
                          <Paperclip className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="p-1 text-gray-400 hover:text-muted-foreground"
                        >
                          <Smile className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Hash className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-foreground">
                  Selecione um canal
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Escolha um canal para começar a conversar
                </p>
              </div>
            </div>
          )}
        </div>

        {/* User List Sidebar */}
        {showUserList && activeChannel && (
          <div className="w-64 bg-card border-l border-muted">
            <div className="p-4 border-b border-muted">
              <h3 className="text-sm font-semibold text-foreground">
                Membros ({activeChannel.participants.length})
              </h3>
            </div>
            <div className="p-3 space-y-2">
              {activeChannel.participants.map((user) => (
                <div key={user.id} className="flex items-center space-x-2">
                  <div className="relative">
                    <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    {user.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user.isOnline ? 'Online' : user.lastSeen ? `Visto ${user.lastSeen}` : 'Offline'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
  )
}
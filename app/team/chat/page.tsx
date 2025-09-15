"use client"

import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
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
import { DashboardLayout } from "@/components/layout/dashboard-layout"
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

export default function TeamChatPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showUserList, setShowUserList] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    fetchChannels()
  }, [session, status, router])

  useEffect(() => {
    if (activeChannel) {
      fetchMessages(activeChannel.id)
    }
  }, [activeChannel])

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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.trim() || !activeChannel || sending) {
      return
    }

    try {
      setSending(true)
      const response = await fetch(`/api/team/channels/${activeChannel.id}/messages`, {
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
    if (!file || !activeChannel) return

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

  if (status === "loading" || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)] bg-white rounded-lg shadow overflow-hidden">
        {/* Sidebar - Canais */}
        <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Chat da Equipe</h2>
              <button className="p-1 text-gray-400 hover:text-gray-600">
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-gray-200">
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
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Canais
                </h3>
                <button className="p-1 text-gray-400 hover:text-gray-600">
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
          <div className="p-3 border-t border-gray-200">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {session?.user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="ml-2 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
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
              <div className="px-6 py-4 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getChannelIcon(activeChannel)}
                    <h3 className="ml-2 text-lg font-semibold text-gray-900">
                      {activeChannel.name}
                    </h3>
                    {activeChannel.description && (
                      <span className="ml-2 text-sm text-gray-500">
                        {activeChannel.description}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowUserList(!showUserList)}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                    >
                      <Users className="h-5 w-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
                      <Phone className="h-5 w-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
                      <Video className="h-5 w-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
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
                            <span className="text-xs text-gray-600">
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
                            <span className="text-sm font-medium text-gray-900">
                              {message.author.name}
                            </span>
                            <span className="text-xs text-gray-500">
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
              <div className="px-4 py-4 border-t border-gray-200 bg-white">
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
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <Paperclip className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="p-1 text-gray-400 hover:text-gray-600"
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
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Selecione um canal
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Escolha um canal para começar a conversar
                </p>
              </div>
            </div>
          )}
        </div>

        {/* User List Sidebar */}
        {showUserList && activeChannel && (
          <div className="w-64 bg-gray-50 border-l border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">
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
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {user.isOnline ? 'Online' : user.lastSeen ? `Visto ${user.lastSeen}` : 'Offline'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
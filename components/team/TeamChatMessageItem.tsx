'use client'

import { Download, ExternalLink, FileText, Paperclip } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  formatFileSize,
  getAuthorColorClass,
  isImageMime,
  type TeamChatMessage,
} from '@/lib/team-chat'
import { cn } from '@/lib/utils'

type TeamChatMessageItemProps = {
  message: TeamChatMessage
  showHeader: boolean
}

function formatMessageTime(dateString: string) {
  return new Date(dateString).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatHoverTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function renderContent(content: string) {
  const parts = content.split(/(```[\s\S]*?```)/g)
  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const code = part.slice(3, -3).replace(/^\w+\n?/, '')
      return (
        <pre key={index} className="team-chat-code">
          <code>{code}</code>
        </pre>
      )
    }
    if (!part) return null
    return (
      <p key={index} className="team-chat-text whitespace-pre-wrap">
        {part}
      </p>
    )
  })
}

export function TeamChatMessageItem({ message, showHeader }: TeamChatMessageItemProps) {
  const authorColor = getAuthorColorClass(message.author.id)

  return (
    <div className={cn('team-chat-message', !showHeader && 'team-chat-message--compact')}>
      <div className="team-chat-message__gutter">
        <span className="team-chat-message__gutter-time" aria-hidden="true">
          {formatHoverTime(message.createdAt)}
        </span>
        {showHeader ? (
          <Avatar className="team-chat-message__avatar">
            <AvatarImage src={message.author.avatar ?? undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {message.author.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : null}
      </div>

      <div className="team-chat-message__body">
        {showHeader ? (
          <div className="team-chat-message__meta">
            <span className={cn('team-chat-message__author', authorColor)}>{message.author.name}</span>
            <span className="team-chat-message__time">{formatMessageTime(message.createdAt)}</span>
            {message.editedAt ? <span className="team-chat-message__edited">(editado)</span> : null}
          </div>
        ) : null}

        {message.content ? <div className="team-chat-message__content">{renderContent(message.content)}</div> : null}

        {message.attachments.length > 0 ? (
          <div className="team-chat-message__attachments">
            {message.attachments.map((attachment) =>
              isImageMime(attachment.mimeType) ? (
                <a
                  key={attachment.id}
                  href={attachment.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="team-chat-attachment-image"
                >
                  <img src={attachment.fileUrl} alt={attachment.originalName} loading="lazy" />
                </a>
              ) : (
                <div key={attachment.id} className="team-chat-attachment-file">
                  <div className="team-chat-attachment-file__icon">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{attachment.originalName}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(attachment.fileSize)}</p>
                  </div>
                  <div className="team-chat-attachment-file__actions">
                    <a href={attachment.fileUrl} target="_blank" rel="noreferrer" title="Abrir">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <a href={attachment.fileUrl} download={attachment.originalName} title="Baixar">
                      <Download className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              )
            )}
          </div>
        ) : null}

        {message.type === 'FILE' && !message.attachments.length ? (
          <div className="team-chat-attachment-file">
            <Paperclip className="h-4 w-4" />
            <span className="text-sm">Arquivo</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function TeamChatDateSeparator({ label }: { label: string }) {
  return (
    <div className="team-chat-date">
      <span>{label}</span>
    </div>
  )
}

export function formatChatDateLabel(dateString: string) {
  const date = new Date(dateString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Hoje'
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem'
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function isSameAuthorMinute(a: TeamChatMessage, b: TeamChatMessage) {
  if (a.author.id !== b.author.id) return false
  const diff = Math.abs(new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  return diff < 5 * 60 * 1000
}

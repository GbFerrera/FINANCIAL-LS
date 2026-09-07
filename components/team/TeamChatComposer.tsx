'use client'

import { useCallback, useRef, useState } from 'react'
import {
  Eye,
  Loader2,
  Paperclip,
  Plus,
  Send,
  Smile,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatFileSize } from '@/lib/team-chat'

export type PendingAttachment = {
  id: string
  file: File
  previewUrl?: string
}

type UploadedAttachment = {
  originalName: string
  fileName: string
  filePath: string
  fileUrl: string
  fileSize: number
  mimeType: string
}

type TeamChatComposerProps = {
  channelId: string
  channelName: string
  sending: boolean
  onSend: (payload: { content: string; attachments: UploadedAttachment[] }) => Promise<void>
}

function makePendingId() {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function TeamChatComposer({
  channelId,
  channelName,
  sending,
  onSend,
}: TeamChatComposerProps) {
  const [content, setContent] = useState('')
  const [pending, setPending] = useState<PendingAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files)
    if (list.length === 0) return

    setPending((prev) => [
      ...prev,
      ...list.map((file) => ({
        id: makePendingId(),
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      })),
    ])
  }, [])

  const removePending = (id: string) => {
    setPending((prev) => {
      const item = prev.find((p) => p.id === id)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  const uploadFiles = async (items: PendingAttachment[]): Promise<UploadedAttachment[]> => {
    const uploaded: UploadedAttachment[] = []
    for (const item of items) {
      const formData = new FormData()
      formData.append('file', item.file)
      formData.append('channelId', channelId)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha no upload')
      uploaded.push({
        originalName: data.file.originalName,
        fileName: data.file.fileName,
        filePath: data.file.filePath,
        fileUrl: data.file.fileUrl,
        fileSize: data.file.fileSize,
        mimeType: data.file.fileType || item.file.type,
      })
    }
    return uploaded
  }

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if ((!trimmed && pending.length === 0) || sending || uploading) return

    setUploading(true)
    try {
      const attachments = pending.length > 0 ? await uploadFiles(pending) : []
      await onSend({ content: trimmed, attachments })
      setContent('')
      pending.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl)
      })
      setPending([])
      textareaRef.current?.focus()
    } finally {
      setUploading(false)
    }
  }

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = e.clipboardData?.files
    if (files && files.length > 0) {
      e.preventDefault()
      addFiles(files)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  const busy = sending || uploading

  return (
    <div className="team-chat-composer" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      {pending.length > 0 ? (
        <div className="team-chat-composer__previews">
          {pending.map((item) => (
            <div key={item.id} className="team-chat-composer__preview">
              {item.previewUrl ? (
                <img src={item.previewUrl} alt={item.file.name} className="team-chat-composer__thumb" />
              ) : (
                <div className="team-chat-composer__file-chip">
                  <Paperclip className="h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{item.file.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatFileSize(item.file.size)}</p>
                  </div>
                </div>
              )}
              <div className="team-chat-composer__preview-actions">
                {item.previewUrl ? (
                  <a
                    href={item.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="team-chat-composer__preview-btn"
                    title="Visualizar"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                <button
                  type="button"
                  className="team-chat-composer__preview-btn team-chat-composer__preview-btn--danger"
                  onClick={() => removePending(item.id)}
                  title="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <form
        className="team-chat-composer__bar"
        onSubmit={(e) => {
          e.preventDefault()
          void handleSubmit()
        }}
      >
        <button
          type="button"
          className="team-chat-composer__attach"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          aria-label="Anexar arquivo"
        >
          <Plus className="h-5 w-5" />
        </button>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onPaste={onPaste}
          placeholder={`Conversar em #${channelName}`}
          className="team-chat-composer__input"
          rows={1}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSubmit()
            }
          }}
        />

        <div className="team-chat-composer__tools">
          <button type="button" className="team-chat-composer__tool" disabled={busy} aria-label="Emoji">
            <Smile className="h-5 w-5" />
          </button>
          <button
            type="submit"
            disabled={busy || (!content.trim() && pending.length === 0)}
            className={cn('team-chat-composer__send', busy && 'opacity-70')}
            aria-label="Enviar"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,.xml"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </form>
    </div>
  )
}

export type TaskAttachmentMeta = {
  originalName?: string
  name?: string
  fileType?: string
  type?: string
  filePath?: string
  url?: string
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i

export function guessMimeFromName(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (/\.jpe?g$/.test(lower)) return 'image/jpeg'
  return 'application/octet-stream'
}

export function getAttachmentName(a: TaskAttachmentMeta): string {
  return a.originalName || a.name || a.filePath?.split('/').pop() || ''
}

export function getAttachmentMime(a: TaskAttachmentMeta): string {
  const raw = a.fileType || a.type || ''
  if (raw && raw !== 'application/octet-stream') return raw
  return guessMimeFromName(getAttachmentName(a))
}

export function isImageAttachment(a: TaskAttachmentMeta): boolean {
  const mime = getAttachmentMime(a)
  if (mime.startsWith('image/')) return true
  return IMAGE_EXT.test(getAttachmentName(a))
}

export function resolveAttachmentUrl(a: TaskAttachmentMeta): string | null {
  if (a.url) return a.url
  if (a.filePath && !a.filePath.startsWith('blob:')) {
    const raw = a.filePath
    if (raw.startsWith('http') || raw.startsWith('/')) return raw
    return `/api/files/${raw}`
  }
  return null
}

export function parseAttachmentsFromDescription(description?: string | null): TaskAttachmentMeta[] {
  if (!description?.includes('📎 Anexos (')) return []

  const attachments: TaskAttachmentMeta[] = []
  const lines = description.split('\n')
  let inSection = false

  for (const line of lines) {
    if (line.includes('📎 Anexos (')) {
      inSection = true
      continue
    }
    if (inSection && line.startsWith('• ')) {
      const withPath = line.match(/• (.+) \((.+)\) - (.+)$/)
      const basic = line.match(/• (.+) \((.+)\)/)
      if (withPath) {
        attachments.push({
          name: withPath[1],
          type: withPath[2],
          filePath: withPath[3],
        })
      } else if (basic) {
        attachments.push({
          name: basic[1],
          type: basic[2],
          filePath: basic[1],
        })
      }
    } else if (inSection && !line.startsWith('• ')) {
      break
    }
  }

  return attachments
}

export function pickCoverUrl(
  attachments: TaskAttachmentMeta[],
  failedUrl?: string | null
): string | null {
  for (const attachment of attachments) {
    if (!isImageAttachment(attachment)) continue
    const url = resolveAttachmentUrl(attachment)
    if (!url || url === failedUrl) continue
    return url
  }
  return null
}

export function mergeAttachmentDescription(
  existingDescription: string | null | undefined,
  files: Array<{ originalName: string; fileType?: string; filePath: string }>
): string {
  if (files.length === 0) return (existingDescription || '').trim()

  const header = `📎 Anexos (${files.length}):`
  const lines = files.map((f) => {
    const type = f.fileType && f.fileType !== 'application/octet-stream'
      ? f.fileType
      : guessMimeFromName(f.originalName)
    return `• ${f.originalName} (${type}) - ${f.filePath}`
  })

  const parts = (existingDescription || '').split('\n')
  const kept: string[] = []
  let inSection = false

  for (const line of parts) {
    if (line.includes('📎 Anexos (')) {
      inSection = true
      continue
    }
    if (inSection && line.startsWith('• ')) continue
    if (inSection && !line.startsWith('• ')) {
      inSection = false
      if (line.trim() === '') continue
    }
    if (!inSection) kept.push(line)
  }

  const cleaned = kept.join('\n').trim()
  const section = `${header}\n${lines.join('\n')}`
  return cleaned ? `${cleaned}\n\n${section}` : section
}

export function stripAttachmentSectionFromDescription(description?: string | null): string {
  if (!description?.includes('📎 Anexos (')) return (description || '').trim()
  const lines = description.split('\n')
  const clean: string[] = []
  let skip = false
  for (const line of lines) {
    if (line.includes('📎 Anexos (')) {
      skip = true
      continue
    }
    if (skip && line.startsWith('• ')) continue
    if (skip && !line.startsWith('• ')) skip = false
    if (!skip) clean.push(line)
  }
  return clean.join('\n').trim()
}

export function removeAttachmentFromDescription(
  description: string | null | undefined,
  target: { filePath?: string; originalName?: string; fileName?: string }
): string {
  const targetPath = target.filePath || ''
  const targetName =
    target.originalName || target.fileName || targetPath.split('/').pop() || ''

  const remaining = parseAttachmentsFromDescription(description).filter((a) => {
    const name = getAttachmentName(a)
    const fp = a.filePath || ''
    if (targetPath && (fp === targetPath || fp.endsWith(`/${targetName}`))) return false
    if (targetName && (name === targetName || fp.endsWith(`/${targetName}`))) return false
    return true
  })

  const stripped = stripAttachmentSectionFromDescription(description)
  if (remaining.length === 0) return stripped

  return mergeAttachmentDescription(
    stripped,
    remaining.map((a) => ({
      originalName: getAttachmentName(a),
      fileType: getAttachmentMime(a),
      filePath: a.filePath || '',
    }))
  )
}

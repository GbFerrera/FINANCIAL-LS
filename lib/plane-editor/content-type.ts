export function isHtmlContent(content: string): boolean {
  if (!content?.trim()) return false
  return /<\/?[a-z][\s\S]*>/i.test(content)
}

export function isMarkdownContent(content: string): boolean {
  if (!content?.trim()) return false
  if (isHtmlContent(content)) return false
  return /(\*\*|__|\*|_|`|^#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s|\[.+\]\(.+\))/m.test(content)
}

export function normalizeEditorContent(content: string): string {
  if (!content?.trim()) return ''
  if (isHtmlContent(content)) return content
  // Plain text with line breaks — keep as simple HTML paragraphs
  if (!isMarkdownContent(content)) {
    return content
      .split(/\n{2,}/)
      .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
      .join('')
  }
  return content
}

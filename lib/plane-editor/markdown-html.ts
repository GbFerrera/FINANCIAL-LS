import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  breaks: true,
})

export function markdownToHtml(markdown: string): string {
  if (!markdown?.trim()) return ''
  return marked.parse(markdown, { async: false }) as string
}

export function normalizeDescriptionForEditor(content: string): string {
  if (!content?.trim()) return ''
  if (/<\/?[a-z][\s\S]*>/i.test(content)) return content
  return markdownToHtml(content)
}

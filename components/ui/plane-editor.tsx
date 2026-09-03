'use client'

import { useEffect, useMemo, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Typography from '@tiptap/extension-typography'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  ListTodo,
  Link2,
  Code,
  Heading2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { normalizeDescriptionForEditor } from '@/lib/plane-editor/markdown-html'
import { createSlashCommandExtension } from '@/components/ui/plane-editor-slash'

const lowlight = createLowlight(common)

type PlaneEditorProps = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  variant?: 'default' | 'sheet'
  minHeight?: number
  defaultTemplate?: string
  className?: string
  readOnly?: boolean
}

function resolveInitialContent(
  value: string,
  defaultTemplate?: string
): string {
  const raw = value?.trim() ? value : defaultTemplate ?? ''
  return normalizeDescriptionForEditor(raw)
}

export function PlaneEditor({
  value,
  onChange,
  placeholder = 'Clique para adicionar descrição',
  variant = 'default',
  minHeight = 180,
  defaultTemplate,
  className,
  readOnly = false,
}: PlaneEditorProps) {
  const initialContent = useMemo(
    () => resolveInitialContent(value, defaultTemplate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const lastEmitted = useRef(initialContent)

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Typography,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-2',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      createSlashCommandExtension(),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'plane-rich-text min-h-[inherit]',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML()
      lastEmitted.current = html
      onChange(html)
    },
  })

  useEffect(() => {
    if (!editor) return
    const normalized = resolveInitialContent(value, defaultTemplate)
    if (normalized === lastEmitted.current) return
    editor.commands.setContent(normalized, { emitUpdate: false })
    lastEmitted.current = normalized
  }, [editor, value, defaultTemplate])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!readOnly)
  }, [editor, readOnly])

  const shellClass = cn(
    'plane-editor rounded-lg border bg-card transition-colors',
    variant === 'sheet'
      ? 'border-transparent bg-transparent px-0'
      : 'border-border px-3 py-2',
    className
  )

  return (
    <div className={shellClass} style={{ minHeight }}>
      {editor && !readOnly && (
        <BubbleMenu
          editor={editor}
          className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md"
        >
          <ToolbarButton
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            label="Negrito"
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            label="Itálico"
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            label="Sublinhado"
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            label="Tachado"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </ToolbarButton>
          <div className="mx-0.5 h-5 w-px bg-border" />
          <ToolbarButton
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            label="Título"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            label="Lista"
          >
            <List className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            label="Lista numerada"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('taskList')}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            label="Checklist"
          >
            <ListTodo className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('codeBlock')}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            label="Código"
          >
            <Code className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('link')}
            onClick={() => {
              const previous = editor.getAttributes('link').href as string | undefined
              const url = window.prompt('URL', previous ?? 'https://')
              if (url === null) return
              if (url === '') {
                editor.chain().focus().extendMarkRange('link').unsetLink().run()
                return
              }
              editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
            }}
            label="Link"
          >
            <Link2 className="h-3.5 w-3.5" />
          </ToolbarButton>
        </BubbleMenu>
      )}

      <EditorContent editor={editor} className="min-h-[inherit]" />
    </div>
  )
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      className={cn(active && 'bg-accent text-accent-foreground')}
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
    >
      {children}
    </Button>
  )
}

export function PlaneRichText({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  const html = useMemo(() => normalizeDescriptionForEditor(value), [value])
  if (!html.trim()) return null

  return (
    <div
      className={cn('plane-rich-text', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export function PlaneEditorViewer({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  return (
    <PlaneEditor
      value={value}
      onChange={() => {}}
      readOnly
      variant="sheet"
      minHeight={0}
      className={cn('border-0 bg-transparent p-0', className)}
    />
  )
}

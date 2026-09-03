'use client'

import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react'
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type SlashCommandItem = {
  title: string
  description: string
  icon: React.ReactNode
  command: (props: { editor: SuggestionProps['editor']; range: SuggestionProps['range'] }) => void
}

const SLASH_ITEMS: SlashCommandItem[] = [
  {
    title: 'Título 1',
    description: 'Seção principal',
    icon: <Heading1 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run()
    },
  },
  {
    title: 'Título 2',
    description: 'Subseção',
    icon: <Heading2 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run()
    },
  },
  {
    title: 'Título 3',
    description: 'Subtítulo',
    icon: <Heading3 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run()
    },
  },
  {
    title: 'Lista',
    description: 'Lista com marcadores',
    icon: <List className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: 'Lista numerada',
    description: 'Lista ordenada',
    icon: <ListOrdered className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    title: 'Checklist',
    description: 'Lista de tarefas',
    icon: <ListTodo className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run()
    },
  },
  {
    title: 'Citação',
    description: 'Bloco de citação',
    icon: <Quote className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
    },
  },
  {
    title: 'Código',
    description: 'Bloco de código',
    icon: <Code className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
    },
  },
  {
    title: 'Divisor',
    description: 'Linha horizontal',
    icon: <Minus className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },
]

type SlashMenuRef = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

type SlashMenuProps = {
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
}

const SlashCommandMenu = forwardRef<SlashMenuRef, SlashMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i + items.length - 1) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % items.length)
          return true
        }
        if (event.key === 'Enter') {
          const item = items[selectedIndex]
          if (item) command(item)
          return true
        }
        return false
      },
    }))

    if (items.length === 0) {
      return (
        <div className="rounded-lg border bg-popover p-2 text-sm text-muted-foreground shadow-md">
          Nenhum comando
        </div>
      )
    }

    return (
      <div className="z-50 min-w-[220px] overflow-hidden rounded-lg border bg-popover p-1 shadow-md">
        {items.map((item, index) => (
          <button
            key={item.title}
            type="button"
            className={cn(
              'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
              index === selectedIndex
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/60'
            )}
            onMouseDown={(e) => {
              e.preventDefault()
              command(item)
            }}
          >
            <span className="mt-0.5 text-muted-foreground">{item.icon}</span>
            <span className="min-w-0">
              <span className="block font-medium">{item.title}</span>
              <span className="block text-xs text-muted-foreground">
                {item.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    )
  }
)
SlashCommandMenu.displayName = 'SlashCommandMenu'

function updatePopupPosition(element: HTMLElement, clientRect?: (() => DOMRect | null) | null) {
  const rect = clientRect?.()
  if (!rect) return
  element.style.position = 'absolute'
  element.style.left = `${rect.left + window.scrollX}px`
  element.style.top = `${rect.bottom + window.scrollY + 6}px`
  element.style.zIndex = '9999'
}

export function createSlashCommandExtension() {
  return Extension.create({
    name: 'slashCommand',

    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: '/',
          startOfLine: false,
          items: ({ query }: { query: string }) =>
            SLASH_ITEMS.filter((item) =>
              item.title.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 9),
          command: ({ editor, range, props }: { editor: SuggestionProps['editor']; range: SuggestionProps['range']; props: SlashCommandItem }) => {
            props.command({ editor, range })
          },
          render: () => {
            let component: ReactRenderer<SlashMenuRef> | null = null

            return {
              onStart: (props: SuggestionProps<SlashCommandItem>) => {
                component = new ReactRenderer(SlashCommandMenu, {
                  props: {
                    items: props.items,
                    command: (item: SlashCommandItem) => props.command(item),
                  },
                  editor: props.editor,
                })
                document.body.appendChild(component.element)
                updatePopupPosition(component.element, props.clientRect)
              },
              onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
                component?.updateProps({
                  items: props.items,
                  command: (item: SlashCommandItem) => props.command(item),
                })
                if (component) {
                  updatePopupPosition(component.element, props.clientRect)
                }
              },
              onKeyDown: (props: { event: KeyboardEvent }) => {
                if (props.event.key === 'Escape') {
                  component?.destroy()
                  component = null
                  return true
                }
                return component?.ref?.onKeyDown(props) ?? false
              },
              onExit: () => {
                component?.destroy()
                component = null
              },
            }
          },
        }),
      ]
    },
  })
}

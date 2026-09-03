'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronsUpDown, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type ProjectOption = {
  id: string
  name: string
  client: { name: string }
}

async function fetchProjectOptions(args: {
  search?: string
  id?: string
  ids?: string[]
  signal?: AbortSignal
}) {
  const params = new URLSearchParams()
  if (args.search) params.set('search', args.search)
  if (args.id) params.set('id', args.id)
  if (args.ids && args.ids.length > 0) params.set('ids', args.ids.join(','))
  if (!args.id && (!args.ids || args.ids.length === 0)) params.set('limit', '12')

  const res = await fetch(`/api/projects/options?${params.toString()}`, { signal: args.signal })
  if (!res.ok) throw new Error('Falha ao buscar projetos')
  const data = await res.json()
  return (data?.projects || []) as ProjectOption[]
}

type ProjectMultiPickerProps = {
  values: string[]
  onChange: (projectIds: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  excludeIds?: string[]
}

export function ProjectMultiPicker({
  values,
  onChange,
  placeholder = 'Nenhum projeto selecionado',
  disabled,
  className,
  excludeIds = [],
}: ProjectMultiPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<ProjectOption[]>([])
  const [selectedOptions, setSelectedOptions] = useState<ProjectOption[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<number | null>(null)

  const excludeKey = excludeIds.filter(Boolean).join('|')
  const excluded = useMemo(() => new Set(excludeIds.filter(Boolean)), [excludeKey])

  useEffect(() => {
    const ids = values.filter(Boolean)
    if (ids.length === 0) {
      setSelectedOptions([])
      return
    }

    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller

    setLoading(true)
    fetchProjectOptions({ ids, signal: controller.signal })
      .then((list) => setSelectedOptions(list))
      .catch(() => setSelectedOptions([]))
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [values.join('|')])

  useEffect(() => {
    if (!open || disabled) return

    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller

    const selectedSet = new Set(values)

    debounceRef.current = window.setTimeout(() => {
      setLoading(true)
      fetchProjectOptions({ search: query.trim(), signal: controller.signal })
        .then((list) =>
          setOptions(list.filter((p) => !selectedSet.has(p.id) && !excluded.has(p.id)))
        )
        .catch((e) => {
          if (e?.name === 'AbortError') return
          setOptions([])
        })
        .finally(() => setLoading(false))
    }, 250)

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      controller.abort()
    }
  }, [open, query, disabled, values.join('|'), excludeKey])

  return (
    <div className={cn('w-full space-y-2', className)}>
      {selectedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map((p) => (
            <Badge key={p.id} variant="secondary" className="gap-1 pr-1.5">
              <span className="max-w-[240px] truncate">{p.name}</span>
              <button
                type="button"
                className="ml-1 rounded-sm opacity-70 hover:opacity-100"
                onClick={() => onChange(values.filter((id) => id !== p.id))}
                disabled={disabled}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">{placeholder}</div>
      )}

      <Popover open={open} onOpenChange={(v) => !disabled && setOpen(v)}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between gap-2" disabled={disabled}>
            <span className="truncate">Buscar e adicionar projeto</span>
            <ChevronsUpDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
          <div className="space-y-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite para buscar..."
              autoFocus
            />
            <div className="max-h-64 overflow-auto rounded-md border bg-background">
              {loading ? (
                <div className="p-3 text-sm text-muted-foreground">Carregando...</div>
              ) : options.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Nenhum projeto encontrado.</div>
              ) : (
                <div className="p-1">
                  {options.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full flex items-start gap-2 rounded-sm px-2 py-2 text-left hover:bg-muted/60"
                      onClick={() => {
                        onChange(Array.from(new Set([...values, p.id])))
                        setQuery('')
                        setOpen(false)
                      }}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        {p.client?.name && (
                          <div className="text-xs text-muted-foreground truncate">{p.client.name}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

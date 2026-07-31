"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type ClientOption = {
  id: string
  name: string
  email: string
  company?: string | null
}

const clientLabel = (c: ClientOption) => {
  const title = c.company || c.name
  return `${title} (${c.email})`
}

async function fetchClientOptions(args: { search?: string; id?: string; ids?: string[]; signal?: AbortSignal }) {
  const params = new URLSearchParams()
  if (args.search) params.set("search", args.search)
  if (args.id) params.set("id", args.id)
  if (args.ids && args.ids.length > 0) params.set("ids", args.ids.join(","))
  if (!args.id && (!args.ids || args.ids.length === 0)) params.set("limit", "12")

  const res = await fetch(`/api/clients/options?${params.toString()}`, { signal: args.signal })
  if (!res.ok) throw new Error("Falha ao buscar clientes")
  const data = await res.json()
  return (data?.clients || []) as ClientOption[]
}

type ClientPickerProps = {
  value: string
  onChange: (clientId: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  allowClear?: boolean
  excludeIds?: string[]
}

export function ClientPicker({
  value,
  onChange,
  placeholder = "Buscar cliente...",
  disabled,
  className,
  allowClear = true,
  excludeIds = [],
}: ClientPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<ClientOption[]>([])
  const [selected, setSelected] = useState<ClientOption | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<number | null>(null)

  const excludeKey = excludeIds.filter(Boolean).join("|")
  const excluded = useMemo(() => new Set(excludeIds.filter(Boolean)), [excludeKey])

  useEffect(() => {
    if (!value) {
      setSelected(null)
      return
    }

    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller

    setLoading(true)
    fetchClientOptions({ id: value, signal: controller.signal })
      .then((list) => setSelected(list[0] || null))
      .catch(() => setSelected(null))
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [value])

  useEffect(() => {
    if (!open || disabled) return

    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller

    debounceRef.current = window.setTimeout(() => {
      setLoading(true)
      fetchClientOptions({ search: query.trim(), signal: controller.signal })
        .then((list) => setOptions(list.filter((c) => !excluded.has(c.id))))
        .catch((e) => {
          if (e?.name === "AbortError") return
          setOptions([])
        })
        .finally(() => setLoading(false))
    }, 250)

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      controller.abort()
    }
  }, [open, query, disabled, excludeKey])

  const selectedLabel = selected ? clientLabel(selected) : ""

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={(v) => !disabled && setOpen(v)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn("w-full justify-between gap-2", !selected && "text-muted-foreground")}
            disabled={disabled}
          >
            <span className="truncate">{selected ? selectedLabel : placeholder}</span>
            <span className="flex items-center gap-2 shrink-0">
              {allowClear && value ? (
                <span
                  role="button"
                  tabIndex={0}
                  className="inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onChange("")
                    setQuery("")
                    setOptions([])
                    setOpen(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      e.stopPropagation()
                      onChange("")
                      setQuery("")
                      setOptions([])
                      setOpen(false)
                    }
                  }}
                >
                  <X className="h-4 w-4" />
                </span>
              ) : null}
              <ChevronsUpDown className="h-4 w-4 opacity-60" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
          <div className="space-y-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Digite para buscar..." autoFocus />
            <div className="max-h-64 overflow-auto rounded-md border bg-background">
              {loading ? (
                <div className="p-3 text-sm text-muted-foreground">Carregando...</div>
              ) : options.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
              ) : (
                <div className="p-1">
                  {options.map((c) => {
                    const checked = c.id === value
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={cn(
                          "w-full flex items-start gap-2 rounded-sm px-2 py-2 text-left hover:bg-muted/60",
                          checked && "bg-muted"
                        )}
                        onClick={() => {
                          onChange(c.id)
                          setSelected(c)
                          setQuery("")
                          setOpen(false)
                        }}
                      >
                        <Check className={cn("h-4 w-4 mt-0.5 text-primary", checked ? "opacity-100" : "opacity-0")} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{c.company || c.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

type ClientMultiPickerProps = {
  values: string[]
  onChange: (clientIds: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  excludeIds?: string[]
}

export function ClientMultiPicker({
  values,
  onChange,
  placeholder = "Adicionar clientes...",
  disabled,
  className,
  excludeIds = [],
}: ClientMultiPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<ClientOption[]>([])
  const [selectedOptions, setSelectedOptions] = useState<ClientOption[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<number | null>(null)

  const excludeKey = excludeIds.filter(Boolean).join("|")
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
    fetchClientOptions({ ids, signal: controller.signal })
      .then((list) => setSelectedOptions(list))
      .catch(() => setSelectedOptions([]))
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [values.join("|")])

  useEffect(() => {
    if (!open || disabled) return

    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller

    const selectedSet = new Set(values)

    debounceRef.current = window.setTimeout(() => {
      setLoading(true)
      fetchClientOptions({ search: query.trim(), signal: controller.signal })
        .then((list) =>
          setOptions(list.filter((c) => !selectedSet.has(c.id) && !excluded.has(c.id)))
        )
        .catch((e) => {
          if (e?.name === "AbortError") return
          setOptions([])
        })
        .finally(() => setLoading(false))
    }, 250)

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      controller.abort()
    }
  }, [open, query, disabled, values.join("|"), excludeKey])

  return (
    <div className={cn("w-full space-y-2", className)}>
      {selectedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map((c) => (
            <Badge key={c.id} variant="secondary" className="gap-1 pr-1.5">
              <span className="max-w-[240px] truncate">{c.company || c.name}</span>
              <button
                type="button"
                className="ml-1 rounded-sm opacity-70 hover:opacity-100"
                onClick={() => onChange(values.filter((id) => id !== c.id))}
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
            <span className="truncate">Buscar e adicionar</span>
            <ChevronsUpDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
          <div className="space-y-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Digite para buscar..." autoFocus />
            <div className="max-h-64 overflow-auto rounded-md border bg-background">
              {loading ? (
                <div className="p-3 text-sm text-muted-foreground">Carregando...</div>
              ) : options.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
              ) : (
                <div className="p-1">
                  {options.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full flex items-start gap-2 rounded-sm px-2 py-2 text-left hover:bg-muted/60"
                      onClick={() => {
                        onChange(Array.from(new Set([...values, c.id])))
                        setQuery("")
                        setOpen(false)
                      }}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.company || c.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.email}</div>
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

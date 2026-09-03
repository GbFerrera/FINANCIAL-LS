'use client'

import { useCallback, useEffect, useState } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Pencil, Trash2, CheckCircle2, ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChecklistItem {
  id: string
  title: string
  description?: string
  done: boolean
  order: number
}

interface ChecklistGroup {
  id: string
  title: string
  order: number
  items: ChecklistItem[]
}

interface TaskChecklistProps {
  token?: string
  shareToken?: string
  taskId: string
  variant?: 'default' | 'minimal'
  layout?: 'kanban' | 'list'
  readOnly?: boolean
}

const COLUMN_DROPPABLE = 'checklist-board'
const columnDraggableId = (id: string) => `column-${id}`

export function TaskChecklist({
  token,
  shareToken,
  taskId,
  variant = 'default',
  layout,
  readOnly = false,
}: TaskChecklistProps) {
  const [groups, setGroups] = useState<ChecklistGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [newGroupTitle, setNewGroupTitle] = useState('')
  const [newItemTitleByGroup, setNewItemTitleByGroup] = useState<Record<string, string>>({})
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupTitle, setEditingGroupTitle] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingItemTitle, setEditingItemTitle] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [isMainCollapsed, setIsMainCollapsed] = useState(false)

  const isMinimal = variant === 'minimal'
  const resolvedLayout = layout ?? 'list'
  const isKanban = resolvedLayout === 'kanban'
  const isSharePortal = Boolean(shareToken)
  const canEditStructure = !readOnly && !isSharePortal
  const canToggleItems = !readOnly
  const canDrag = canEditStructure

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  const getBaseUrl = () => {
    if (shareToken) return `/api/task-portal/${shareToken}/checklist`
    if (token) return `/api/collaborator-portal/${token}/tasks/${taskId}/checklist`
    return `/api/tasks/${taskId}/checklist`
  }

  const fetchChecklist = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(getBaseUrl())
      if (res.ok) {
        const data = await res.json()
        setGroups(data.groups || [])
      }
    } catch (error) {
      console.error('Erro ao carregar checklist:', error)
    } finally {
      setLoading(false)
    }
  }, [shareToken, token, taskId])

  useEffect(() => {
    fetchChecklist()
  }, [fetchChecklist])

  const persistReorder = async (nextGroups: ChecklistGroup[], groupsOrder?: string[]) => {
    setGroups(nextGroups)
    const itemsOrder = nextGroups.flatMap((group) =>
      group.items.map((item, index) => ({
        id: item.id,
        order: index,
        groupId: group.id,
      }))
    )

    try {
      const res = await fetch(getBaseUrl(), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          ...(groupsOrder ? { groupsOrder } : {}),
          itemsOrder,
        }),
      })
      if (!res.ok) fetchChecklist()
    } catch {
      fetchChecklist()
    }
  }

  const addGroup = async () => {
    if (!newGroupTitle.trim()) return
    const res = await fetch(getBaseUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_group', title: newGroupTitle }),
    })
    if (res.ok) {
      setNewGroupTitle('')
      fetchChecklist()
    }
  }

  const addItem = async (groupId: string) => {
    const title = newItemTitleByGroup[groupId]?.trim()
    if (!title) return
    const res = await fetch(getBaseUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_item', groupId, title }),
    })
    if (res.ok) {
      setNewItemTitleByGroup((prev) => ({ ...prev, [groupId]: '' }))
      fetchChecklist()
    }
  }

  const toggleItem = async (itemId: string, done: boolean) => {
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        items: group.items.map((item) => (item.id === itemId ? { ...item, done } : item)),
      }))
    )

    const res = await fetch(getBaseUrl(), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_item', itemId, done }),
    })
    if (!res.ok) fetchChecklist()
  }

  const startEditGroup = (group: ChecklistGroup) => {
    setEditingGroupId(group.id)
    setEditingGroupTitle(group.title)
  }

  const saveEditGroup = async () => {
    if (!editingGroupId) return
    const res = await fetch(getBaseUrl(), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_group', groupId: editingGroupId, title: editingGroupTitle }),
    })
    if (res.ok) {
      setEditingGroupId(null)
      setEditingGroupTitle('')
      fetchChecklist()
    }
  }

  const startEditItem = (item: ChecklistItem) => {
    setEditingItemId(item.id)
    setEditingItemTitle(item.title)
  }

  const saveEditItem = async () => {
    if (!editingItemId) return
    const res = await fetch(getBaseUrl(), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_item', itemId: editingItemId, title: editingItemTitle }),
    })
    if (res.ok) {
      setEditingItemId(null)
      setEditingItemTitle('')
      fetchChecklist()
    }
  }

  const deleteGroup = async (groupId: string) => {
    const res = await fetch(getBaseUrl(), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_group', groupId }),
    })
    if (res.ok) fetchChecklist()
  }

  const deleteItem = async (itemId: string) => {
    const res = await fetch(getBaseUrl(), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_item', itemId }),
    })
    if (res.ok) fetchChecklist()
  }

  const onDragEnd = async (result: DropResult) => {
    if (!canDrag) return
    const { source, destination, draggableId, type } = result
    if (!destination) return

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return
    }

    if (type === 'COLUMN') {
      const reordered = Array.from(groups)
      const [moved] = reordered.splice(source.index, 1)
      reordered.splice(destination.index, 0, moved)
      await persistReorder(
        reordered.map((group, index) => ({ ...group, order: index })),
        reordered.map((group) => group.id)
      )
      return
    }

    const sourceGroupIndex = groups.findIndex((g) => g.id === source.droppableId)
    const destGroupIndex = groups.findIndex((g) => g.id === destination.droppableId)
    if (sourceGroupIndex === -1 || destGroupIndex === -1) return

    const nextGroups = groups.map((group) => ({ ...group, items: [...group.items] }))
    const sourceItems = nextGroups[sourceGroupIndex].items
    const [movedItem] = sourceItems.splice(source.index, 1)
    if (!movedItem) return

    nextGroups[sourceGroupIndex].items = sourceItems
    const destItems = nextGroups[destGroupIndex].items
    destItems.splice(destination.index, 0, movedItem)
    nextGroups[destGroupIndex].items = destItems

    await persistReorder(nextGroups)
  }

  const renderItemRow = (item: ChecklistItem, index: number, compact = false) => (
    <Draggable
      key={item.id}
      draggableId={item.id}
      index={index}
      isDragDisabled={!canDrag}
      disableInteractiveElementBlocking
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...(canDrag ? provided.dragHandleProps : {})}
          className={cn(
            'group/item flex items-start gap-2 rounded-lg border border-transparent bg-card text-sm transition-shadow',
            compact ? 'p-2' : 'p-2.5',
            canDrag && 'cursor-grab active:cursor-grabbing',
            snapshot.isDragging && 'z-50 border-border shadow-lg ring-2 ring-primary/20',
            item.done && 'opacity-80'
          )}
        >
          <Checkbox
            checked={item.done}
            disabled={!canToggleItems}
            onCheckedChange={(checked) => toggleItem(item.id, checked as boolean)}
            className="mt-0.5"
            onPointerDown={(e) => e.stopPropagation()}
          />

          {editingItemId === item.id ? (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Input
                value={editingItemTitle}
                onChange={(e) => setEditingItemTitle(e.target.value)}
                className="h-7 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    saveEditItem()
                  }
                }}
                autoFocus
              />
              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={saveEditItem}>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </Button>
            </div>
          ) : (
            <div className={cn('min-w-0 flex-1 break-words', item.done && 'text-muted-foreground line-through')}>
              <div>{item.title}</div>
              {item.description && (
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{item.description}</p>
              )}
            </div>
          )}

          {canEditStructure && editingItemId !== item.id && (
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/item:opacity-100">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => startEditItem(item)}
              >
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => deleteItem(item.id)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          )}
        </div>
      )}
    </Draggable>
  )

  const renderAddItem = (groupId: string, compact = false) =>
    canEditStructure ? (
      <div className={cn('flex items-center gap-2', compact ? 'pt-1' : 'pt-2')}>
        <Input
          placeholder="Nova tarefa..."
          value={newItemTitleByGroup[groupId] || ''}
          onChange={(e) => setNewItemTitleByGroup((prev) => ({ ...prev, [groupId]: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.stopPropagation()
              addItem(groupId)
            }
          }}
          className={cn('text-sm', compact ? 'h-8' : 'h-9')}
        />
        <Button type="button" size="sm" variant="ghost" className="h-8 w-8 shrink-0 p-0" onClick={() => addItem(groupId)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    ) : null

  const renderGroupHeaderActions = (group: ChecklistGroup) =>
    canEditStructure ? (
      <div className="flex items-center gap-1">
        <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => startEditGroup(group)}>
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => deleteGroup(group.id)}>
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    ) : null

  const kanbanView = (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId={COLUMN_DROPPABLE} direction="horizontal" type="COLUMN">
        {(boardProvided) => (
          <div
            ref={boardProvided.innerRef}
            {...boardProvided.droppableProps}
            className="-mx-1 flex min-h-[320px] gap-3 overflow-x-auto px-1 pb-2"
          >
            {groups.map((group, groupIndex) => {
              const groupDone = group.items.filter((i) => i.done).length
              return (
                <Draggable
                  key={group.id}
                  draggableId={columnDraggableId(group.id)}
                  index={groupIndex}
                  isDragDisabled={!canDrag}
                >
                  {(columnProvided, columnSnapshot) => (
                    <div
                      ref={columnProvided.innerRef}
                      {...columnProvided.draggableProps}
                      className={cn(
                        'flex w-[280px] shrink-0 flex-col rounded-xl border border-border/70 bg-muted/10 p-2',
                        columnSnapshot.isDragging && 'opacity-90 shadow-lg ring-2 ring-primary/20'
                      )}
                    >
                      <div
                        {...columnProvided.dragHandleProps}
                        className={cn(
                          'mb-2 flex items-center gap-2 rounded-lg px-1 py-1',
                          canDrag && 'cursor-grab active:cursor-grabbing'
                        )}
                      >
                        {canDrag && <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        {editingGroupId === group.id ? (
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <Input
                              value={editingGroupTitle}
                              onChange={(e) => setEditingGroupTitle(e.target.value)}
                              className="h-7 text-sm"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  saveEditGroup()
                                }
                              }}
                              autoFocus
                            />
                            <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={saveEditGroup}>
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{group.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {groupDone}/{group.items.length}
                            </span>
                            {renderGroupHeaderActions(group)}
                          </>
                        )}
                      </div>

                      <Droppable droppableId={group.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              'flex min-h-[220px] flex-1 flex-col space-y-2 overflow-y-auto rounded-lg px-1 pb-2',
                              snapshot.isDraggingOver && 'bg-primary/5 ring-1 ring-inset ring-primary/15'
                            )}
                          >
                            {group.items.map((item, index) => renderItemRow(item, index, true))}
                            {snapshot.isDraggingOver && group.items.length === 0 && (
                              <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-primary/40 text-xs text-muted-foreground">
                                Solte aqui
                              </div>
                            )}
                            {provided.placeholder}
                            {renderAddItem(group.id, true)}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )}
                </Draggable>
              )
            })}
            {boardProvided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  )

  const listView = (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="space-y-6">
        {groups.map((group) => {
          const isGroupCollapsed = collapsedGroups[group.id]
          const groupDone = group.items.filter((i) => i.done).length

            return (
              <Droppable key={group.id} droppableId={group.id}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                  <div className="group flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => toggleGroupCollapse(group.id)}
                    >
                      {isGroupCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>

                    {editingGroupId === group.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          value={editingGroupTitle}
                          onChange={(e) => setEditingGroupTitle(e.target.value)}
                          className="h-7 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              saveEditGroup()
                            }
                          }}
                          autoFocus
                        />
                        <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={saveEditGroup}>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center gap-2">
                        <span className="text-sm font-medium">{group.title}</span>
                        <span className="text-xs text-muted-foreground">
                          ({groupDone}/{group.items.length})
                        </span>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {renderGroupHeaderActions(group)}
                        </div>
                      </div>
                    )}
                  </div>

                  {!isGroupCollapsed && (
                    <div className="space-y-2 pl-6">
                      {group.items.map((item, index) => renderItemRow(item, index))}
                      {provided.placeholder}
                      {renderAddItem(group.id)}
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          )
        })}
      </div>
    </DragDropContext>
  )

  if (loading) {
    return <div className="p-3 text-sm text-muted-foreground">Carregando checklist...</div>
  }

  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0)
  const completedItems = groups.reduce((sum, g) => sum + g.items.filter((i) => i.done).length, 0)

  const content = (
    <div className="space-y-4">
      {canEditStructure && (
        <div className="flex gap-2">
          <Input
            placeholder="Nome do novo grupo..."
            value={newGroupTitle}
            onChange={(e) => setNewGroupTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                addGroup()
              }
            }}
          />
          <Button type="button" size="sm" className="gap-2" onClick={addGroup}>
            <Plus className="h-4 w-4" />
            {isMinimal ? 'Grupo' : 'Adicionar grupo'}
          </Button>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum grupo no checklist. Adicione fases ou etapas acima.
        </div>
      ) : isKanban ? (
        kanbanView
      ) : (
        listView
      )}
    </div>
  )

  if (isMinimal) {
    return content
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex cursor-pointer items-center gap-2" onClick={() => setIsMainCollapsed(!isMainCollapsed)}>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted">
            {isMainCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <h3 className="font-medium text-foreground">Checklist</h3>
          <Badge variant="secondary">
            {completedItems}/{totalItems} etapas concluídas
          </Badge>
          {completedItems === totalItems && totalItems > 0 && (
            <Badge className="gap-1">
              <CheckCircle2 className="h-4 w-4" /> Checklist completo
            </Badge>
          )}
        </div>
      </div>

      {!isMainCollapsed && (
        <Card>
          <CardContent className="space-y-4 p-3">{content}</CardContent>
        </Card>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Pencil, Trash2, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'

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
  taskId: string
  variant?: 'default' | 'minimal'
}

export function TaskChecklist({ token, taskId, variant = 'default' }: TaskChecklistProps) {
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

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }))
  }

  const getBaseUrl = () => {
    if (token) {
      return `/api/collaborator-portal/${token}/tasks/${taskId}/checklist`
    }
    return `/api/tasks/${taskId}/checklist`
  }

  const fetchChecklist = async () => {
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
  }

  useEffect(() => {
    fetchChecklist()
  }, [token, taskId])

  const addGroup = async () => {
    if (!newGroupTitle.trim()) return
    const res = await fetch(getBaseUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_group', title: newGroupTitle })
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
      body: JSON.stringify({ action: 'create_item', groupId, title })
    })
    if (res.ok) {
      setNewItemTitleByGroup(prev => ({ ...prev, [groupId]: '' }))
      fetchChecklist()
    }
  }

  const toggleItem = async (itemId: string, done: boolean) => {
    const res = await fetch(getBaseUrl(), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_item', itemId, done })
    })
    if (res.ok) {
      fetchChecklist()
    }
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
      body: JSON.stringify({ action: 'update_group', groupId: editingGroupId, title: editingGroupTitle })
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
      body: JSON.stringify({ action: 'update_item', itemId: editingItemId, title: editingItemTitle })
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
      body: JSON.stringify({ action: 'delete_group', groupId })
    })
    if (res.ok) {
      fetchChecklist()
    }
  }

  const deleteItem = async (itemId: string) => {
    const res = await fetch(getBaseUrl(), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_item', itemId })
    })
    if (res.ok) {
      fetchChecklist()
    }
  }

  const onDragEnd = async (result: DropResult) => {
    const { source, destination } = result

    // Se não soltou em um destino válido
    if (!destination) return

    // Se soltou no mesmo lugar
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return
    }

    // Encontrar os grupos de origem e destino
    const sourceGroupIndex = groups.findIndex(g => g.id === source.droppableId)
    const destGroupIndex = groups.findIndex(g => g.id === destination.droppableId)

    if (sourceGroupIndex === -1 || destGroupIndex === -1) return

    const newGroups = [...groups]
    const sourceGroup = newGroups[sourceGroupIndex]
    const destGroup = newGroups[destGroupIndex]

    // Se moveu dentro do mesmo grupo
    if (source.droppableId === destination.droppableId) {
      const newItems = Array.from(sourceGroup.items)
      const [movedItem] = newItems.splice(source.index, 1)
      newItems.splice(destination.index, 0, movedItem)

      // Atualizar ordem localmente
      const updatedItems = newItems.map((item, index) => ({
        ...item,
        order: index
      }))
      
      newGroups[sourceGroupIndex] = {
        ...sourceGroup,
        items: updatedItems
      }

      setGroups(newGroups)

      // Enviar para API
      const itemsOrder = updatedItems.map(item => ({
        id: item.id,
        order: item.order
      }))

      await fetch(getBaseUrl(), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          itemsOrder
        })
      })
    } else {
      // Se moveu entre grupos diferentes
      const sourceItems = Array.from(sourceGroup.items)
      const destItems = Array.from(destGroup.items)
      const [movedItem] = sourceItems.splice(source.index, 1)
      
      // Atualizar o groupId do item movido (na API precisaria atualizar o groupId também, mas a rota 'reorder' atual só atualiza 'order')
      // A rota atual não suporta mudar groupId via 'reorder'.
      // Vamos assumir por enquanto que só move dentro do mesmo grupo ou implementar mudança de grupo separadamente.
      // O usuário pediu "jogar para baixo ou para cima", o que geralmente é reordenar.
      // Para simplificar e evitar bugs com a API atual, vamos restringir o drop ao mesmo grupo ou implementar a mudança de grupo.
      
      // Se quisermos suportar mudança de grupo, teríamos que atualizar o item primeiro para mudar o groupId.
      // Como a rota PATCH suporta 'update_item', poderíamos usar isso, mas 'update_item' só aceita title/description.
      // A rota POST 'create_item' aceita groupId.
      
      // Vamos restringir ao mesmo grupo por enquanto para atender ao pedido principal de reordenação vertical ("para baixo ou para cima").
      // Se o usuário quiser mover entre grupos, ele pode pedir depois ou podemos implementar se for crítico.
      // O pedido "jogar para baixo ou para cima se eu tiver finalizado" sugere reordenar prioridade.
      return
    }
  }

  if (loading) {
    return (
      <div className="p-3 text-sm text-muted-foreground">Carregando checklist...</div>
    )
  }

  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0)
  const completedItems = groups.reduce((sum, g) => sum + g.items.filter(i => i.done).length, 0)

  const content = (
    <div className="space-y-4">
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
          <Plus className="w-4 h-4" />
          {isMinimal ? 'Grupo' : 'Adicionar grupo'}
        </Button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="space-y-6">
          {groups.map(group => {
            const isGroupCollapsed = collapsedGroups[group.id]
            const groupTotal = group.items.length
            const groupDone = group.items.filter(i => i.done).length

            return (
              <Droppable key={group.id} droppableId={group.id}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2"
                  >
                    {/* Header do Grupo */}
                    <div className="flex items-center gap-2 group">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => toggleGroupCollapse(group.id)}
                      >
                        {isGroupCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                      
                      {editingGroupId === group.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editingGroupTitle}
                            onChange={(e) => setEditingGroupTitle(e.target.value)}
                            className="h-7 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                e.stopPropagation()
                                saveEditGroup()
                              }
                            }}
                            autoFocus
                          />
                          <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={saveEditGroup}>
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <span className="font-medium text-sm">{group.title}</span>
                          <span className="text-xs text-muted-foreground">({groupDone}/{groupTotal})</span>
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                            <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => startEditGroup(group)}>
                              <Pencil className="w-3 h-3 text-muted-foreground" />
                            </Button>
                            <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => deleteGroup(group.id)}>
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {!isGroupCollapsed && (
                      <div className="pl-6 space-y-2">
                        {group.items.map((item, index) => (
                          <Draggable key={item.id} draggableId={item.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="group/item flex items-start gap-2 text-sm"
                              >
                                <Checkbox
                                  checked={item.done}
                                  onCheckedChange={(checked) => toggleItem(item.id, checked as boolean)}
                                  className="mt-0.5"
                                />
                                
                                {editingItemId === item.id ? (
                                  <div className="flex items-center gap-2 flex-1">
                                    <Input
                                      value={editingItemTitle}
                                      onChange={(e) => setEditingItemTitle(e.target.value)}
                                      className="h-7 text-sm"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        saveEditItem()
                                      }
                                    }}
                                      autoFocus
                                    />
                                  <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={saveEditItem}>
                                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className={`flex-1 break-words ${item.done ? 'text-muted-foreground line-through' : ''}`}>
                                    {item.title}
                                  </div>
                                )}

                                <div className="opacity-0 group-hover/item:opacity-100 flex items-center gap-1">
                                  <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => startEditItem(item)}>
                                    <Pencil className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                  <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => deleteItem(item.id)}>
                                    <Trash2 className="w-3 h-3 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}

                        <div className="flex gap-2 items-center pt-1">
                          <Input
                            placeholder="Nova tarefa..."
                            value={newItemTitleByGroup[group.id] || ''}
                            onChange={(e) => setNewItemTitleByGroup(prev => ({ ...prev, [group.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                e.stopPropagation()
                                addItem(group.id)
                              }
                            }}
                            className="h-8 text-sm"
                          />
                          <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => addItem(group.id)}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            )
          })}
        </div>
      </DragDropContext>
    </div>
  )

  if (isMinimal) {
    return content
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsMainCollapsed(!isMainCollapsed)}>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0 hover:bg-gray-100" 
          >
            {isMainCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <h3 className="font-medium text-foreground">Checklist</h3>
          <Badge variant="secondary">{completedItems}/{totalItems} etapas concluídas</Badge>
          {completedItems === totalItems && totalItems > 0 && (
            <Badge className="gap-1"><CheckCircle2 className="w-4 h-4" /> Checklist completo</Badge>
          )}
        </div>
      </div>

      {!isMainCollapsed && (
        <Card>
          <CardContent className="p-3 space-y-4">
            {content}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

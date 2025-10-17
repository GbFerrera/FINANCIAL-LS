'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  Filter, 
  X, 
  Search, 
  User, 
  Flag, 
  Calendar,
  Target
} from 'lucide-react'

interface FilterOptions {
  search?: string
  status?: string[]
  priority?: string[]
  assigneeId?: string[]
  sprintId?: string
  storyPointsMin?: number
  storyPointsMax?: number
}

interface TaskFiltersProps {
  filters: FilterOptions
  onFiltersChange: (filters: FilterOptions) => void
  teamMembers: Array<{ id: string; name: string; email: string }>
  sprints: Array<{ id: string; name: string; status: string }>
}

export function TaskFilters({ 
  filters, 
  onFiltersChange, 
  teamMembers, 
  sprints 
}: TaskFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters)

  const statusOptions = [
    { value: 'TODO', label: 'A Fazer', color: 'bg-gray-100 text-gray-800' },
    { value: 'IN_PROGRESS', label: 'Em Andamento', color: 'bg-blue-100 text-blue-800' },
    { value: 'IN_REVIEW', label: 'Em Revisão', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'COMPLETED', label: 'Concluído', color: 'bg-green-100 text-green-800' }
  ]

  const priorityOptions = [
    { value: 'LOW', label: 'Baixa', color: 'bg-gray-100 text-gray-600' },
    { value: 'MEDIUM', label: 'Média', color: 'bg-blue-100 text-blue-600' },
    { value: 'HIGH', label: 'Alta', color: 'bg-orange-100 text-orange-600' },
    { value: 'URGENT', label: 'Urgente', color: 'bg-red-100 text-red-600' }
  ]

  const updateFilter = (key: keyof FilterOptions, value: any) => {
    const newFilters = { ...localFilters, [key]: value }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const toggleArrayFilter = (key: 'status' | 'priority' | 'assigneeId', value: string) => {
    const currentArray = localFilters[key] || []
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value]
    
    updateFilter(key, newArray.length > 0 ? newArray : undefined)
  }

  const clearFilters = () => {
    const emptyFilters: FilterOptions = {}
    setLocalFilters(emptyFilters)
    onFiltersChange(emptyFilters)
  }

  const getActiveFiltersCount = () => {
    let count = 0
    if (localFilters.search) count++
    if (localFilters.status?.length) count++
    if (localFilters.priority?.length) count++
    if (localFilters.assigneeId?.length) count++
    if (localFilters.sprintId) count++
    if (localFilters.storyPointsMin !== undefined || localFilters.storyPointsMax !== undefined) count++
    return count
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
            {getActiveFiltersCount() > 0 && (
              <Badge variant="secondary" className="ml-2">
                {getActiveFiltersCount()}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {getActiveFiltersCount() > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4 mr-1" />
                Limpar
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Recolher' : 'Expandir'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Busca - sempre visível */}
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar tarefas..."
            value={localFilters.search || ''}
            onChange={(e) => updateFilter('search', e.target.value || undefined)}
            className="flex-1"
          />
        </div>

        {isExpanded && (
          <>
            {/* Status */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4" />
                Status
              </Label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((status) => (
                  <Badge
                    key={status.value}
                    variant={localFilters.status?.includes(status.value) ? "default" : "outline"}
                    className={`cursor-pointer ${
                      localFilters.status?.includes(status.value) 
                        ? status.color 
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => toggleArrayFilter('status', status.value)}
                  >
                    {status.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Prioridade */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Flag className="w-4 h-4" />
                Prioridade
              </Label>
              <div className="flex flex-wrap gap-2">
                {priorityOptions.map((priority) => (
                  <Badge
                    key={priority.value}
                    variant={localFilters.priority?.includes(priority.value) ? "default" : "outline"}
                    className={`cursor-pointer ${
                      localFilters.priority?.includes(priority.value) 
                        ? priority.color 
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => toggleArrayFilter('priority', priority.value)}
                  >
                    {priority.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Responsável */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4" />
                  Responsável
                </Label>
                <Select
                  value={localFilters.assigneeId?.[0] || 'all'}
                  onValueChange={(value) => updateFilter('assigneeId', value === 'all' ? undefined : [value])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sprint */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4" />
                  Sprint
                </Label>
                <Select
                  value={localFilters.sprintId || 'all'}
                  onValueChange={(value) => updateFilter('sprintId', value === 'all' ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    {sprints.map((sprint) => (
                      <SelectItem key={sprint.id} value={sprint.id}>
                        {sprint.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Story Points */}
              <div>
                <Label className="mb-2 block">Story Points</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={localFilters.storyPointsMin || ''}
                    onChange={(e) => updateFilter('storyPointsMin', 
                      e.target.value ? parseInt(e.target.value) : undefined
                    )}
                    className="w-20"
                  />
                  <span className="self-center text-gray-400">-</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={localFilters.storyPointsMax || ''}
                    onChange={(e) => updateFilter('storyPointsMax', 
                      e.target.value ? parseInt(e.target.value) : undefined
                    )}
                    className="w-20"
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

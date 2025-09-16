"use client"

import { useState, useEffect } from "react"
import { Calendar, Clock, DollarSign, Users } from "lucide-react"

interface Project {
  id: string
  name: string
  status: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD'
  budget: number
  spent: number
  startDate: string
  endDate: string
  teamMembers: number
  progress: number
}

interface ProjectsOverviewProps {
  projects: Project[]
}

const statusColors = {
  ACTIVE: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  ON_HOLD: 'bg-yellow-100 text-yellow-800'
}

const statusLabels = {
  ACTIVE: 'Ativo',
  COMPLETED: 'Concluído',
  ON_HOLD: 'Pausado'
}

export function ProjectsOverview({ projects }: ProjectsOverviewProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  
  const filteredProjects = selectedStatus === 'all' 
    ? projects 
    : projects.filter(project => project.status === selectedStatus)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Projetos Ativos
          </h3>
          <div className="flex space-x-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="all">Todos</option>
              <option value="ACTIVE">Ativos</option>
              <option value="COMPLETED">Concluídos</option>
              <option value="ON_HOLD">Pausados</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {filteredProjects.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Nenhum projeto encontrado</p>
            </div>
          ) : (
            filteredProjects.map((project) => (
              <div key={project.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <h4 className="text-lg font-medium text-gray-900">{project.name}</h4>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[project.status]}`}>
                      {statusLabels[project.status]}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {project.progress}% concluído
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-gray-500">Orçamento</p>
                      <p className="font-medium">{formatCurrency(project.budget)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-red-400" />
                    <div>
                      <p className="text-gray-500">Gasto</p>
                      <p className="font-medium text-red-600">{formatCurrency(project.spent)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-gray-500">Prazo</p>
                      <p className="font-medium">{formatDate(project.endDate)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-gray-500">Equipe</p>
                      <p className="font-medium">{project.teamMembers} membros</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {filteredProjects.length > 0 && (
          <div className="mt-6">
            <button className="w-full bg-indigo-50 text-indigo-700 py-2 px-4 rounded-md hover:bg-indigo-100 transition-colors">
              Ver todos os projetos
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
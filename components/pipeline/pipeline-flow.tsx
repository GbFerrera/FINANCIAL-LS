'use client';

import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { MilestoneCard } from './milestone-card';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
}

interface Milestone {
  id: string;
  name: string;
  description?: string;
  status: string;
  dueDate?: string;
  tasks: Task[];
}

interface PipelineFlowProps {
  milestones: Milestone[];
  onTaskClick: (task: Task) => void;
}

export function PipelineFlow({ milestones, onTaskClick }: PipelineFlowProps) {
  return (
    <div className="relative py-8">
      {/* Linha de fundo da pipeline */}
      <div className="absolute top-16 left-0 right-0 h-1 bg-gradient-to-r from-gray-300 via-blue-300 to-green-300 rounded-full opacity-60"></div>
      
      {/* Linha de progresso dinâmica */}
      <div 
        className="absolute top-16 left-0 h-1 bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-1000 ease-out shadow-lg"
        style={{
          width: `${(milestones.filter(m => m.status === 'COMPLETED').length / milestones.length) * 100}%`
        }}
      ></div>
      
      {/* Container dos milestones */}
      <div className="flex justify-between items-start relative z-10 px-4">
        {milestones.map((milestone, index) => (
          <div key={milestone.id} className="flex items-center">
            <MilestoneCard
              milestone={milestone}
              index={index}
              totalMilestones={milestones.length}
              onTaskClick={onTaskClick}
            />
            
            {/* Seta animada entre milestones */}
            {index < milestones.length - 1 && (
              <div className="flex items-center mx-4 relative z-30">
                <div className={`
                  transition-all duration-500 transform
                  ${milestone.status === 'COMPLETED' ? 'scale-110 text-green-500' : 
                    milestone.status === 'IN_PROGRESS' ? 'scale-105 text-blue-500 animate-pulse' : 
                    'text-gray-400'}
                `}>
                  <ArrowRightIcon className="w-8 h-8" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Indicadores de status no final */}
      <div className="flex justify-center mt-8 space-x-6">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
          <span className="text-gray-600">Pendente</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-gray-600">Em Progresso</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-gray-600">Concluído</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-gray-600">Bloqueado</span>
        </div>
      </div>
    </div>
  );
}
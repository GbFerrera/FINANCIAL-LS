'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  CalendarIcon, 
  ClockIcon, 
  CheckCircleIcon,
  PlayCircleIcon,
  PauseCircleIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  RocketLaunchIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { parseISO } from 'date-fns';

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

interface MilestoneCardProps {
  milestone: Milestone;
  index: number;
  totalMilestones: number;
  onTaskClick: (task: Task) => void;
}

export function MilestoneCard({ milestone, index, totalMilestones, onTaskClick }: MilestoneCardProps) {
  const completedTasks = milestone.tasks.filter(task => task.status === 'COMPLETED').length;
  const milestoneProgress = milestone.tasks.length > 0 
    ? Math.round((completedTasks / milestone.tasks.length) * 100) 
    : 0;

  const getMilestoneIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircleIcon className="w-8 h-8 text-white" />;
      case 'IN_PROGRESS':
        return <RocketLaunchIcon className="w-8 h-8 text-white" />;
      case 'PENDING':
        return <FlagIcon className="w-8 h-8 text-white" />;
      case 'BLOCKED':
        return <ExclamationTriangleIcon className="w-8 h-8 text-white" />;
      default:
        return <FlagIcon className="w-8 h-8 text-white" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500 border-green-300 shadow-green-200';
      case 'IN_PROGRESS':
        return 'bg-blue-500 border-blue-300 shadow-blue-200';
      case 'PENDING':
        return 'bg-gray-400 border-gray-300 shadow-gray-200';
      case 'BLOCKED':
        return 'bg-red-500 border-red-300 shadow-red-200';
      default:
        return 'bg-gray-400 border-gray-300 shadow-gray-200';
    }
  };

  const getCardBorderColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'border-green-200 bg-green-50/50';
      case 'IN_PROGRESS':
        return 'border-blue-200 bg-blue-50/50';
      case 'PENDING':
        return 'border-gray-200 bg-gray-50/50';
      case 'BLOCKED':
        return 'border-red-200 bg-red-50/50';
      default:
        return 'border-gray-200 bg-gray-50/50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'Concluído';
      case 'IN_PROGRESS':
        return 'Em Progresso';
      case 'PENDING':
        return 'Pendente';
      case 'BLOCKED':
        return 'Bloqueado';
      default:
        return 'Pendente';
    }
  };

  return (
    <div className="flex flex-col items-center relative">
      {/* Ícone do Milestone */}
      <div className={`
        w-20 h-20 rounded-full flex items-center justify-center shadow-xl border-4 transition-all duration-500 hover:scale-110 cursor-pointer relative z-20
        ${getStatusColor(milestone.status)}
      `}>
        {getMilestoneIcon(milestone.status)}
        
        {/* Número da etapa */}
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold text-gray-700 shadow-md">
          {index + 1}
        </div>
      </div>
      
      {/* Linha de conexão para o próximo milestone */}
      {index < totalMilestones - 1 && (
        <div className="absolute top-10 left-1/2 w-full h-0.5 bg-gradient-to-r from-current to-transparent opacity-30 z-10" 
             style={{ 
               left: '50%', 
               width: 'calc(100% + 2rem)',
               transform: 'translateX(10px)'
             }}>
        </div>
      )}
      
      {/* Card do Milestone */}
      <Card className={`
        mt-6 w-80 transition-all duration-300 hover:shadow-2xl cursor-pointer border-2 backdrop-blur-sm
        ${getCardBorderColor(milestone.status)}
      `}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="truncate pr-2">{milestone.name}</span>
            <Badge variant="outline" className="shrink-0 text-xs">
              {getStatusText(milestone.status)}
            </Badge>
          </CardTitle>
          {milestone.description && (
            <p className="text-sm text-gray-600 line-clamp-2">{milestone.description}</p>
          )}
        </CardHeader>
        
        <CardContent className="pt-0 space-y-4">
          {/* Progresso do Milestone */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Progresso</span>
              <span className="font-bold text-blue-600">{milestoneProgress}%</span>
            </div>
            <Progress value={milestoneProgress} className="h-3 bg-gray-200" />
          </div>
          
          {/* Estatísticas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2 bg-white/60 rounded-lg">
              <CheckCircleIcon className="w-4 h-4 text-green-500 shrink-0" />
              <div className="text-xs">
                <div className="font-semibold">{completedTasks}</div>
                <div className="text-gray-500">Concluídas</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-white/60 rounded-lg">
              <ClockIcon className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="text-xs">
                <div className="font-semibold">{milestone.tasks.length}</div>
                <div className="text-gray-500">Total</div>
              </div>
            </div>
          </div>
          
          {/* Data de vencimento */}
          {milestone.dueDate && (
            <div className="flex items-center gap-2 p-2 bg-white/60 rounded-lg">
              <CalendarIcon className="w-4 h-4 text-orange-500" />
              <div className="text-xs">
                <div className="font-medium">Prazo</div>
                <div className="text-gray-600">
                  {parseISO(milestone.dueDate).toLocaleDateString('pt-BR')}
                </div>
              </div>
            </div>
          )}
          
          {/* Tarefas em destaque */}
          {milestone.tasks.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-700">Próximas Tarefas:</div>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {milestone.tasks.slice(0, 2).map((task) => (
                  <div 
                    key={task.id}
                    className="flex items-center gap-2 p-2 bg-white/80 rounded text-xs cursor-pointer hover:bg-white transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskClick(task);
                    }}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      task.status === 'COMPLETED' ? 'bg-green-500' :
                      task.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                      task.status === 'BLOCKED' ? 'bg-red-500' : 'bg-gray-400'
                    }`}></div>
                    <span className="truncate flex-1">{task.title}</span>
                    {task.assignee && (
                      <UserIcon className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <Button 
            variant="outline" 
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              if (milestone.tasks.length > 0) {
                onTaskClick(milestone.tasks[0]);
              }
            }}
          >
            Ver Todas as Tarefas ({milestone.tasks.length})
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
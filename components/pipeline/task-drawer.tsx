'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { 
  CalendarIcon, 
  ClockIcon, 
  UserIcon, 
  ChatBubbleLeftIcon,
  PlayIcon,
  StopIcon
} from '@heroicons/react/24/outline';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  assignee?: {
    id: string;
    name: string;
    avatar?: string;
  };
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    author?: {
      id: string;
      name: string;
      avatar?: string;
    };
  }>;
  timeEntries: Array<{
    id: string;
    startTime: string;
    endTime?: string;
    description?: string;
    user: {
      id: string;
      name: string;
    };
  }>;
}

interface TaskDrawerProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate: () => void;
}

const statusColors = {
  TODO: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  BLOCKED: 'bg-red-100 text-red-800'
};

const priorityColors = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800'
};

export function TaskDrawer({ task, isOpen, onClose, onTaskUpdate }: TaskDrawerProps) {
  const [newComment, setNewComment] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);

  if (!task) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }
    return `${diffMinutes}m`;
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    setIsAddingComment(true);
    try {
      const response = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newComment
        }),
      });

      if (response.ok) {
        setNewComment('');
        onTaskUpdate();
      }
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
    } finally {
      setIsAddingComment(false);
    }
  };

  const totalTimeSpent = task.timeEntries.reduce((total, entry) => {
    const start = new Date(entry.startTime);
    const end = entry.endTime ? new Date(entry.endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    return total + (diffMs / (1000 * 60 * 60)); // Convert to hours
  }, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold pr-8">
            {task.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status e Prioridade */}
          <div className="flex items-center gap-3">
            <Badge className={statusColors[task.status]}>
              {task.status}
            </Badge>
            <Badge className={priorityColors[task.priority]}>
              {task.priority}
            </Badge>
          </div>

          {/* Descrição */}
          {task.description && (
            <div>
              <h3 className="font-medium text-foreground mb-2">Descrição</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                {task.description}
              </p>
            </div>
          )}

          {/* Informações da Tarefa */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {task.assignee && (
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={task.assignee.avatar} />
                    <AvatarFallback className="text-xs">
                      {task.assignee.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-gray-700">{task.assignee.name}</span>
                </div>
              </div>
            )}

            {task.dueDate && (
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-gray-700">
                  Prazo: {formatDate(task.dueDate)}
                </span>
              </div>
            )}

            {task.estimatedHours && (
              <div className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-gray-700">
                  Estimativa: {task.estimatedHours}h
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <PlayIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-gray-700">
                Tempo gasto: {totalTimeSpent.toFixed(1)}h
              </span>
            </div>
          </div>

          <div className="border-t border-muted my-6"></div>

          {/* Entradas de Tempo */}
          {task.timeEntries.length > 0 && (
            <div>
              <h3 className="font-medium text-foreground mb-3">Registro de Tempo</h3>
              <div className="space-y-2">
                {task.timeEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-card rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {entry.endTime ? (
                          <StopIcon className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <PlayIcon className="h-4 w-4 text-green-500" />
                        )}
                        <span className="text-sm font-medium">
                          {formatDuration(entry.startTime, entry.endTime)}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">{entry.user.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(entry.startTime)}
                      {entry.endTime && ` - ${formatDate(entry.endTime)}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-muted my-6"></div>

          {/* Comentários */}
          <div>
            <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
              <ChatBubbleLeftIcon className="h-4 w-4" />
              Comentários ({task.comments.length})
            </h3>

            {/* Adicionar Comentário */}
            <div className="space-y-3 mb-4">
              <Textarea
                placeholder="Adicionar um comentário..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex justify-end">
                <Button 
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || isAddingComment}
                  size="sm"
                >
                  {isAddingComment ? 'Adicionando...' : 'Adicionar Comentário'}
                </Button>
              </div>
            </div>

            {/* Lista de Comentários */}
            <div className="space-y-4">
              {task.comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={comment.author?.avatar} />
                    <AvatarFallback className="text-xs">
                      {comment.author?.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground">
                        {comment.author?.name || 'Usuário'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))}

              {task.comments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum comentário ainda. Seja o primeiro a comentar!
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
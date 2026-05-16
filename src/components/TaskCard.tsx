'use client';

import { useState, useEffect } from 'react';
import { type Note, calculateProgress } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

interface TaskCardProps {
  task: Note;
  onComplete: (id: number) => void;
  onEdit: (task: Note) => void;
  compact?: boolean;
}

export default function TaskCard({ task, onComplete, onEdit, compact = false }: TaskCardProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    calculateProgress(task).then(setProgress);
    const interval = setInterval(() => {
      calculateProgress(task).then(setProgress);
    }, 60000);
    return () => clearInterval(interval);
  }, [task]);

  const isOverdue = task.deadline && new Date(task.deadline) < new Date();
  const timeLeft = task.deadline ? getTimeLeft(new Date(task.deadline)) : null;

  const priorityVariant = {
    high: 'destructive' as const,
    medium: 'secondary' as const,
    low: 'outline' as const,
  };

  return (
    <Card
      className={`relative cursor-pointer transition-all hover:bg-accent/50 border-l-4 ${
        isOverdue ? 'ring-2 ring-destructive/50 animate-pulse-subtle' : ''
      }`}
      style={{ borderLeftColor: task.categoryColor || task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#eab308' : task.priority === 'low' ? '#22c55e' : 'hsl(var(--border))' }}
      onClick={() => onEdit(task)}
    >
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        {/* Category badge */}
        {task.category && (
          <Badge
            variant="outline"
            className="mb-2 text-xs"
            style={{ borderColor: task.categoryColor, color: task.categoryColor }}
          >
            {task.category}
          </Badge>
        )}

        {/* Title */}
        <h3 className={`font-semibold ${compact ? 'text-sm' : 'text-base'} text-foreground`}>
          {task.title}
        </h3>

        {/* Content preview */}
        {!compact && task.content && (
          <p className="text-muted-foreground text-sm mt-1 mb-3 line-clamp-2">{task.content}</p>
        )}

        {/* Time left */}
        {timeLeft && (
          <div className={`flex items-center gap-1 text-xs font-medium mt-2 mb-2 ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
            {isOverdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {isOverdue ? `Overdue by ${timeLeft}` : `${timeLeft} left`}
          </div>
        )}

        {/* Progress bar */}
        <Progress
          value={progress}
          className="h-2 mt-2"
        />

        {/* Priority indicator */}
        {task.priority && (
          <Badge
            variant={priorityVariant[task.priority]}
            className="absolute top-3 right-3 text-xs"
          >
            {task.priority.toUpperCase()}
          </Badge>
        )}

        {/* Complete button */}
        <Button
          size="sm"
          variant="default"
          className="mt-3 bg-green-600 hover:bg-green-500 text-white"
          onClick={(e) => {
            e.stopPropagation();
            if (task.id) onComplete(task.id);
          }}
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          Done
        </Button>
      </CardContent>
    </Card>
  );
}

function getTimeLeft(deadline: Date): string {
  const now = new Date();
  const diff = Math.abs(deadline.getTime() - now.getTime());

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

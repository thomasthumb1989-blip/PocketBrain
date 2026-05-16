'use client';

import { useState, useEffect } from 'react';
import { type Note, calculateProgress, db } from '@/lib/db';

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
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [task]);

  const isOverdue = task.deadline && new Date(task.deadline) < new Date();
  const timeLeft = task.deadline ? getTimeLeft(new Date(task.deadline)) : null;

  const priorityColors = {
    high: 'border-red-500',
    medium: 'border-yellow-500',
    low: 'border-green-500',
  };

  return (
    <div
      className={`relative rounded-lg border-l-4 bg-gray-800 p-4 transition-all hover:bg-gray-750 cursor-pointer
        ${task.priority ? priorityColors[task.priority] : 'border-gray-600'}
        ${isOverdue ? 'ring-2 ring-red-500/50 animate-pulse-subtle' : ''}
      `}
      onClick={() => onEdit(task)}
      style={{ borderLeftColor: task.categoryColor || undefined }}
    >
      {/* Category badge */}
      {task.category && (
        <span
          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2"
          style={{ backgroundColor: task.categoryColor + '30', color: task.categoryColor }}
        >
          {task.category}
        </span>
      )}

      {/* Title */}
      <h3 className={`font-semibold ${compact ? 'text-sm' : 'text-base'} text-white mb-1`}>
        {task.title}
      </h3>

      {/* Content preview */}
      {!compact && task.content && (
        <p className="text-gray-400 text-sm mb-3 line-clamp-2">{task.content}</p>
      )}

      {/* Time left */}
      {timeLeft && (
        <div className={`text-xs font-medium mb-2 ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
          {isOverdue ? `⚠️ Overdue by ${timeLeft}` : `⏰ ${timeLeft} left`}
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isOverdue ? 'bg-red-500' : progress > 75 ? 'bg-yellow-500' : 'bg-blue-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Priority indicator */}
      {task.priority && (
        <span className={`absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded ${
          task.priority === 'high' ? 'bg-red-500/20 text-red-400' :
          task.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-green-500/20 text-green-400'
        }`}>
          {task.priority.toUpperCase()}
        </span>
      )}

      {/* Complete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (task.id) onComplete(task.id);
        }}
        className="mt-3 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded-md font-medium transition-colors"
      >
        ✓ Done
      </button>
    </div>
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

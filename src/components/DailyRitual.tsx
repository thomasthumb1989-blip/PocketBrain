'use client';

import { useState } from 'react';
import { db, type Note } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Sun, Moon } from 'lucide-react';

interface DailyRitualProps {
  type: 'morning' | 'evening';
  onClose: () => void;
}

export default function DailyRitual({ type, onClose }: DailyRitualProps) {
  const today = new Date().toISOString().split('T')[0];

  const activeTasks = useLiveQuery(() =>
    db.notes
      .filter((n) => n.isTask && !n.completed && !n.archived)
      .toArray()
  );

  const completedToday = useLiveQuery(() =>
    db.notes
      .filter((n) => n.completed && n.completedAt !== null && new Date(n.completedAt).toISOString().split('T')[0] === today)
      .toArray()
  );

  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);

  const handleMorningSave = async () => {
    await db.dailyPlans.add({
      date: today,
      taskIds: selectedTasks,
      createdAt: new Date(),
    });
    onClose();
  };

  if (type === 'morning') {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center pb-2">
          <Sun className="w-10 h-10 mx-auto text-yellow-400 mb-2" />
          <CardTitle>Good Morning!</CardTitle>
          <p className="text-muted-foreground text-sm">Pick up to 3 tasks for today</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-60 overflow-y-auto mb-6">
            {activeTasks?.map((task) => (
              <label
                key={task.id}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                  selectedTasks.includes(task.id!)
                    ? 'bg-primary/10 border-primary'
                    : 'bg-card hover:bg-accent border-transparent'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTasks.includes(task.id!)}
                  onChange={(e) => {
                    if (e.target.checked && selectedTasks.length < 3) {
                      setSelectedTasks([...selectedTasks, task.id!]);
                    } else {
                      setSelectedTasks(selectedTasks.filter((id) => id !== task.id));
                    }
                  }}
                  className="w-4 h-4 rounded"
                  disabled={!selectedTasks.includes(task.id!) && selectedTasks.length >= 3}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm font-medium truncate">{task.title}</p>
                  {task.deadline && (
                    <p className="text-muted-foreground text-xs">Due: {new Date(task.deadline).toLocaleDateString()}</p>
                  )}
                </div>
                {task.priority && (
                  <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                    {task.priority[0].toUpperCase()}
                  </Badge>
                )}
              </label>
            ))}
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleMorningSave}
              disabled={selectedTasks.length === 0}
              className="flex-1"
            >
              Start Day ({selectedTasks.length}/3)
            </Button>
            <Button variant="outline" onClick={onClose}>
              Skip
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Evening review
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center pb-2">
        <Moon className="w-10 h-10 mx-auto text-indigo-400 mb-2" />
        <CardTitle>Day Complete!</CardTitle>
        <p className="text-muted-foreground text-sm">Here's what you accomplished</p>
      </CardHeader>
      <CardContent>
        <Card className="mb-4 bg-muted/50">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-400">{completedToday?.length || 0}</div>
            <p className="text-muted-foreground text-sm">tasks completed today</p>
          </CardContent>
        </Card>

        {completedToday && completedToday.length > 0 && (
          <div className="space-y-2 mb-6">
            {completedToday.map((task) => (
              <div key={task.id} className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <span className="truncate">{task.title}</span>
              </div>
            ))}
          </div>
        )}

        <Button onClick={onClose} className="w-full">
          Rest well 💤
        </Button>
      </CardContent>
    </Card>
  );
}

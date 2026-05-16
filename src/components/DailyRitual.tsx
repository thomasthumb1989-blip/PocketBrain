'use client';

import { useState, useEffect } from 'react';
import { db, type Note } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface DailyRitualProps {
  type: 'morning' | 'evening';
  onClose: () => void;
}

export default function DailyRitual({ type, onClose }: DailyRitualProps) {
  const today = new Date().toISOString().split('T')[0];

  const activeTasks = useLiveQuery(() =>
    db.notes
      .where('isTask')
      .equals(1)
      .and((n) => !n.completed && !n.archived)
      .toArray()
  );

  const completedToday = useLiveQuery(() =>
    db.notes
      .where('completed')
      .equals(1)
      .and((n) => n.completedAt !== null && new Date(n.completedAt).toISOString().split('T')[0] === today)
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
      <div className="bg-gray-800 rounded-xl p-6 max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">☀️</div>
          <h2 className="text-xl font-bold text-white">Good Morning!</h2>
          <p className="text-gray-400 text-sm">Pick up to 3 tasks for today</p>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto mb-6">
          {activeTasks?.map((task) => (
            <label
              key={task.id}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                selectedTasks.includes(task.id!)
                  ? 'bg-blue-600/20 border border-blue-500'
                  : 'bg-gray-700 hover:bg-gray-650'
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
              <div>
                <p className="text-white text-sm font-medium">{task.title}</p>
                {task.deadline && (
                  <p className="text-gray-400 text-xs">Due: {new Date(task.deadline).toLocaleDateString()}</p>
                )}
              </div>
              {task.priority && (
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${
                  task.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                  task.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-green-500/20 text-green-400'
                }`}>
                  {task.priority[0].toUpperCase()}
                </span>
              )}
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleMorningSave}
            disabled={selectedTasks.length === 0}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white font-medium py-2.5 rounded-lg"
          >
            Start Day ({selectedTasks.length}/3)
          </button>
          <button onClick={onClose} className="px-4 py-2.5 bg-gray-700 text-gray-300 rounded-lg">
            Skip
          </button>
        </div>
      </div>
    );
  }

  // Evening review
  return (
    <div className="bg-gray-800 rounded-xl p-6 max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🌙</div>
        <h2 className="text-xl font-bold text-white">Day Complete!</h2>
        <p className="text-gray-400 text-sm">Here's what you accomplished</p>
      </div>

      <div className="bg-gray-700 rounded-lg p-4 mb-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-green-400">{completedToday?.length || 0}</div>
          <p className="text-gray-400 text-sm">tasks completed today</p>
        </div>
      </div>

      {completedToday && completedToday.length > 0 && (
        <div className="space-y-2 mb-6">
          {completedToday.map((task) => (
            <div key={task.id} className="flex items-center gap-2 text-gray-300 text-sm">
              <span className="text-green-400">✓</span>
              <span>{task.title}</span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg"
      >
        Rest well 💤
      </button>
    </div>
  );
}

'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

export default function StreakDisplay() {
  const streaks = useLiveQuery(() =>
    db.streaks.orderBy('date').reverse().limit(30).toArray()
  );

  const today = new Date().toISOString().split('T')[0];
  const todayStreak = streaks?.find((s) => s.date === today);

  // Calculate consecutive streak days
  let streakCount = 0;
  if (streaks) {
    const sorted = [...streaks].sort((a, b) => b.date.localeCompare(a.date));
    for (const s of sorted) {
      if (s.tasksCompleted > 0) {
        streakCount++;
      } else {
        break;
      }
    }
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔥</span>
            <span className="text-2xl font-bold text-orange-400">{streakCount}</span>
          </div>
          <p className="text-gray-400 text-xs mt-1">day streak</p>
        </div>

        {todayStreak && (
          <div className="text-right">
            <div className="text-lg font-bold text-green-400">
              {todayStreak.tasksCompleted}/{todayStreak.tasksPlanned}
            </div>
            <p className="text-gray-400 text-xs">today's score</p>
          </div>
        )}
      </div>

      {/* Mini streak calendar */}
      <div className="flex gap-1 mt-3">
        {Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (6 - i));
          const dateStr = date.toISOString().split('T')[0];
          const streak = streaks?.find((s) => s.date === dateStr);
          const hasActivity = streak && streak.tasksCompleted > 0;

          return (
            <div
              key={dateStr}
              className={`w-full h-2 rounded-full ${
                hasActivity ? 'bg-green-500' : 'bg-gray-700'
              }`}
              title={`${dateStr}: ${streak?.tasksCompleted || 0} tasks`}
            />
          );
        })}
      </div>
    </div>
  );
}

import Dexie, { type EntityTable } from 'dexie';

export interface Note {
  id?: number;
  content: string;
  title: string;
  category: string;
  categoryColor: string;
  priority: 'high' | 'medium' | 'low' | null;
  isTask: boolean;
  deadline: Date | null;
  reminders: Reminder[];
  recurring: RecurringConfig | null;
  progress: number; // 0-100, auto-calculated from time for tasks
  completed: boolean;
  completedAt: Date | null;
  archived: boolean;
  imageBlobs: string[]; // base64 encoded images
  createdAt: Date;
  updatedAt: Date;
}

export interface Reminder {
  id: string;
  time: string; // HH:mm format
  enabled: boolean;
  escalationLevel: 'gentle' | 'urgent' | 'alarm';
}

export interface RecurringConfig {
  type: 'daily' | 'weekly' | 'monthly' | 'intraday';
  interval?: number; // for intraday: hours between reminders
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  exactTimes?: string[]; // specific times
  daysOfWeek?: number[]; // 0-6 for weekly
}

export interface Category {
  id?: number;
  name: string;
  color: string;
  createdAt: Date;
}

export interface Streak {
  id?: number;
  date: string; // YYYY-MM-DD
  tasksCompleted: number;
  tasksPlanned: number;
}

export interface DailyPlan {
  id?: number;
  date: string; // YYYY-MM-DD
  taskIds: number[];
  createdAt: Date;
}

const db = new Dexie('PocketBrainDB') as Dexie & {
  notes: EntityTable<Note, 'id'>;
  categories: EntityTable<Category, 'id'>;
  streaks: EntityTable<Streak, 'id'>;
  dailyPlans: EntityTable<DailyPlan, 'id'>;
};

db.version(1).stores({
  notes: '++id, category, isTask, deadline, completed, archived, createdAt, priority',
  categories: '++id, name',
  streaks: '++id, date',
  dailyPlans: '++id, date',
});

export { db };

// Helper functions
export async function getActiveTasks() {
  return db.notes
    .where('isTask')
    .equals(1)
    .and((note) => !note.archived && !note.completed)
    .sortBy('deadline');
}

export async function getUpcomingTasks(limit = 5) {
  const tasks = await db.notes
    .where('isTask')
    .equals(1)
    .and((note) => !note.archived && !note.completed && note.deadline !== null)
    .toArray();

  return tasks
    .sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    })
    .slice(0, limit);
}

export async function getOverdueTasks() {
  const now = new Date();
  return db.notes
    .where('isTask')
    .equals(1)
    .and((note) => !note.archived && !note.completed && note.deadline !== null && new Date(note.deadline) < now)
    .toArray();
}

export async function archiveCompleted() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.notes
    .where('completed')
    .equals(1)
    .and((note) => note.completedAt !== null && new Date(note.completedAt) < oneDayAgo)
    .modify({ archived: true });
}

export async function calculateProgress(note: Note): Promise<number> {
  if (!note.isTask || !note.deadline) return 0;
  const now = new Date().getTime();
  const created = new Date(note.createdAt).getTime();
  const deadline = new Date(note.deadline).getTime();
  const total = deadline - created;
  if (total <= 0) return 100;
  const elapsed = now - created;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

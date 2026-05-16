'use client';

import { useState, useEffect, useCallback } from 'react';
import { db, type Note, getUpcomingTasks, archiveCompleted } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { requestNotificationPermission, startReminderChecker } from '@/lib/notifications';
import { trainModel, seedDefaultCategories } from '@/lib/categories';
import { registerServiceWorker } from '@/lib/register-sw';
import TaskCard from '@/components/TaskCard';
import NoteForm from '@/components/NoteForm';
import FocusMode from '@/components/FocusMode';
import DailyRitual from '@/components/DailyRitual';
import QuickCapture from '@/components/QuickCapture';
import StreakDisplay from '@/components/StreakDisplay';

type View = 'dashboard' | 'all-notes' | 'focus' | 'categories' | 'archive' | 'search';

export default function Home() {
  const [view, setView] = useState<View>('dashboard');
  const [showForm, setShowForm] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [showBrainDump, setShowBrainDump] = useState(false);
  const [showRitual, setShowRitual] = useState<'morning' | 'evening' | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  // Live queries
  const upcomingTasks = useLiveQuery(() =>
    db.notes
      .filter((n) => n.isTask && !n.completed && !n.archived && n.deadline !== null)
      .toArray()
      .then((tasks) =>
        tasks.sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
      )
  );

  const overdueTasks = useLiveQuery(() => {
    const now = new Date();
    return db.notes
      .filter((n) => n.isTask && !n.completed && !n.archived && n.deadline !== null && new Date(n.deadline) < now)
      .toArray();
  });

  const allNotes = useLiveQuery(() =>
    db.notes.filter((n) => !n.archived).toArray()
      .then((notes) => notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
  );

  const archivedNotes = useLiveQuery(() =>
    db.notes.filter((n) => n.archived).toArray()
  );

  const categories = useLiveQuery(() => db.categories.toArray());

  // Init
  useEffect(() => {
    registerServiceWorker();
    requestNotificationPermission();
    startReminderChecker();
    trainModel();
    archiveCompleted();
    seedDefaultCategories();

    // Check if morning ritual needed
    const hour = new Date().getHours();
    if (hour >= 6 && hour <= 10) {
      const today = new Date().toISOString().split('T')[0];
      db.dailyPlans.where('date').equals(today).count().then((count) => {
        if (count === 0) setShowRitual('morning');
      });
    } else if (hour >= 20) {
      setShowRitual('evening');
    }
  }, []);

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        setShowQuickCapture(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleComplete = async (id: number) => {
    await db.notes.update(id, {
      completed: true,
      completedAt: new Date(),
      progress: 100,
    });

    // Update streak
    const today = new Date().toISOString().split('T')[0];
    const existing = await db.streaks.where('date').equals(today).first();
    if (existing) {
      await db.streaks.update(existing.id!, { tasksCompleted: existing.tasksCompleted + 1 });
    } else {
      const planned = await db.dailyPlans.where('date').equals(today).first();
      await db.streaks.add({
        date: today,
        tasksCompleted: 1,
        tasksPlanned: planned?.taskIds.length || 3,
      });
    }
  };

  const handleEdit = (note: Note) => {
    setEditNote(note);
    setShowForm(true);
  };

  // Filtered notes for search
  const filteredNotes = allNotes?.filter((note) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!note.title.toLowerCase().includes(q) && !note.content.toLowerCase().includes(q)) return false;
    }
    if (filterCategory && note.category !== filterCategory) return false;
    if (filterPriority && note.priority !== filterPriority) return false;
    return true;
  });

  // Focus mode
  if (view === 'focus') {
    return (
      <FocusMode
        tasks={upcomingTasks || []}
        onComplete={handleComplete}
        onExit={() => setView('dashboard')}
      />
    );
  }

  const displayTasks = showMore ? upcomingTasks : upcomingTasks?.slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Quick Capture Modal */}
      {showQuickCapture && <QuickCapture onClose={() => setShowQuickCapture(false)} />}

      {/* Daily Ritual */}
      {showRitual && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40 p-4">
          <DailyRitual type={showRitual} onClose={() => setShowRitual(null)} />
        </div>
      )}

      {/* Note Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-30 p-4">
          <div className="w-full max-w-lg">
            <NoteForm
              editNote={editNote}
              onSave={() => { setShowForm(false); setEditNote(null); trainModel(); }}
              onCancel={() => { setShowForm(false); setEditNote(null); }}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-gray-800 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">
            🧠 <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">PocketBrain</span>
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setView('focus')}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium"
              title="Focus Mode"
            >
              🎯
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium"
            >
              + New
            </button>
          </div>
        </div>

        {/* Nav tabs */}
        <div className="max-w-4xl mx-auto px-4 flex gap-1 pb-2 overflow-x-auto">
          {[
            { id: 'dashboard', label: '📋 Dashboard' },
            { id: 'all-notes', label: '📝 All Notes' },
            { id: 'search', label: '🔍 Search' },
            { id: 'categories', label: '🏷️ Categories' },
            { id: 'archive', label: '📦 Archive' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id as View)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                view === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {view === 'dashboard' && (
          <div className="space-y-6">
            {/* Streak */}
            <StreakDisplay />

            {/* Quick add task */}
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowForm(true)}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-gray-400 text-left hover:bg-gray-650 hover:border-gray-500 transition-colors"
                >
                  + Add a task...
                </button>
              </div>
            </div>

            {/* Brain dump */}
            <div className="bg-gray-800 rounded-xl p-4">
              <NoteForm
                onSave={() => trainModel()}
                onCancel={() => {}}
                brainDump
              />
            </div>

            {/* Overdue */}
            {overdueTasks && overdueTasks.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2">
                  🔴 OVERDUE ({overdueTasks.length})
                </h2>
                <div className="grid gap-3">
                  {overdueTasks.map((task) => (
                    <TaskCard key={task.id} task={task} onComplete={handleComplete} onEdit={handleEdit} />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming */}
            <div>
              <h2 className="text-sm font-bold text-gray-300 mb-3">⏰ ENDING SOONEST</h2>
              {displayTasks && displayTasks.length > 0 ? (
                <div className="grid gap-3">
                  {displayTasks.map((task) => (
                    <TaskCard key={task.id} task={task} onComplete={handleComplete} onEdit={handleEdit} />
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No upcoming tasks. Add one above!</p>
              )}
              {upcomingTasks && upcomingTasks.length > 5 && !showMore && (
                <button
                  onClick={() => setShowMore(true)}
                  className="w-full mt-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 text-sm"
                >
                  Show {upcomingTasks.length - 5} more...
                </button>
              )}
            </div>
          </div>
        )}

        {view === 'all-notes' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">All Notes</h2>
              <button
                onClick={() => setShowBrainDump(!showBrainDump)}
                className="text-sm bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg"
              >
                🧠 Brain Dump
              </button>
            </div>
            {showBrainDump && (
              <div className="bg-gray-800 rounded-xl p-4 mb-4">
                <NoteForm onSave={() => trainModel()} onCancel={() => setShowBrainDump(false)} brainDump />
              </div>
            )}
            {filteredNotes?.map((note) => (
              <div
                key={note.id}
                onClick={() => handleEdit(note)}
                className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-750 transition-colors"
                style={{ borderLeft: `3px solid ${note.categoryColor || '#555'}` }}
              >
                <div className="flex items-center gap-2 mb-1">
                  {note.category && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: note.categoryColor + '30', color: note.categoryColor }}>
                      {note.category}
                    </span>
                  )}
                  {note.isTask && <span className="text-xs text-blue-400">📌 Task</span>}
                </div>
                <h3 className="font-medium text-white">{note.title}</h3>
                <p className="text-gray-400 text-sm line-clamp-1">{note.content}</p>
              </div>
            ))}
          </div>
        )}

        {view === 'search' && (
          <div className="space-y-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes and tasks..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">All categories</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">All priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="space-y-2">
              {filteredNotes?.map((note) => (
                <div
                  key={note.id}
                  onClick={() => handleEdit(note)}
                  className="bg-gray-800 rounded-lg p-3 cursor-pointer hover:bg-gray-750"
                >
                  <h3 className="font-medium text-white text-sm">{note.title}</h3>
                  <p className="text-gray-400 text-xs line-clamp-1">{note.content}</p>
                </div>
              ))}
              {filteredNotes?.length === 0 && (
                <p className="text-gray-500 text-center py-8">No results found</p>
              )}
            </div>
          </div>
        )}

        {view === 'categories' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Categories</h2>
              <button
                onClick={async () => {
                  const name = prompt('Category name:');
                  if (name) {
                    const { getNextColor } = await import('@/lib/categories');
                    const existingColors = categories?.map((c) => c.color) || [];
                    await db.categories.add({
                      name,
                      color: getNextColor(existingColors),
                      createdAt: new Date(),
                    });
                  }
                }}
                className="text-sm bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg"
              >
                + Add
              </button>
            </div>
            {categories?.map((cat) => (
              <div key={cat.id} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-white font-medium flex-1">{cat.name}</span>
                <button
                  onClick={async () => {
                    if (confirm(`Delete category "${cat.name}"?`)) {
                      await db.categories.delete(cat.id!);
                    }
                  }}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {view === 'archive' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold mb-4">Archive</h2>
            {archivedNotes?.map((note) => (
              <div key={note.id} className="bg-gray-800 rounded-lg p-3 opacity-60">
                <h3 className="font-medium text-white text-sm line-through">{note.title}</h3>
                <p className="text-gray-400 text-xs">
                  Completed: {note.completedAt ? new Date(note.completedAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            ))}
            {archivedNotes?.length === 0 && (
              <p className="text-gray-500 text-center py-8">No archived items yet</p>
            )}
          </div>
        )}
      </main>

      {/* Floating mic button */}
      <button
        onClick={() => setShowQuickCapture(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-500 rounded-full shadow-lg flex items-center justify-center text-2xl z-10 transition-transform hover:scale-110"
        title="Quick Capture (Ctrl+Space)"
      >
        🎙️
      </button>
    </div>
  );
}

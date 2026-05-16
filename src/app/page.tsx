'use client';

import { useState, useEffect } from 'react';
import { db, type Note, archiveCompleted } from '@/lib/db';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Plus, Target, Mic, Search as SearchIcon, LayoutDashboard, FileText, Tag, Archive, Brain } from 'lucide-react';

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

  const filteredNotes = allNotes?.filter((note) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!note.title.toLowerCase().includes(q) && !note.content.toLowerCase().includes(q)) return false;
    }
    if (filterCategory && note.category !== filterCategory) return false;
    if (filterPriority && note.priority !== filterPriority) return false;
    return true;
  });

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
    <div className="min-h-screen bg-background">
      {/* Quick Capture Modal */}
      {showQuickCapture && <QuickCapture onClose={() => setShowQuickCapture(false)} />}

      {/* Daily Ritual */}
      <Dialog open={showRitual !== null} onOpenChange={() => setShowRitual(null)}>
        <DialogContent className="sm:max-w-md p-0 border-border bg-card">
          {showRitual && <DailyRitual type={showRitual} onClose={() => setShowRitual(null)} />}
        </DialogContent>
      </Dialog>

      {/* Note Form Modal */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditNote(null); } }}>
        <DialogContent className="sm:max-w-lg p-0 border-border bg-card">
          <NoteForm
            editNote={editNote}
            onSave={() => { setShowForm(false); setEditNote(null); trainModel(); }}
            onCancel={() => { setShowForm(false); setEditNote(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">PocketBrain</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setView('focus')}>
              <Target className="h-4 w-4 mr-1" />
              Focus
            </Button>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
        </div>

        {/* Nav tabs */}
        <div className="max-w-4xl mx-auto px-4 pb-2">
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList className="w-full justify-start bg-muted/50 h-9">
              <TabsTrigger value="dashboard" className="text-xs gap-1">
                <LayoutDashboard className="h-3 w-3" /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="all-notes" className="text-xs gap-1">
                <FileText className="h-3 w-3" /> All Notes
              </TabsTrigger>
              <TabsTrigger value="search" className="text-xs gap-1">
                <SearchIcon className="h-3 w-3" /> Search
              </TabsTrigger>
              <TabsTrigger value="categories" className="text-xs gap-1">
                <Tag className="h-3 w-3" /> Categories
              </TabsTrigger>
              <TabsTrigger value="archive" className="text-xs gap-1">
                <Archive className="h-3 w-3" /> Archive
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {view === 'dashboard' && (
          <div className="space-y-5">
            <StreakDisplay />

            {/* Quick add task */}
            <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setShowForm(true)}>
              <CardContent className="p-3 flex items-center gap-3 text-muted-foreground">
                <Plus className="h-4 w-4" />
                <span className="text-sm">Add a task...</span>
              </CardContent>
            </Card>

            {/* Brain dump */}
            <Card>
              <CardContent className="p-3">
                <NoteForm onSave={() => trainModel()} onCancel={() => {}} brainDump />
              </CardContent>
            </Card>

            {/* Overdue */}
            {overdueTasks && overdueTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="destructive" className="text-xs font-semibold">
                    OVERDUE ({overdueTasks.length})
                  </Badge>
                </div>
                <div className="grid gap-3">
                  {overdueTasks.map((task) => (
                    <TaskCard key={task.id} task={task} onComplete={handleComplete} onEdit={handleEdit} />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                Ending Soonest
              </h2>
              {displayTasks && displayTasks.length > 0 ? (
                <div className="grid gap-3">
                  {displayTasks.map((task) => (
                    <TaskCard key={task.id} task={task} onComplete={handleComplete} onEdit={handleEdit} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground text-sm">
                    No upcoming tasks. Add one above!
                  </CardContent>
                </Card>
              )}
              {upcomingTasks && upcomingTasks.length > 5 && !showMore && (
                <Button variant="ghost" className="w-full mt-3" onClick={() => setShowMore(true)}>
                  Show {upcomingTasks.length - 5} more...
                </Button>
              )}
            </div>
          </div>
        )}

        {view === 'all-notes' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">All Notes</h2>
              <Button variant="outline" size="sm" onClick={() => setShowBrainDump(!showBrainDump)}>
                <Brain className="h-4 w-4 mr-1" />
                Brain Dump
              </Button>
            </div>
            {showBrainDump && (
              <Card className="mb-4">
                <CardContent className="p-3">
                  <NoteForm onSave={() => trainModel()} onCancel={() => setShowBrainDump(false)} brainDump />
                </CardContent>
              </Card>
            )}
            {filteredNotes?.map((note) => (
              <Card
                key={note.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => handleEdit(note)}
                style={{ borderLeftWidth: '3px', borderLeftColor: note.categoryColor || 'transparent' }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    {note.category && (
                      <Badge variant="secondary" className="text-xs" style={{ backgroundColor: note.categoryColor + '20', color: note.categoryColor, borderColor: note.categoryColor + '40' }}>
                        {note.category}
                      </Badge>
                    )}
                    {note.isTask && <Badge variant="outline" className="text-xs">Task</Badge>}
                  </div>
                  <h3 className="font-medium">{note.title}</h3>
                  <p className="text-muted-foreground text-sm line-clamp-1">{note.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {view === 'search' && (
          <div className="space-y-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes and tasks..."
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All categories</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="space-y-2">
              {filteredNotes?.map((note) => (
                <Card key={note.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => handleEdit(note)}>
                  <CardContent className="p-3">
                    <h3 className="font-medium text-sm">{note.title}</h3>
                    <p className="text-muted-foreground text-xs line-clamp-1">{note.content}</p>
                  </CardContent>
                </Card>
              ))}
              {filteredNotes?.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground text-sm">
                    No results found
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {view === 'categories' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Categories</h2>
              <Button size="sm" onClick={async () => {
                const name = prompt('Category name:');
                if (name) {
                  const { getNextColor } = await import('@/lib/categories');
                  const existingColors = categories?.map((c) => c.color) || [];
                  await db.categories.add({ name, color: getNextColor(existingColors), createdAt: new Date() });
                }
              }}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            {categories?.map((cat) => (
              <Card key={cat.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="font-medium flex-1 text-sm">{cat.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={async () => {
                      if (confirm(`Delete category "${cat.name}"?`)) {
                        await db.categories.delete(cat.id!);
                      }
                    }}
                  >
                    ✕
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {view === 'archive' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold mb-4">Archive</h2>
            {archivedNotes?.map((note) => (
              <Card key={note.id} className="opacity-60">
                <CardContent className="p-3">
                  <h3 className="font-medium text-sm line-through">{note.title}</h3>
                  <p className="text-muted-foreground text-xs">
                    Completed: {note.completedAt ? new Date(note.completedAt).toLocaleDateString() : 'N/A'}
                  </p>
                </CardContent>
              </Card>
            ))}
            {archivedNotes?.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground text-sm">
                  No archived items yet
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Floating mic button */}
      <Button
        onClick={() => setShowQuickCapture(true)}
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-10"
        title="Quick Capture (Ctrl+Space)"
      >
        <Mic className="h-6 w-6" />
      </Button>
    </div>
  );
}

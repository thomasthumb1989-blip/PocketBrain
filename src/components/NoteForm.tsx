'use client';

import { useState, useEffect, useRef } from 'react';
import { db, type Note, type Reminder, type RecurringConfig } from '@/lib/db';
import { useSpeech, parseVoiceInput } from '@/hooks/useSpeech';
import { suggestCategory } from '@/lib/categories';
import { useLiveQuery } from 'dexie-react-hooks';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Mic, MicOff, Plus, X, Sparkles, Clock, Repeat } from 'lucide-react';

interface NoteFormProps {
  editNote?: Note | null;
  onSave: () => void;
  onCancel: () => void;
  brainDump?: boolean;
}

export default function NoteForm({ editNote, onSave, onCancel, brainDump = false }: NoteFormProps) {
  const [title, setTitle] = useState(editNote?.title || '');
  const [content, setContent] = useState(editNote?.content || '');
  const [category, setCategory] = useState(editNote?.category || '');
  const [categoryColor, setCategoryColor] = useState(editNote?.categoryColor || '#4ECDC4');
  const [isTask, setIsTask] = useState(editNote?.isTask || false);
  const [priority, setPriority] = useState<'high' | 'medium' | 'low' | null>(editNote?.priority || null);
  const [deadline, setDeadline] = useState(editNote?.deadline ? formatDateForInput(new Date(editNote.deadline)) : '');
  const [reminders, setReminders] = useState<Reminder[]>(editNote?.reminders || []);
  const [recurring, setRecurring] = useState<RecurringConfig | null>(editNote?.recurring || null);
  const [suggestedCat, setSuggestedCat] = useState<string | null>(null);

  const { transcript, isListening, toggleListening, error: speechError, isSupported: micSupported } = useSpeech();

  const categories = useLiveQuery(() => db.categories.toArray());

  const contentBeforeVoiceRef = useRef('');
  const lastTranscriptRef = useRef('');

  // When mic starts, snapshot current content once
  useEffect(() => {
    if (isListening) {
      contentBeforeVoiceRef.current = content;
      lastTranscriptRef.current = '';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  // Replace (not append) with latest transcript
  useEffect(() => {
    if (transcript && transcript !== lastTranscriptRef.current) {
      lastTranscriptRef.current = transcript;
      const parsed = parseVoiceInput(transcript);
      setContent(contentBeforeVoiceRef.current
        ? contentBeforeVoiceRef.current + ' ' + parsed.cleanText
        : parsed.cleanText
      );
      if (parsed.suggestedDeadline) {
        setDeadline(formatDateForInput(parsed.suggestedDeadline));
        setIsTask(true);
      }
      if (parsed.suggestedPriority) {
        setPriority(parsed.suggestedPriority);
        setIsTask(true);
      }
    }
  }, [transcript]);

  useEffect(() => {
    if (title || content) {
      const suggestion = suggestCategory(title, content);
      if (suggestion && suggestion.confidence > 0.3) {
        setSuggestedCat(suggestion.category);
      }
    }
  }, [title, content]);

  const addReminder = () => {
    setReminders([
      ...reminders,
      { id: crypto.randomUUID(), time: '09:00', enabled: true, escalationLevel: 'gentle' },
    ]);
  };

  const removeReminder = (id: string) => {
    setReminders(reminders.filter((r) => r.id !== id));
  };

  const updateReminder = (id: string, updates: Partial<Reminder>) => {
    setReminders(reminders.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const handleSave = async () => {
    const note: Omit<Note, 'id'> = {
      title: title || content.slice(0, 50),
      content,
      category,
      categoryColor,
      priority: isTask ? priority : null,
      isTask,
      deadline: deadline ? new Date(deadline) : null,
      reminders: isTask ? reminders : [],
      recurring,
      progress: 0,
      completed: false,
      completedAt: null,
      archived: false,
      imageBlobs: editNote?.imageBlobs || [],
      createdAt: editNote?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    if (editNote?.id) {
      await db.notes.update(editNote.id, note);
    } else {
      await db.notes.add(note as Note);
    }

    onSave();
  };

  if (brainDump) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Dump it — sort later..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && content.trim()) {
                handleSave();
                setContent('');
                setTitle('');
              }
            }}
            className="flex-1"
            autoFocus
          />
          {micSupported && (
            <button
              type="button"
              onClick={toggleListening}
              className={`flex items-center justify-center w-10 h-10 rounded-lg select-none transition-colors ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-primary text-primary-foreground hover:bg-primary/80'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
        </div>
        {speechError && <p className="text-destructive text-xs">{speechError}</p>}
        {isListening && <p className="text-green-400 text-xs animate-pulse">🎙️ Listening... speak now</p>}
        {transcript && !isListening && <p className="text-blue-400 text-xs">Heard: "{transcript}"</p>}
        <p className="text-muted-foreground text-xs">Press Enter to save.{micSupported ? ' Tap mic to start/stop recording.' : ''} Sort later in organize mode.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[80vh] overflow-y-auto">
      {/* Title */}
      <Input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {/* Content + voice */}
      <div className="relative">
        <Textarea
          placeholder="What's on your mind?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="resize-none pr-12"
        />
        {micSupported && (
          <button
            type="button"
            onClick={toggleListening}
            className={`absolute bottom-2 right-2 h-8 w-8 flex items-center justify-center rounded-md select-none transition-colors ${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      {speechError && <p className="text-destructive text-xs">{speechError}</p>}

      {/* Category */}
      <div className="flex gap-2 items-center">
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            const cat = categories?.find((c) => c.name === e.target.value);
            if (cat) setCategoryColor(cat.color);
          }}
          className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">No category</option>
          {categories?.map((cat) => (
            <option key={cat.id} value={cat.name}>{cat.name}</option>
          ))}
        </select>
        {suggestedCat && suggestedCat !== category && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1"
            onClick={() => {
              setCategory(suggestedCat);
              const cat = categories?.find((c) => c.name === suggestedCat);
              if (cat) setCategoryColor(cat.color);
            }}
          >
            <Sparkles className="w-3 h-3" />
            {suggestedCat}
          </Button>
        )}
      </div>

      <Separator />

      {/* Task toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isTask}
          onChange={(e) => setIsTask(e.target.checked)}
          className="w-4 h-4 rounded border-input"
        />
        <span className="text-sm font-medium text-foreground">This is a task</span>
      </label>

      {/* Task fields */}
      {isTask && (
        <div className="space-y-3 pl-4 border-l-2 border-primary/50">
          {/* Priority */}
          <div className="flex gap-2">
            {(['high', 'medium', 'low'] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={priority === p ? 'default' : 'outline'}
                className={priority === p ? (
                  p === 'high' ? 'bg-red-500 hover:bg-red-600 text-white' :
                  p === 'medium' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' :
                  'bg-green-500 hover:bg-green-600 text-white'
                ) : ''}
                onClick={() => setPriority(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Button>
            ))}
          </div>

          {/* Deadline */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <Input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* Reminders */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground font-medium">Reminders</span>
              <Button size="sm" variant="outline" onClick={addReminder} className="h-7 text-xs gap-1">
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
            {reminders.map((r) => (
              <div key={r.id} className="flex gap-2 items-center">
                <Input
                  type="time"
                  value={r.time}
                  onChange={(e) => updateReminder(r.id, { time: e.target.value })}
                  className="w-28 h-8 text-sm"
                />
                <select
                  value={r.escalationLevel}
                  onChange={(e) => updateReminder(r.id, { escalationLevel: e.target.value as any })}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  <option value="gentle">Gentle</option>
                  <option value="urgent">Urgent</option>
                  <option value="alarm">Alarm</option>
                </select>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeReminder(r.id)}>
                  <X className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          {/* Recurring */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={recurring !== null}
                onChange={(e) => setRecurring(e.target.checked ? { type: 'daily' } : null)}
                className="w-4 h-4 rounded border-input"
              />
              <Repeat className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Recurring</span>
            </label>
            {recurring && (
              <div className="mt-2 flex gap-2 pl-6">
                <select
                  value={recurring.type}
                  onChange={(e) => setRecurring({ ...recurring, type: e.target.value as any })}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="intraday">Multiple/day</option>
                </select>
                {recurring.type === 'intraday' && (
                  <Input
                    type="number"
                    placeholder="Every X hours"
                    min={1}
                    max={12}
                    value={recurring.interval || ''}
                    onChange={(e) => setRecurring({ ...recurring, interval: parseInt(e.target.value) })}
                    className="w-32 h-8 text-sm"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save */}
      <div className="flex gap-3 pt-2">
        <Button onClick={handleSave} className="flex-1">
          {editNote ? 'Update' : 'Save'}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function formatDateForInput(date: Date): string {
  return date.toISOString().slice(0, 16);
}

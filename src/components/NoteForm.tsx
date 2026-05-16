'use client';

import { useState, useEffect } from 'react';
import { db, type Note, type Reminder, type RecurringConfig } from '@/lib/db';
import { useSpeech, parseVoiceInput } from '@/hooks/useSpeech';
import { suggestCategory } from '@/lib/categories';
import { useLiveQuery } from 'dexie-react-hooks';

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

  const { transcript, isListening, startListening, stopListening, error: speechError } = useSpeech();

  const categories = useLiveQuery(() => db.categories.toArray());

  // Apply voice transcript
  useEffect(() => {
    if (transcript) {
      const parsed = parseVoiceInput(transcript);
      setContent((prev) => prev + (prev ? ' ' : '') + parsed.cleanText);
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

  // Suggest category as user types
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
          <input
            type="text"
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
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <button
            onClick={isListening ? stopListening : startListening}
            className={`p-3 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-600 hover:bg-blue-500'}`}
          >
            🎙️
          </button>
        </div>
        <p className="text-gray-500 text-xs">Press Enter to save. Voice button for speech. Sort later in organize mode.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6 space-y-4 max-h-[80vh] overflow-y-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">{editNote ? 'Edit' : 'New'} Note</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-white text-xl">✕</button>
      </div>

      {/* Title */}
      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Content + voice */}
      <div className="relative">
        <textarea
          placeholder="What's on your mind?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <button
          onClick={isListening ? stopListening : startListening}
          className={`absolute bottom-3 right-3 p-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-600 hover:bg-blue-500'}`}
        >
          🎙️
        </button>
      </div>
      {speechError && <p className="text-red-400 text-xs">{speechError}</p>}

      {/* Category */}
      <div className="flex gap-2 items-center">
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            const cat = categories?.find((c) => c.name === e.target.value);
            if (cat) setCategoryColor(cat.color);
          }}
          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
        >
          <option value="">No category</option>
          {categories?.map((cat) => (
            <option key={cat.id} value={cat.name}>{cat.name}</option>
          ))}
        </select>
        {suggestedCat && suggestedCat !== category && (
          <button
            onClick={() => {
              setCategory(suggestedCat);
              const cat = categories?.find((c) => c.name === suggestedCat);
              if (cat) setCategoryColor(cat.color);
            }}
            className="text-xs bg-blue-600/30 text-blue-300 px-2 py-1 rounded"
          >
            AI: {suggestedCat}?
          </button>
        )}
      </div>

      {/* Task toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isTask}
          onChange={(e) => setIsTask(e.target.checked)}
          className="w-5 h-5 rounded bg-gray-700 border-gray-600"
        />
        <span className="text-white font-medium">This is a task</span>
      </label>

      {/* Task fields */}
      {isTask && (
        <div className="space-y-3 pl-4 border-l-2 border-blue-500">
          {/* Priority */}
          <div className="flex gap-2">
            {(['high', 'medium', 'low'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  priority === p
                    ? p === 'high' ? 'bg-red-500 text-white' : p === 'medium' ? 'bg-yellow-500 text-black' : 'bg-green-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {/* Deadline */}
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
          />

          {/* Reminders */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-300 font-medium">Reminders</span>
              <button onClick={addReminder} className="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded text-white">
                + Add
              </button>
            </div>
            {reminders.map((r) => (
              <div key={r.id} className="flex gap-2 items-center">
                <input
                  type="time"
                  value={r.time}
                  onChange={(e) => updateReminder(r.id, { time: e.target.value })}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                />
                <select
                  value={r.escalationLevel}
                  onChange={(e) => updateReminder(r.id, { escalationLevel: e.target.value as any })}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                >
                  <option value="gentle">Gentle</option>
                  <option value="urgent">Urgent</option>
                  <option value="alarm">Alarm</option>
                </select>
                <button onClick={() => removeReminder(r.id)} className="text-red-400 hover:text-red-300 text-sm">✕</button>
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
                className="w-4 h-4 rounded bg-gray-700 border-gray-600"
              />
              <span className="text-sm text-gray-300">Recurring</span>
            </label>
            {recurring && (
              <div className="mt-2 flex gap-2">
                <select
                  value={recurring.type}
                  onChange={(e) => setRecurring({ ...recurring, type: e.target.value as any })}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="intraday">Multiple/day</option>
                </select>
                {recurring.type === 'intraday' && (
                  <input
                    type="number"
                    placeholder="Every X hours"
                    min={1}
                    max={12}
                    value={recurring.interval || ''}
                    onChange={(e) => setRecurring({ ...recurring, interval: parseInt(e.target.value) })}
                    className="w-32 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors"
        >
          {editNote ? 'Update' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function formatDateForInput(date: Date): string {
  return date.toISOString().slice(0, 16);
}

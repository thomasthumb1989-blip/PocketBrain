'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { useSpeech, parseVoiceInput } from '@/hooks/useSpeech';

interface QuickCaptureProps {
  onClose: () => void;
}

export default function QuickCapture({ onClose }: QuickCaptureProps) {
  const [text, setText] = useState('');
  const { transcript, isListening, startListening, stopListening } = useSpeech();

  useEffect(() => {
    if (transcript) {
      setText((prev) => prev + (prev ? ' ' : '') + transcript);
    }
  }, [transcript]);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    if (!text.trim()) return;

    const parsed = parseVoiceInput(text);

    await db.notes.add({
      title: parsed.cleanText.slice(0, 50),
      content: parsed.cleanText,
      category: '',
      categoryColor: '',
      priority: parsed.suggestedPriority,
      isTask: !!(parsed.suggestedDeadline || parsed.suggestedPriority),
      deadline: parsed.suggestedDeadline,
      reminders: [],
      recurring: null,
      progress: 0,
      completed: false,
      completedAt: null,
      archived: false,
      imageBlobs: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    setText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-start justify-center pt-20 z-50 p-4">
      <div className="w-full max-w-lg bg-gray-800 rounded-xl shadow-2xl p-4 animate-slide-down">
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            placeholder="Quick capture... (dates & priority auto-detected)"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <button
            onClick={isListening ? stopListening : startListening}
            className={`p-3 rounded-lg ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-600 hover:bg-blue-500'}`}
          >
            🎙️
          </button>
          <button
            onClick={handleSave}
            disabled={!text.trim()}
            className="px-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white rounded-lg font-medium"
          >
            ↵
          </button>
        </div>
        <p className="text-gray-500 text-xs mt-2">
          Ctrl+Space to toggle • Enter to save • Escape to close
        </p>
      </div>
    </div>
  );
}

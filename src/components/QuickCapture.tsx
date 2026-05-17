'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/db';
import { useSpeech, parseVoiceInput } from '@/hooks/useSpeech';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, CornerDownLeft } from 'lucide-react';

interface QuickCaptureProps {
  onClose: () => void;
}

export default function QuickCapture({ onClose }: QuickCaptureProps) {
  const [text, setText] = useState('');
  const { transcript, isListening, toggleListening, isSupported: micSupported } = useSpeech();

  const textBeforeVoiceRef = useRef('');

  useEffect(() => {
    if (isListening) {
      textBeforeVoiceRef.current = text;
    }
  }, [isListening]);

  useEffect(() => {
    if (transcript) {
      const before = textBeforeVoiceRef.current;
      setText(before ? before + ' ' + transcript : transcript);
    }
  }, [transcript]);

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
      <Card className="w-full max-w-lg animate-slide-down shadow-2xl">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              placeholder="Quick capture... (dates & priority auto-detected)"
              autoFocus
            />
            {micSupported && (
              <button
                type="button"
                onClick={toggleListening}
                className={`flex items-center justify-center w-10 h-10 rounded-lg select-none transition-colors ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            <Button
              size="icon"
              disabled={!text.trim()}
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-500"
            >
              <CornerDownLeft className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-muted-foreground text-xs mt-2">
            Ctrl+Space to toggle · Enter to save · Escape to close
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

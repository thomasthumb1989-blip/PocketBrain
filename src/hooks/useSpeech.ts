'use client';

import { useState, useCallback, useRef } from 'react';

interface SpeechResult {
  transcript: string;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  error: string | null;
}

export function useSpeech(): SpeechResult {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-GB';

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      setTranscript((prev) => prev + finalTranscript + interimTranscript);
    };

    recognition.onerror = (event: any) => {
      setError(event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  return { transcript, isListening, startListening, stopListening, error };
}

// Parse natural language for dates, priorities, categories
export function parseVoiceInput(text: string): {
  cleanText: string;
  suggestedDeadline: Date | null;
  suggestedPriority: 'high' | 'medium' | 'low' | null;
} {
  let cleanText = text;
  let suggestedDeadline: Date | null = null;
  let suggestedPriority: 'high' | 'medium' | 'low' | null = null;

  // Parse priority
  if (/\b(urgent|critical|asap|important)\b/i.test(text)) {
    suggestedPriority = 'high';
  } else if (/\b(soon|medium priority)\b/i.test(text)) {
    suggestedPriority = 'medium';
  } else if (/\b(low priority|whenever|no rush)\b/i.test(text)) {
    suggestedPriority = 'low';
  }

  // Parse relative dates
  const now = new Date();

  if (/\btomorrow\b/i.test(text)) {
    suggestedDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    cleanText = cleanText.replace(/\btomorrow\b/i, '').trim();
  } else if (/\btoday\b/i.test(text)) {
    suggestedDeadline = new Date(now);
    suggestedDeadline.setHours(23, 59, 0, 0);
    cleanText = cleanText.replace(/\btoday\b/i, '').trim();
  } else if (/\bnext week\b/i.test(text)) {
    suggestedDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    cleanText = cleanText.replace(/\bnext week\b/i, '').trim();
  } else if (/\bin (\d+) (hour|day|week|month)s?\b/i.test(text)) {
    const match = text.match(/\bin (\d+) (hour|day|week|month)s?\b/i);
    if (match) {
      const amount = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      const ms = {
        hour: 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
      }[unit] || 0;
      suggestedDeadline = new Date(now.getTime() + amount * ms);
      cleanText = cleanText.replace(/\bin \d+ (hour|day|week|month)s?\b/i, '').trim();
    }
  }

  // Parse day names
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    const regex = new RegExp(`\\b(this |next )?${days[i]}\\b`, 'i');
    if (regex.test(text)) {
      const target = i;
      const current = now.getDay();
      let daysUntil = target - current;
      if (daysUntil <= 0) daysUntil += 7;
      if (text.toLowerCase().includes('next')) daysUntil += 7;
      suggestedDeadline = new Date(now.getTime() + daysUntil * 24 * 60 * 60 * 1000);
      cleanText = cleanText.replace(regex, '').trim();
      break;
    }
  }

  // Clean up common voice command prefixes
  cleanText = cleanText
    .replace(/^(remind me to |add task |note that |remember to )/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { cleanText, suggestedDeadline, suggestedPriority };
}

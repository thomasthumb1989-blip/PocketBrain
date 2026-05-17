'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface SpeechResult {
  transcript: string;
  isListening: boolean;
  toggleListening: () => void;
  error: string | null;
  isSupported: boolean;
}

function getSpeechRecognition(): any | null {
  if (typeof window === 'undefined') return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

export function useSpeech(): SpeechResult {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const listeningRef = useRef(false);

  useEffect(() => {
    setIsSupported(getSpeechRecognition() !== null);
  }, []);

  const toggleListening = useCallback(() => {
    // ---- STOP ----
    if (listeningRef.current) {
      console.log('[PocketBrain] STOP listening');
      listeningRef.current = false;
      setIsListening(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
      return;
    }

    // ---- START ----
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) {
      setError('Voice input not supported. Try Chrome, Edge, or Safari.');
      setIsSupported(false);
      return;
    }

    console.log('[PocketBrain] START listening');

    // Clean up any stale instance
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    setTranscript('');
    setError(null);
    listeningRef.current = true;
    setIsListening(true);

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-GB';

    let finalSoFar = '';

    recognition.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';

      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript + ' ';
        } else {
          interimText += event.results[i][0].transcript;
        }
      }

      if (finalText.trim()) {
        finalSoFar = finalText.trim();
      }
      // Show final + current interim (replaces, not appends)
      const display = (finalSoFar + ' ' + interimText).trim();
      console.log('[PocketBrain] Result:', display);
      if (display) setTranscript(display);
    };

    recognition.onerror = (event: any) => {
      console.error('[PocketBrain] Error:', event.error);
      if (event.error === 'no-speech') {
        // Don't kill — just keep listening
        return;
      }
      if (event.error === 'not-allowed') {
        setError('Mic access denied. Enable in browser settings.');
      } else if (event.error === 'audio-capture') {
        setError('No mic found or mic in use.');
      } else if (event.error === 'network') {
        setError('Network error. Voice needs internet.');
      } else if (event.error !== 'aborted') {
        setError(`Voice error: ${event.error}`);
      }
      listeningRef.current = false;
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log('[PocketBrain] Recognition ended');
      // If we're still supposed to be listening, restart (mobile kills on silence)
      if (listeningRef.current) {
        console.log('[PocketBrain] Auto-restarting...');
        try {
          recognition.start();
          return;
        } catch {
          // Can't restart
        }
      }
      listeningRef.current = false;
      setIsListening(false);
      if (finalSoFar) setTranscript(finalSoFar);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      console.log('[PocketBrain] recognition.start() OK');
    } catch (e: any) {
      console.error('[PocketBrain] Start failed:', e);
      setError(`Failed to start: ${e.message}`);
      listeningRef.current = false;
      setIsListening(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      listeningRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
      }
    };
  }, []);

  return { transcript, isListening, toggleListening, error, isSupported };
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

  if (/\b(urgent|critical|asap|important)\b/i.test(text)) {
    suggestedPriority = 'high';
  } else if (/\b(soon|medium priority)\b/i.test(text)) {
    suggestedPriority = 'medium';
  } else if (/\b(low priority|whenever|no rush)\b/i.test(text)) {
    suggestedPriority = 'low';
  }

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

  cleanText = cleanText
    .replace(/^(remind me to |add task |note that |remember to )/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { cleanText, suggestedDeadline, suggestedPriority };
}

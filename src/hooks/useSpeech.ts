'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface SpeechResult {
  transcript: string;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
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
  const shouldRestartRef = useRef(false);

  // Check support on mount
  useEffect(() => {
    setIsSupported(getSpeechRecognition() !== null);
  }, []);

  const startListening = useCallback(async () => {
    const SpeechRecognitionClass = getSpeechRecognition();

    if (!SpeechRecognitionClass) {
      setError('Voice input not supported in this browser. Try Chrome, Edge, or Safari.');
      setIsSupported(false);
      return;
    }

    // Request mic permission explicitly first (needed for mobile PWAs)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately — we just needed the permission grant
      stream.getTracks().forEach((track) => track.stop());
    } catch (e: any) {
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setError('Microphone access denied. Please enable mic in your browser/device settings.');
      } else if (e.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.');
      } else {
        setError(`Microphone error: ${e.message}`);
      }
      return;
    }

    // Reset transcript on new listen session
    setTranscript('');
    setError(null);
    shouldRestartRef.current = true;

    const recognition = new SpeechRecognitionClass();

    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-GB';
    // Max alternatives for better accuracy on mobile
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);

      switch (event.error) {
        case 'not-allowed':
          setError('Microphone access denied. Enable mic in browser settings.');
          shouldRestartRef.current = false;
          break;
        case 'no-speech':
          // Don't show error for no-speech, just restart if still listening
          if (shouldRestartRef.current) {
            try { recognition.start(); } catch {}
            return;
          }
          break;
        case 'network':
          setError('Network error. Voice recognition needs internet in some browsers.');
          shouldRestartRef.current = false;
          break;
        case 'aborted':
          // User or system cancelled — don't show error
          break;
        case 'audio-capture':
          setError('No microphone found or mic is in use by another app.');
          shouldRestartRef.current = false;
          break;
        case 'service-not-allowed':
          setError('Speech service not available. Try Chrome or Safari.');
          shouldRestartRef.current = false;
          break;
        default:
          setError(`Voice error: ${event.error}`);
          shouldRestartRef.current = false;
      }

      if (!shouldRestartRef.current) {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart on mobile where recognition stops after silence
      if (shouldRestartRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          // Can't restart, fall through to stop
        }
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (e: any) {
      setError(`Failed to start voice input: ${e.message}`);
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return { transcript, isListening, startListening, stopListening, error, isSupported };
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

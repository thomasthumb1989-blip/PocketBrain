'use client';

import { useState, useEffect, useRef } from 'react';
import { type Note } from '@/lib/db';
import TaskCard from './TaskCard';
import Confetti from './Confetti';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Coffee, X, Timer } from 'lucide-react';

interface FocusModeProps {
  tasks: Note[];
  onComplete: (id: number) => void;
  onExit: () => void;
}

export default function FocusMode({ tasks, onComplete, onExit }: FocusModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showNextPrompt, setShowNextPrompt] = useState(false);
  const [focusTimer, setFocusTimer] = useState(0);
  const [showHyperfocusAlert, setShowHyperfocusAlert] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentTask = tasks[currentIndex];

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setFocusTimer((prev) => {
        const next = prev + 1;
        if (next >= 2700 && next % 2700 === 0) {
          setShowHyperfocusAlert(true);
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleComplete = (id: number) => {
    onComplete(id);
    setShowCelebration(true);

    setTimeout(() => {
      setShowCelebration(false);
      if (currentIndex < tasks.length - 1) {
        setShowNextPrompt(true);
      } else {
        onExit();
      }
    }, 2000);
  };

  const handleNext = () => {
    setShowNextPrompt(false);
    setCurrentIndex((prev) => prev + 1);
    setFocusTimer(0);
  };

  if (!currentTask) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-foreground mb-2">All done!</h2>
        <p className="text-muted-foreground mb-6">You crushed it today.</p>
        <Button onClick={onExit}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="relative min-h-[80vh] flex flex-col items-center justify-center p-4">
      {showCelebration && <Confetti />}

      {/* Hyperfocus alert */}
      {showHyperfocusAlert && (
        <Card className="absolute top-4 left-4 right-4 border-yellow-500/50 bg-yellow-500/10 z-50">
          <CardContent className="p-4">
            <p className="text-yellow-300 font-medium flex items-center gap-2">
              <Timer className="w-4 h-4" />
              45 minutes on this task. Still the right thing to work on?
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="bg-green-600 hover:bg-green-500" onClick={() => setShowHyperfocusAlert(false)}>
                Yes, continue
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setShowHyperfocusAlert(false); onExit(); }}>
                Switch task
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* "Ready for next?" prompt */}
      {showNextPrompt && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
          <Card className="max-w-sm">
            <CardContent className="p-8 text-center">
              <div className="text-4xl mb-4">✨</div>
              <h3 className="text-xl font-bold text-foreground mb-2">Nice one!</h3>
              <p className="text-muted-foreground mb-6">Ready for the next task?</p>
              <div className="flex gap-3 justify-center">
                <Button onClick={handleNext}>
                  <ArrowRight className="w-4 h-4 mr-1" /> Let's go
                </Button>
                <Button variant="outline" onClick={onExit}>
                  <Coffee className="w-4 h-4 mr-1" /> Take a break
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Focus header */}
      <div className="text-center mb-8">
        <Badge variant="secondary" className="mb-2">
          Focus Mode
        </Badge>
        <p className="text-muted-foreground text-sm">Task {currentIndex + 1} of {tasks.length}</p>
        <p className="text-muted-foreground/70 text-xs mt-1 font-mono">
          {Math.floor(focusTimer / 60)}:{(focusTimer % 60).toString().padStart(2, '0')} focused
        </p>
      </div>

      {/* Single task card - large */}
      <div className="w-full max-w-md">
        <TaskCard
          task={currentTask}
          onComplete={handleComplete}
          onEdit={() => {}}
        />
      </div>

      {/* Exit */}
      <Button variant="ghost" className="mt-8 text-muted-foreground" onClick={onExit}>
        <X className="w-4 h-4 mr-1" /> Exit Focus Mode
      </Button>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { type Note, db, calculateProgress } from '@/lib/db';
import TaskCard from './TaskCard';
import Confetti from './Confetti';

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

  // 45-min hyperfocus check-in
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setFocusTimer((prev) => {
        const next = prev + 1;
        if (next >= 2700 && next % 2700 === 0) { // Every 45 min
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
        <h2 className="text-2xl font-bold text-white mb-2">All done!</h2>
        <p className="text-gray-400 mb-6">You crushed it today.</p>
        <button onClick={onExit} className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg text-white font-medium">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-[80vh] flex flex-col items-center justify-center p-4">
      {/* Confetti overlay */}
      {showCelebration && <Confetti />}

      {/* Hyperfocus alert */}
      {showHyperfocusAlert && (
        <div className="absolute top-4 left-4 right-4 bg-yellow-500/20 border border-yellow-500 rounded-lg p-4 z-50">
          <p className="text-yellow-300 font-medium">⏰ 45 minutes on this task. Still the right thing to work on?</p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setShowHyperfocusAlert(false)}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm"
            >
              Yes, continue
            </button>
            <button
              onClick={() => { setShowHyperfocusAlert(false); onExit(); }}
              className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
            >
              Switch task
            </button>
          </div>
        </div>
      )}

      {/* "Ready for next?" prompt */}
      {showNextPrompt && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
          <div className="bg-gray-800 rounded-xl p-8 text-center max-w-sm">
            <div className="text-4xl mb-4">✨</div>
            <h3 className="text-xl font-bold text-white mb-2">Nice one!</h3>
            <p className="text-gray-400 mb-6">Ready for the next task?</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium"
              >
                Let's go →
              </button>
              <button
                onClick={onExit}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg"
              >
                Take a break
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Focus header */}
      <div className="text-center mb-8">
        <p className="text-gray-400 text-sm">Focus Mode • Task {currentIndex + 1} of {tasks.length}</p>
        <p className="text-gray-500 text-xs mt-1">
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
      <button
        onClick={onExit}
        className="mt-8 text-gray-500 hover:text-gray-300 text-sm"
      >
        Exit Focus Mode
      </button>
    </div>
  );
}

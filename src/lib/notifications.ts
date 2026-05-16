'use client';

import { db, type Note, type Reminder } from './db';

let notificationPermission: NotificationPermission = 'default';
let checkInterval: NodeJS.Timeout | null = null;
let escalationTimers: Map<string, NodeJS.Timeout> = new Map();

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;

  const result = await Notification.requestPermission();
  notificationPermission = result;
  return result === 'granted';
}

export function startReminderChecker() {
  if (checkInterval) return;

  // Check every 30 seconds
  checkInterval = setInterval(checkReminders, 30000);
  checkReminders(); // immediate first check
}

export function stopReminderChecker() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  escalationTimers.forEach((timer) => clearTimeout(timer));
  escalationTimers.clear();
}

async function checkReminders() {
  if (notificationPermission !== 'granted') return;

  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const tasks = await db.notes
    .where('isTask')
    .equals(1)
    .and((note) => !note.completed && !note.archived)
    .toArray();

  for (const task of tasks) {
    for (const reminder of task.reminders) {
      if (!reminder.enabled) continue;

      // Check if current time matches (within 1 minute window)
      if (isTimeMatch(currentTime, reminder.time)) {
        triggerNotification(task, reminder);
      }
    }

    // Check overdue
    if (task.deadline && new Date(task.deadline) < now) {
      const overdueKey = `overdue-${task.id}`;
      if (!escalationTimers.has(overdueKey)) {
        triggerOverdueNotification(task);
      }
    }
  }
}

function isTimeMatch(current: string, target: string): boolean {
  const [ch, cm] = current.split(':').map(Number);
  const [th, tm] = target.split(':').map(Number);
  return ch === th && Math.abs(cm - tm) <= 1;
}

function triggerNotification(task: Note, reminder: Reminder) {
  const key = `${task.id}-${reminder.id}`;
  if (escalationTimers.has(key)) return; // Already triggered

  sendNotification(task.title, {
    body: getEscalationMessage(reminder.escalationLevel, task),
    tag: key,
    requireInteraction: reminder.escalationLevel !== 'gentle',
  });

  // Escalation: repeat if not acknowledged
  scheduleEscalation(task, reminder, key);
}

function scheduleEscalation(task: Note, reminder: Reminder, key: string) {
  const delays = {
    gentle: [5 * 60000], // repeat once after 5 min
    urgent: [2 * 60000, 5 * 60000, 10 * 60000], // 2, 5, 10 min
    alarm: [1 * 60000, 2 * 60000, 3 * 60000, 5 * 60000, 10 * 60000], // aggressive
  };

  const schedule = delays[reminder.escalationLevel];
  let level = 0;

  const escalate = () => {
    if (level >= schedule.length) {
      escalationTimers.delete(key);
      return;
    }

    const timer = setTimeout(() => {
      sendNotification(`⚠️ ${task.title}`, {
        body: `REMINDER #${level + 2}: ${task.title}`,
        tag: `${key}-${level}`,
        requireInteraction: true,
      });
      level++;
      escalate();
    }, schedule[level]);

    escalationTimers.set(key, timer);
  };

  escalate();
}

function triggerOverdueNotification(task: Note) {
  const key = `overdue-${task.id}`;
  sendNotification(`🔴 OVERDUE: ${task.title}`, {
    body: `This task is past its deadline!`,
    tag: key,
    requireInteraction: true,
  });

  // Re-notify every 30 min for overdue
  const timer = setTimeout(() => {
    escalationTimers.delete(key);
  }, 30 * 60000);
  escalationTimers.set(key, timer);
}

function getEscalationMessage(level: string, task: Note): string {
  switch (level) {
    case 'gentle':
      return `Reminder: ${task.content.slice(0, 50)}`;
    case 'urgent':
      return `⚡ Don't forget: ${task.title}`;
    case 'alarm':
      return `🚨 ACTION NEEDED: ${task.title}`;
    default:
      return task.title;
  }
}

function sendNotification(title: string, options: NotificationOptions) {
  if (notificationPermission !== 'granted') return;
  try {
    new Notification(title, {
      icon: '/icon-192.png',
      ...options,
    });
  } catch {
    // Service worker notification fallback
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        options,
      });
    }
  }
}

export function acknowledgeReminder(key: string) {
  const timer = escalationTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    escalationTimers.delete(key);
  }
}

# PocketBrain — Complete Spec (ADHD-Optimized)

**Platform:** Next.js PWA | **Storage:** IndexedDB (Dexie.js) | **Theme:** Dark + category accent colors

## Core Data Model

- Unified notes — toggle `isTask` for deadlines/reminders
- Custom categories with accent colors
- Priority: High / Medium / Low
- Images attachable (stored as blobs in IndexedDB)
- ML classifier suggests category (TF-IDF + naive bayes, trained on user's notes)

## Dashboard (Front Page)

- Tasks sorted by deadline (soonest first)
- No-deadline notes hidden from dashboard
- Time-based progress bars (auto-fill toward deadline)
- Overdue items = red, urgent feel
- Max 5 visible + "show more" (anti-overwhelm)
- Color-coded by category

## Focus Mode

- One task at a time — single card, nothing else
- On completion: celebration animation → "Ready for next?" prompt
- 45-min hyperfocus check-in timer (nudge to reassess)

## Capture (Speed-First)

- Floating mic button on every screen — one tap voice
- Keyboard shortcut (Ctrl+Space) instant quick-add
- Brain dump mode — rapid-fire capture, no organizing required
- AI organizes dumps later (suggests deadlines, categories, priorities)
- Voice → transcribe (Web Speech API) → AI suggests parsed fields → confirm

## Reminders & Notifications

- Browser push notifications
- Escalating: gentle → urgent → alarm sound if ignored
- Intra-day: exact times OR interval (every Xh between start-end)
- Recurring: daily/weekly/monthly
- Multiple reminders per task per day

## Rewards & Dopamine

- Confetti/animation + sound on task completion
- Streak counter — daily completion streak
- Daily score — tasks done vs planned

## Daily Rituals

- Morning: "Pick your 3 tasks for today" prompt
- Evening: Summary of wins (what got done)

## Task Lifecycle

- Active → Completed (celebration) → Auto-archived
- Archive searchable
- One-tap snooze/reschedule (hard deadlines but not punishing)

## Search

- Full-text search + filter by category/priority/date range
- Saved smart filters (e.g., "High priority Health tasks")

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Dexie.js (IndexedDB wrapper)
- Web Speech API (voice input)
- Service Worker (offline + push notifications)
- PWA manifest (installable)

## Design

- Dark base theme
- Each category gets a unique accent color
- Minimal, clean UI — avoid visual clutter
- Animations: subtle, satisfying, not distracting

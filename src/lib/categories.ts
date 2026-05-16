// Simple TF-IDF + keyword classifier for category suggestion
// Trains on user's existing notes

import { db, type Note } from './db';

interface TermFrequency {
  [term: string]: number;
}

interface CategoryModel {
  [category: string]: TermFrequency;
}

let model: CategoryModel = {};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export async function trainModel() {
  const notes = await db.notes.where('category').notEqual('').toArray();
  model = {};

  for (const note of notes) {
    const cat = note.category;
    if (!model[cat]) model[cat] = {};

    const tokens = tokenize(`${note.title} ${note.content}`);
    for (const token of tokens) {
      model[cat][token] = (model[cat][token] || 0) + 1;
    }
  }
}

export function suggestCategory(title: string, content: string): { category: string; confidence: number } | null {
  if (Object.keys(model).length === 0) return null;

  const tokens = tokenize(`${title} ${content}`);
  if (tokens.length === 0) return null;

  let bestCategory = '';
  let bestScore = 0;

  for (const [category, terms] of Object.entries(model)) {
    let score = 0;
    for (const token of tokens) {
      if (terms[token]) {
        score += terms[token];
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  if (bestScore === 0) return null;

  // Normalize confidence (0-1)
  const totalTerms = Object.values(model[bestCategory] || {}).reduce((a, b) => a + b, 0);
  const confidence = Math.min(1, bestScore / Math.max(1, totalTerms) * 2);

  return { category: bestCategory, confidence };
}

// Default category colors
export const DEFAULT_COLORS = [
  '#FF6B6B', // red
  '#4ECDC4', // teal
  '#45B7D1', // blue
  '#96CEB4', // green
  '#FFEAA7', // yellow
  '#DDA0DD', // plum
  '#98D8C8', // mint
  '#F7DC6F', // gold
  '#BB8FCE', // purple
  '#85C1E9', // sky
];

export function getNextColor(existingColors: string[]): string {
  const available = DEFAULT_COLORS.filter((c) => !existingColors.includes(c));
  return available[0] || DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
}

const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
  { name: 'Work', color: '#FF6B6B' },
  { name: 'Personal', color: '#4ECDC4' },
  { name: 'Health', color: '#96CEB4' },
  { name: 'Finance', color: '#FFEAA7' },
  { name: 'Home', color: '#F7DC6F' },
  { name: 'Errands', color: '#DDA0DD' },
  { name: 'Quick Wins', color: '#45B7D1' },
  { name: 'Deep Work', color: '#BB8FCE' },
  { name: 'Morning Routine', color: '#FFB347' },
  { name: 'Evening Routine', color: '#7B68EE' },
  { name: 'Appointments', color: '#85C1E9' },
  { name: 'Phone Calls', color: '#E8A87C' },
  { name: 'Self-Care', color: '#98D8C8' },
  { name: 'Fitness', color: '#FF7675' },
  { name: 'Family', color: '#FDA7DF' },
  { name: 'Social', color: '#55E6C1' },
  { name: 'Learning', color: '#74B9FF' },
  { name: 'Projects', color: '#A29BFE' },
  { name: 'Waiting On', color: '#FDCB6E' },
  { name: 'Someday', color: '#636E72' },
];

export async function seedDefaultCategories() {
  const count = await db.categories.count();
  if (count > 0) return; // Already seeded

  await db.categories.bulkAdd(
    DEFAULT_CATEGORIES.map((cat) => ({
      ...cat,
      createdAt: new Date(),
    }))
  );
}

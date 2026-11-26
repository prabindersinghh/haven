// Phrase scoring for the reference Awaaz engine. Pure functions, no browser APIs.

import { MEMBER_PHRASES, type Phrase } from '../i18n/phrases';
import type { Lang } from '../types';

export interface Candidate {
  phraseId: string;
  score: number;
}

export interface MatchResult {
  candidates: Candidate[];
  /** True when no candidate clears the confidence threshold: Awaaz asks again instead of guessing. */
  abstained: boolean;
}

/** Per-user usage history: how often each phrase was confirmed, overall and per part of day. */
export interface HabitModel {
  total: Record<string, number>;
  byDaypart: Record<string, Record<string, number>>;
}

export const ABSTAIN_THRESHOLD = 0.35;
const TEXT_WEIGHT = 0.8;
const HABIT_WEIGHT = 0.2;

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFC')
    .replace(/[.,!?;:"'()\-–—…।]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const out = new Set<string>();
  const chars = Array.from(padded);
  for (let i = 0; i + 3 <= chars.length; i++) out.add(chars.slice(i, i + 3).join(''));
  return out;
}

export function trigramSimilarity(a: string, b: string): number {
  const A = trigrams(normalize(a));
  const B = trigrams(normalize(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((g) => B.has(g) && inter++);
  return inter / (A.size + B.size - inter);
}

/** Text similarity between a transcript and a phrase, using its text in every language and its cues. */
export function textScore(transcript: string, phrase: Phrase): number {
  const t = normalize(transcript);
  if (!t) return 0;
  const words = new Set(t.split(' '));
  const cueHit = (phrase.cues ?? []).some((c) => {
    const n = normalize(c);
    return n.includes(' ') ? t.includes(n) : words.has(n) || (n.length >= 4 && t.includes(n));
  });
  const textSim = Math.max(...(Object.values(phrase.text) as string[]).map((p) => trigramSimilarity(t, p)));
  return Math.min(1, Math.max(cueHit ? 0.75 + 0.25 * textSim : 0, textSim * 1.4));
}

export function daypart(date = new Date()): string {
  const h = date.getHours();
  return h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
}

/** Probability-like prior from the user's own confirmations, smoothed so new phrases are not penalised. */
export function habitPrior(habits: HabitModel, phraseId: string, part: string): number {
  const n = MEMBER_PHRASES.length;
  const sum = (r: Record<string, number> = {}) => Object.values(r).reduce((a, b) => a + b, 0);
  const all = ((habits.total[phraseId] ?? 0) + 1) / (sum(habits.total) + n);
  const dp = habits.byDaypart[part] ?? {};
  const local = ((dp[phraseId] ?? 0) + 1) / (sum(dp) + n);
  return Math.min(1, ((all + local) / 2) * n * 0.5);
}

/**
 * Ranks the phrase bank against one or more recogniser hypotheses.
 * The transcript evidence dominates; the habit prior only separates close candidates.
 */
export function rankPhrases(hypotheses: string[], habits: HabitModel, lang: Lang, when = new Date(), k = 3): MatchResult {
  void lang;
  const part = daypart(when);
  const scored = MEMBER_PHRASES.map((p) => {
    const text = Math.max(0, ...hypotheses.map((h) => textScore(h, p)));
    const score = text === 0 ? 0 : TEXT_WEIGHT * text + HABIT_WEIGHT * habitPrior(habits, p.id, part);
    return { phraseId: p.id, score: Math.round(score * 1000) / 1000 };
  })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
  return { candidates: scored, abstained: !scored.length || scored[0].score < ABSTAIN_THRESHOLD };
}

export function recordConfirmation(habits: HabitModel, phraseId: string, when = new Date()): HabitModel {
  const part = daypart(when);
  const byPart = { ...(habits.byDaypart[part] ?? {}) };
  byPart[phraseId] = (byPart[phraseId] ?? 0) + 1;
  return {
    total: { ...habits.total, [phraseId]: (habits.total[phraseId] ?? 0) + 1 },
    byDaypart: { ...habits.byDaypart, [part]: byPart },
  };
}

export const emptyHabits = (): HabitModel => ({ total: {}, byDaypart: {} });

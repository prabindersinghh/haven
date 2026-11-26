// Event-sourced Haven state. Every view is a projection of the ordered message log,
// so a reconnecting client rebuilds exactly the same cases from Nexconn history.

import { PHRASE_BY_ID } from '../i18n/phrases';
import {
  MSG,
  type CaseEventContent,
  type CaseState,
  type CheckInContent,
  type HavenMessage,
  type HelloContent,
  type Profile,
  type SayContent,
  type Urgency,
} from '../types';

export interface CaseRecord {
  caseId: string;
  subject: Profile;
  reasonPhraseId?: string;
  reasonText?: string;
  urgency: Urgency;
  state: CaseState;
  openedAt: number;
  owner?: Profile;
  claimedAt?: number;
  resolvedAt?: number;
  escalatedAt?: number;
  history: { state: CaseState; actor: Profile; at: number }[];
}

export interface CheckInRecord {
  checkInId: string;
  subjectId: string;
  askedBy: Profile;
  askedAt: number;
  response?: 'ok' | 'not_ok';
  answeredAt?: number;
}

export interface HavenState {
  people: Map<string, Profile>;
  cases: Map<string, CaseRecord>;
  checkIns: Map<string, CheckInRecord>;
  log: HavenMessage[];
  ids: Set<string>;
}

export const emptyState = (): HavenState => ({
  people: new Map(),
  cases: new Map(),
  checkIns: new Map(),
  log: [],
  ids: new Set(),
});

const URGENCY_RANK: Record<Urgency, number> = { high: 0, medium: 1, low: 2 };

function remember(s: HavenState, p: Profile) {
  s.people.set(p.userId, p);
}

/** Applies one message. Mutates and returns a fresh outer object so React re-renders. */
export function apply(prev: HavenState, m: HavenMessage): HavenState {
  if (prev.ids.has(m.id)) return prev;
  const s: HavenState = { ...prev, log: [...prev.log, m], ids: new Set(prev.ids).add(m.id), cases: new Map(prev.cases), checkIns: new Map(prev.checkIns), people: new Map(prev.people) };

  switch (m.type) {
    case MSG.HELLO: {
      remember(s, (m.content as HelloContent).from);
      break;
    }
    case MSG.SAY: {
      const c = m.content as SayContent;
      remember(s, c.from);
      if (c.caseId && !s.cases.has(c.caseId)) {
        s.cases.set(c.caseId, {
          caseId: c.caseId,
          subject: c.from,
          reasonPhraseId: c.phraseId,
          reasonText: c.text,
          urgency: c.urgency,
          state: 'new',
          openedAt: m.sentTime,
          history: [{ state: 'new', actor: c.from, at: m.sentTime }],
        });
      }
      break;
    }
    case MSG.CASE: {
      const c = m.content as CaseEventContent;
      remember(s, c.actor);
      let rec = s.cases.get(c.caseId);
      if (!rec) {
        const subject = s.people.get(c.subjectId) ?? { userId: c.subjectId, name: c.subjectId, role: 'member', lang: 'en' };
        rec = {
          caseId: c.caseId,
          subject,
          reasonPhraseId: c.reasonPhraseId,
          urgency: c.urgency ?? PHRASE_BY_ID.get(c.reasonPhraseId ?? '')?.urgency ?? 'medium',
          state: 'new',
          openedAt: m.sentTime,
          history: [],
        };
      } else {
        rec = { ...rec, history: [...rec.history] };
      }
      if (rec.state === 'resolved' && c.state !== 'new') break; // resolved is terminal
      rec.state = c.state;
      rec.history.push({ state: c.state, actor: c.actor, at: m.sentTime });
      if (c.state === 'claimed') {
        rec.owner = c.actor;
        rec.claimedAt = rec.claimedAt ?? m.sentTime;
      }
      if (c.state === 'escalated') rec.escalatedAt = rec.escalatedAt ?? m.sentTime;
      if (c.state === 'resolved') rec.resolvedAt = m.sentTime;
      s.cases.set(c.caseId, rec);
      break;
    }
    case MSG.CHECKIN: {
      const c = m.content as CheckInContent;
      remember(s, c.from);
      const existing = s.checkIns.get(c.checkInId);
      if (c.kind === 'ask') {
        s.checkIns.set(c.checkInId, { checkInId: c.checkInId, subjectId: c.subjectId, askedBy: c.from, askedAt: m.sentTime, ...(existing ?? {}) });
      } else if (existing) {
        s.checkIns.set(c.checkInId, { ...existing, response: c.response, answeredAt: m.sentTime });
      } else {
        s.checkIns.set(c.checkInId, { checkInId: c.checkInId, subjectId: c.subjectId, askedBy: c.from, askedAt: m.sentTime, response: c.response, answeredAt: m.sentTime });
      }
      break;
    }
  }
  return s;
}

export function applyAll(s: HavenState, ms: HavenMessage[]) {
  return [...ms].sort((a, b) => a.sentTime - b.sentTime).reduce(apply, s);
}

/** Open cases first by urgency, then oldest first. */
export function sortedCases(s: HavenState): CaseRecord[] {
  return [...s.cases.values()].sort((a, b) => {
    const openA = a.state === 'resolved' ? 1 : 0;
    const openB = b.state === 'resolved' ? 1 : 0;
    if (openA !== openB) return openA - openB;
    if (a.state === 'resolved') return (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0);
    return URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || a.openedAt - b.openedAt;
  });
}

/** Escalation SLA: minutes a case may stay unclaimed before it escalates to staff. */
export const DEFAULT_SLA_MIN: Record<Urgency, number> = { high: 2, medium: 5, low: 15 };
/** Minutes a check-in may go unanswered before it opens a case. */
export const CHECKIN_WINDOW_MIN = 10;

export function overdueCases(s: HavenState, now: number, sla = DEFAULT_SLA_MIN) {
  return [...s.cases.values()].filter((c) => c.state === 'new' && now - c.openedAt > sla[c.urgency] * 60_000);
}

export function missedCheckIns(s: HavenState, now: number, windowMin = CHECKIN_WINDOW_MIN) {
  return [...s.checkIns.values()].filter((c) => !c.response && now - c.askedAt > windowMin * 60_000);
}

/** Messages that belong in the conversation between `me` and `other`. */
export function conversation(s: HavenState, me: string, other: string) {
  return s.log.filter((m) => {
    if (m.type !== MSG.SAY && m.type !== MSG.CHECKIN) return false;
    if (m.channel.kind === 'direct') return m.channel.id === other;
    // group traffic from the member is part of every carer's view of that member
    return m.senderId === other || (m.senderId === me && (m.content as SayContent).to === other);
  });
}

export const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

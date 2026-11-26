export type Lang = 'en' | 'hi' | 'pa';
export type Role = 'member' | 'volunteer' | 'family' | 'staff';
export type Urgency = 'high' | 'medium' | 'low';

export interface Profile {
  userId: string;
  name: string;
  role: Role;
  lang: Lang;
}

/** Custom Nexconn message types registered with NCEngine.registerCustomMessages. */
export const MSG = {
  /** Something said: an Awaaz-confirmed phrase, a quick reply or free text. */
  SAY: 'haven:say',
  /** A case lifecycle event (new, claimed, in progress, escalated, resolved). */
  CASE: 'haven:case',
  /** A check-in prompt or its answer. */
  CHECKIN: 'haven:checkin',
  /** Profile announcement so consoles know who is in the network. */
  HELLO: 'haven:hello',
} as const;
export type MsgType = (typeof MSG)[keyof typeof MSG];

export interface SayContent {
  /** Closed-set phrase id: rendered in each reader's own language. */
  phraseId?: string;
  /** Free text, shown as written with its source language. */
  text?: string;
  srcLang: Lang;
  urgency: Urgency;
  from: Profile;
  /** Present when this message opened a case. */
  caseId?: string;
  /** Direct recipient, when sent 1:1. */
  to?: string;
}

export type CaseState = 'new' | 'claimed' | 'in_progress' | 'escalated' | 'resolved';

export interface CaseEventContent {
  caseId: string;
  subjectId: string;
  state: CaseState;
  actor: Profile;
  /** Why the case was opened when it was not a SayContent (missed or "not okay" check-in). */
  reasonPhraseId?: string;
  urgency?: Urgency;
}

export interface CheckInContent {
  checkInId: string;
  subjectId: string;
  kind: 'ask' | 'reply';
  response?: 'ok' | 'not_ok';
  from: Profile;
}

export interface HelloContent {
  from: Profile;
}

export type ChannelRef = { kind: 'group'; id: string } | { kind: 'direct'; id: string };

export interface HavenMessage<T = unknown> {
  id: string;
  type: MsgType;
  content: T;
  senderId: string;
  sentTime: number;
  /** For direct messages, id is the other party's user id from this client's perspective. */
  channel: ChannelRef;
}

export interface Session {
  mode: 'nexconn' | 'local';
  userId: string;
  dispatchChannelId: string;
  appKey?: string;
  areaCode?: number;
  token?: string;
}

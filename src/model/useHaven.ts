import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createTransport, type ConnectionState, type Transport } from '../transport';
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
  type Session,
  type Urgency,
} from '../types';
import { applyAll, apply, emptyState, missedCheckIns, newId, overdueCases, type HavenState } from './state';

export interface HavenApi {
  state: HavenState;
  connection: ConnectionState;
  error: string | null;
  mode: Session['mode'];
  typingFrom: string | null;
  /** Member: send a confirmed phrase (or text) to the dispatch room, opening a case when needed. */
  say(input: { phraseId?: string; text?: string }): Promise<void>;
  /** Carer: reply 1:1 to a member. */
  reply(member: Profile, input: { phraseId?: string; text?: string }, caseId?: string): Promise<void>;
  setCaseState(caseId: string, subjectId: string, state: CaseState, extra?: Partial<CaseEventContent>): Promise<void>;
  askCheckIn(member: Profile): Promise<void>;
  answerCheckIn(checkInId: string, response: 'ok' | 'not_ok'): Promise<void>;
  notifyTyping(userId: string): void;
}

export function useHaven(me: Profile, session: Session): HavenApi {
  const [state, setState] = useState<HavenState>(emptyState);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [typingFrom, setTypingFrom] = useState<string | null>(null);
  const transport = useRef<Transport | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const ingest = useCallback((m: HavenMessage) => setState((s) => apply(s, m)), []);

  useEffect(() => {
    let cancelled = false;
    const offs: (() => void)[] = [];
    (async () => {
      try {
        const t = await createTransport(session);
        if (cancelled) return;
        transport.current = t;
        offs.push(t.onConnection(setConnection));
        offs.push(t.onMessage(ingest));
        offs.push(
          t.onTyping((from) => {
            setTypingFrom(from);
            window.setTimeout(() => setTypingFrom((f) => (f === from ? null : f)), 4000);
          }),
        );
        await t.connect();
        const history = await t.loadHistory();
        if (cancelled) return;
        setState((s) => applyAll(s, history));
        await t.send<HelloContent>({ kind: 'group' }, MSG.HELLO, { from: me });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setConnection('disconnected');
      }
    })();
    return () => {
      cancelled = true;
      offs.forEach((off) => off());
      void transport.current?.disconnect();
      transport.current = null;
    };
  }, [session, me, ingest]);

  const send = useCallback(
    async <T,>(target: Parameters<Transport['send']>[0], type: Parameters<Transport['send']>[1], content: T) => {
      const t = transport.current;
      if (!t) throw new Error('not connected');
      const m = await t.send(target, type, content);
      ingest(m);
      return m;
    },
    [ingest],
  );

  const setCaseState = useCallback(
    async (caseId: string, subjectId: string, st: CaseState, extra: Partial<CaseEventContent> = {}) => {
      await send<CaseEventContent>({ kind: 'group' }, MSG.CASE, { caseId, subjectId, state: st, actor: me, ...extra });
    },
    [send, me],
  );

  const say = useCallback(
    async ({ phraseId, text }: { phraseId?: string; text?: string }) => {
      const urgency: Urgency = PHRASE_BY_ID.get(phraseId ?? '')?.urgency ?? 'low';
      const hasOpenCase = [...stateRef.current.cases.values()].some((c) => c.subject.userId === me.userId && c.state !== 'resolved');
      const caseId = urgency !== 'low' && !hasOpenCase ? newId('c') : undefined;
      await send<SayContent>({ kind: 'group' }, MSG.SAY, { phraseId, text, srcLang: me.lang, urgency, from: me, caseId });
    },
    [send, me],
  );

  const reply = useCallback(
    async (member: Profile, { phraseId, text }: { phraseId?: string; text?: string }, caseId?: string) => {
      await send<SayContent>({ kind: 'direct', userId: member.userId }, MSG.SAY, { phraseId, text, srcLang: me.lang, urgency: 'low', from: me, to: member.userId });
      const c = caseId ? stateRef.current.cases.get(caseId) : undefined;
      if (c && c.state === 'claimed' && c.owner?.userId === me.userId) await setCaseState(c.caseId, member.userId, 'in_progress');
    },
    [send, me, setCaseState],
  );

  const askCheckIn = useCallback(
    async (member: Profile) => {
      await send<CheckInContent>({ kind: 'group' }, MSG.CHECKIN, { checkInId: newId('k'), subjectId: member.userId, kind: 'ask', from: me });
    },
    [send, me],
  );

  const answerCheckIn = useCallback(
    async (checkInId: string, response: 'ok' | 'not_ok') => {
      await send<CheckInContent>({ kind: 'group' }, MSG.CHECKIN, { checkInId, subjectId: me.userId, kind: 'reply', response, from: me });
      if (response === 'not_ok') await setCaseState(newId('c'), me.userId, 'new', { reasonPhraseId: 's_notok', urgency: 'high' });
    },
    [send, me, setCaseState],
  );

  // Coordination timers run on carer consoles: SLA escalation and missed check-ins.
  useEffect(() => {
    if (me.role !== 'volunteer' && me.role !== 'staff') return;
    const tick = () => {
      const s = stateRef.current;
      const now = Date.now();
      for (const c of overdueCases(s, now)) void setCaseState(c.caseId, c.subject.userId, 'escalated').catch(() => {});
      for (const k of missedCheckIns(s, now)) {
        const caseId = `m${k.checkInId}`;
        if (!s.cases.has(caseId)) void setCaseState(caseId, k.subjectId, 'new', { reasonPhraseId: 's_missed', urgency: 'medium' }).catch(() => {});
      }
    };
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [me.role, setCaseState]);

  const notifyTyping = useCallback((userId: string) => transport.current?.sendTyping(userId), []);

  return useMemo(
    () => ({ state, connection, error, mode: session.mode, typingFrom, say, reply, setCaseState, askCheckIn, answerCheckIn, notifyTyping }),
    [state, connection, error, session.mode, typingFrom, say, reply, setCaseState, askCheckIn, answerCheckIn, notifyTyping],
  );
}

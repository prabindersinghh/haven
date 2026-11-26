import { useEffect, useMemo, useRef, useState } from 'react';
import { ReferenceAwaazEngine, speak, type AwaazResult } from '../awaaz/engine';
import { MEMBER_PHRASES, PHRASE_BY_ID, phraseText } from '../i18n/phrases';
import { t } from '../i18n/ui';
import { MessageText, clock, sayText } from '../components/MessageText';
import type { HavenApi } from '../model/useHaven';
import { MSG, type CheckInContent, type Profile, type SayContent, type Urgency } from '../types';

type Phase = { kind: 'idle' } | { kind: 'listening' } | { kind: 'result'; result: AwaazResult } | { kind: 'sent'; phraseId?: string };
type Tab = 'urgent' | 'needs' | 'other';

const TONE: Record<Urgency, string> = { high: 'signal', medium: 'calm', low: 'leaf' };
const TAB_URGENCY: Record<Tab, Urgency> = { urgent: 'high', needs: 'medium', other: 'low' };

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Zm-2.5-8.8v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z" />
    </svg>
  );
}

export function MemberView({ me, api }: { me: Profile; api: HavenApi }) {
  const lang = me.lang;
  const engine = useMemo(() => new ReferenceAwaazEngine(`haven.habits.${me.userId}`), [me.userId]);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [tab, setTab] = useState<Tab>('urgent');
  const abort = useRef<AbortController | null>(null);
  const spokenIds = useRef(new Set<string>());

  const myCase = useMemo(
    () => [...api.state.cases.values()].filter((c) => c.subject.userId === me.userId).sort((a, b) => b.openedAt - a.openedAt)[0],
    [api.state.cases, me.userId],
  );
  const pendingCheckIn = useMemo(
    () => [...api.state.checkIns.values()].filter((k) => k.subjectId === me.userId && !k.response).sort((a, b) => b.askedAt - a.askedAt)[0],
    [api.state.checkIns, me.userId],
  );
  const thread = useMemo(
    () =>
      api.state.log.filter((m) => {
        if (m.type === MSG.SAY) return m.senderId === me.userId || m.channel.kind === 'direct';
        if (m.type === MSG.CHECKIN) return (m.content as CheckInContent).subjectId === me.userId;
        return false;
      }),
    [api.state.log, me.userId],
  );

  useEffect(() => {
    const last = thread[thread.length - 1];
    if (!last || last.senderId === me.userId || spokenIds.current.has(last.id) || Date.now() - last.sentTime > 15_000) return;
    spokenIds.current.add(last.id);
    if (last.type === MSG.SAY) speak(sayText(last.content as SayContent, lang), lang);
    if (last.type === MSG.CHECKIN && (last.content as CheckInContent).kind === 'ask') speak(phraseText('s_checkin', lang), lang);
  }, [thread, me.userId, lang]);

  async function listen() {
    if (!engine.available) return setPhase({ kind: 'result', result: { candidates: [], abstained: true, transcript: '' } });
    abort.current = new AbortController();
    setPhase({ kind: 'listening' });
    try {
      setPhase({ kind: 'result', result: await engine.listen(lang, abort.current.signal) });
    } catch {
      setPhase({ kind: 'result', result: { candidates: [], abstained: true, transcript: '' } });
    }
  }

  async function confirm(phraseId: string) {
    engine.confirm(phraseId);
    speak(phraseText(phraseId, lang), lang);
    await api.say({ phraseId });
    setPhase({ kind: 'sent', phraseId });
    window.setTimeout(() => setPhase((p) => (p.kind === 'sent' ? { kind: 'idle' } : p)), 3500);
  }

  const status = myCase && myCase.state !== 'resolved' ? myCase : null;
  const lastReply = [...thread].reverse().find((m) => m.type === MSG.SAY && m.senderId !== me.userId);
  const showReply = lastReply && Date.now() - lastReply.sentTime < 30 * 60_000;
  const cards = MEMBER_PHRASES.filter((p) => p.urgency === TAB_URGENCY[tab]);

  return (
    <div className="m" lang={lang}>
      {status && (
        <p className={`m-status ${status.owner ? 'is-helped' : 'is-waiting'}`} role="status">
          <span className="m-status-dot" aria-hidden />
          {status.owner ? (
            <span>
              <b>{status.owner.name}</b> {t('claimedBy', lang)}
            </span>
          ) : (
            <span>{t('waiting', lang)}</span>
          )}
        </p>
      )}

      {showReply && (
        <button className="m-reply" onClick={() => speak(sayText(lastReply.content as SayContent, lang), lang)}>
          <span className="m-reply-from">{(lastReply.content as SayContent).from.name}</span>
          <span className="m-reply-text">{sayText(lastReply.content as SayContent, lang)}</span>
          <span className="m-reply-play">
            <SpeakerIcon /> {t('speakAloud', lang)}
          </span>
        </button>
      )}

      <section className="m-voice" aria-live="polite">
        {phase.kind === 'result' && !phase.result.abstained ? (
          <div className="m-cands">
            <p className="m-lead">{t('heardYou', lang)}</p>
            {phase.result.candidates.map((c, i) => {
              const p = PHRASE_BY_ID.get(c.phraseId)!;
              return (
                <button key={c.phraseId} className={`tcard ${TONE[p.urgency]} ${i === 0 ? 'is-best' : ''}`} onClick={() => confirm(c.phraseId)}>
                  {p.text[lang]}
                </button>
              );
            })}
            <button className="btn btn-quiet" onClick={() => setPhase({ kind: 'idle' })}>
              {t('noneOfThese', lang)}
            </button>
          </div>
        ) : phase.kind === 'sent' ? (
          <div className="m-sent" role="status">
            <span className="m-sent-mark" aria-hidden>
              <svg viewBox="0 0 24 24" width="34" height="34"><path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" /></svg>
            </span>
            <p className="m-sent-text">{phraseText(phase.phraseId, lang)}</p>
            <p className="m-sent-note">{t('sent', lang)}</p>
          </div>
        ) : (
          <>
            <button
              className={`m-mic ${phase.kind === 'listening' ? 'is-live' : ''}`}
              onClick={phase.kind === 'listening' ? () => abort.current?.abort() : listen}
              aria-label={phase.kind === 'listening' ? t('stop', lang) : t('holdToSpeak', lang)}
            >
              <svg viewBox="0 0 24 24" width="52" height="52" aria-hidden>
                <path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" />
              </svg>
            </button>
            <p className="m-mic-label">{phase.kind === 'listening' ? t('listening', lang) : t('holdToSpeak', lang)}</p>
            {phase.kind === 'result' && <p className="m-abstain">{engine.available ? t('notSure', lang) : t('noSpeech', lang)}</p>}
          </>
        )}
      </section>

      <section className="m-board">
        <h2 className="m-h2">{t('showCard', lang)}</h2>
        <div className="m-tabs" role="tablist">
          {(['urgent', 'needs', 'other'] as Tab[]).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`m-tab tone-${TONE[TAB_URGENCY[k]]}`} onClick={() => setTab(k)}>
              {t(k, lang)}
            </button>
          ))}
        </div>
        <div className="m-grid" role="tabpanel">
          {cards.map((p) => (
            <button key={p.id} className={`tcard ${TONE[p.urgency]}`} onClick={() => confirm(p.id)}>
              {p.text[lang]}
            </button>
          ))}
        </div>
      </section>

      {thread.length > 0 && (
        <details className="m-history">
          <summary>
            {t('conversation', lang)} <span>{thread.length}</span>
          </summary>
          <ul>
            {thread.slice(-14).map((m) => {
              const mine = m.senderId === me.userId;
              if (m.type === MSG.CHECKIN) {
                const c = m.content as CheckInContent;
                return (
                  <li key={m.id} className="msg msg-note">
                    {c.kind === 'ask' ? phraseText('s_checkin', lang) : c.response === 'ok' ? t('imOkay', lang) : t('notOkay', lang)}
                    <time>{clock(m.sentTime)}</time>
                  </li>
                );
              }
              const c = m.content as SayContent;
              return (
                <li key={m.id} className={`msg ${mine ? 'msg-out' : 'msg-in'}`}>
                  {!mine && <b className="msg-from">{c.from.name}</b>}
                  <MessageText content={c} lang={lang} />
                  <span className="msg-foot">
                    <time>{clock(m.sentTime)}</time>
                    <button className="msg-play" onClick={() => speak(sayText(c, lang), lang)} aria-label={t('speakAloud', lang)}>
                      <SpeakerIcon />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          {api.typingFrom && <p className="typing" aria-label="typing"><i /><i /><i /></p>}
        </details>
      )}

      {pendingCheckIn && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label={t('howAreYou', lang)}>
          <div className="sheet-card">
            <p className="sheet-from">{pendingCheckIn.askedBy.name}</p>
            <h2>{phraseText('s_checkin', lang)}</h2>
            <button className="tcard leaf is-best" onClick={() => api.answerCheckIn(pendingCheckIn.checkInId, 'ok')}>
              {t('imOkay', lang)}
            </button>
            <button className="tcard signal" onClick={() => api.answerCheckIn(pendingCheckIn.checkInId, 'not_ok')}>
              {t('notOkay', lang)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

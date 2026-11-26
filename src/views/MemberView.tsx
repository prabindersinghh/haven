import { useEffect, useMemo, useRef, useState } from 'react';
import { ReferenceAwaazEngine, speak, type AwaazResult } from '../awaaz/engine';
import { MEMBER_PHRASES, PHRASE_BY_ID, phraseText } from '../i18n/phrases';
import { t } from '../i18n/ui';
import { MessageText, clock, sayText } from '../components/MessageText';
import type { HavenApi } from '../model/useHaven';
import { MSG, type CheckInContent, type Profile, type SayContent } from '../types';

type Phase = { kind: 'idle' } | { kind: 'listening' } | { kind: 'result'; result: AwaazResult } | { kind: 'sent'; phraseId?: string };

export function MemberView({ me, api }: { me: Profile; api: HavenApi }) {
  const lang = me.lang;
  const engine = useMemo(() => new ReferenceAwaazEngine(`haven.habits.${me.userId}`), [me.userId]);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const abort = useRef<AbortController | null>(null);
  const spokenIds = useRef(new Set<string>());

  const myCase = useMemo(
    () =>
      [...api.state.cases.values()]
        .filter((c) => c.subject.userId === me.userId)
        .sort((a, b) => b.openedAt - a.openedAt)[0],
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

  // SPEAK: read new replies aloud in the member's language.
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
      const result = await engine.listen(lang, abort.current.signal);
      setPhase({ kind: 'result', result });
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

  const groups = [
    { key: 'urgent' as const, items: MEMBER_PHRASES.filter((p) => p.urgency === 'high') },
    { key: 'needs' as const, items: MEMBER_PHRASES.filter((p) => p.urgency === 'medium') },
    { key: 'other' as const, items: MEMBER_PHRASES.filter((p) => p.urgency === 'low') },
  ];

  const status = myCase && myCase.state !== 'resolved' ? myCase : null;
  const lastReply = [...thread].reverse().find((m) => m.type === MSG.SAY && m.senderId !== me.userId);

  return (
    <div className="member" lang={lang}>
      {status && (
        <div className={`status-pill ${status.owner ? 'ok' : 'wait'}`} role="status">
          {status.owner ? (
            <>
              <strong>{status.owner.name}</strong> {t('claimedBy', lang)}
            </>
          ) : (
            t('waiting', lang)
          )}
        </div>
      )}

      {lastReply && Date.now() - lastReply.sentTime < 30 * 60_000 && (
        <button className="latest-reply" onClick={() => speak(sayText(lastReply.content as SayContent, lang), lang)}>
          <b>{(lastReply.content as SayContent).from.name}</b>
          <span>{sayText(lastReply.content as SayContent, lang)}</span>
          <small>▶ {t('speakAloud', lang)}</small>
        </button>
      )}

      <section className="speak-zone">
        {phase.kind === 'result' && !phase.result.abstained ? (
          <div className="candidates">
            <p className="prompt">{t('heardYou', lang)}</p>
            {phase.result.candidates.map((c, i) => {
              const p = PHRASE_BY_ID.get(c.phraseId)!;
              return (
                <button key={c.phraseId} className={`cand ${p.urgency} ${i === 0 ? 'first' : ''}`} onClick={() => confirm(c.phraseId)}>
                  {p.text[lang]}
                </button>
              );
            })}
            <button className="ghost" onClick={() => setPhase({ kind: 'idle' })}>
              {t('noneOfThese', lang)}
            </button>
          </div>
        ) : phase.kind === 'sent' ? (
          <div className="sent" role="status">
            <span className="tick" aria-hidden>✓</span>
            <p className="big-line">{phraseText(phase.phraseId, lang)}</p>
            <p>{t('sent', lang)}</p>
          </div>
        ) : (
          <>
            <button className={`mic ${phase.kind === 'listening' ? 'live' : ''}`} onClick={phase.kind === 'listening' ? () => abort.current?.abort() : listen} aria-label={t('holdToSpeak', lang)}>
              <svg viewBox="0 0 24 24" width="56" height="56" aria-hidden>
                <path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" />
              </svg>
            </button>
            <p className="mic-label">{phase.kind === 'listening' ? t('listening', lang) : t('holdToSpeak', lang)}</p>
            {phase.kind === 'result' && <p className="abstain">{engine.available ? t('notSure', lang) : t('noSpeech', lang)}</p>}
          </>
        )}
      </section>

      <section className="phrase-board" aria-label={t('orChoose', lang)}>
        <h2>{t('orChoose', lang)}</h2>
        {groups.map((g) => (
          <div key={g.key} className="phrase-group">
            <h3>{t(g.key, lang)}</h3>
            <div className="phrase-grid">
              {g.items.map((p) => (
                <button key={p.id} className={`phrase ${p.urgency}`} onClick={() => confirm(p.id)}>
                  {p.text[lang]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="member-thread">
        <h2>{t('conversation', lang)}</h2>
        {thread.length === 0 && <p className="muted">—</p>}
        <ul>
          {thread.slice(-12).map((m) => {
            const mine = m.senderId === me.userId;
            if (m.type === MSG.CHECKIN) {
              const c = m.content as CheckInContent;
              return (
                <li key={m.id} className={`bubble sys ${mine ? 'mine' : ''}`}>
                  {c.kind === 'ask' ? phraseText('s_checkin', lang) : c.response === 'ok' ? t('imOkay', lang) : t('notOkay', lang)}
                  <time>{clock(m.sentTime)}</time>
                </li>
              );
            }
            const c = m.content as SayContent;
            return (
              <li key={m.id} className={`bubble ${mine ? 'mine' : 'theirs'}`}>
                {!mine && <b className="who">{c.from.name}</b>}
                <MessageText content={c} lang={lang} />
                <span className="row">
                  <time>{mine ? t('you', lang) : ''} {clock(m.sentTime)}</time>
                  <button className="link" onClick={() => speak(sayText(c, lang), lang)} aria-label={t('speakAloud', lang)}>
                    ▶ {t('speakAloud', lang)}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
        {api.typingFrom && <p className="typing">● ● ●</p>}
      </section>

      {pendingCheckIn && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label={t('howAreYou', lang)}>
          <div className="sheet-card">
            <p className="sheet-from">{pendingCheckIn.askedBy.name}</p>
            <h2>{phraseText('s_checkin', lang)}</h2>
            <button className="cand low first" onClick={() => api.answerCheckIn(pendingCheckIn.checkInId, 'ok')}>
              {t('imOkay', lang)}
            </button>
            <button className="cand high" onClick={() => api.answerCheckIn(pendingCheckIn.checkInId, 'not_ok')}>
              {t('notOkay', lang)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

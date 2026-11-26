import { useEffect, useMemo, useState } from 'react';
import { CARER_PHRASES, LANG_LABEL, phraseText } from '../i18n/phrases';
import { MessageText, clock, stopwatch, timeAgo } from '../components/MessageText';
import type { HavenApi } from '../model/useHaven';
import { DEFAULT_SLA_MIN, conversation, sortedCases, type CaseRecord } from '../model/state';
import { MSG, type CaseState, type CheckInContent, type Profile, type SayContent, type Urgency } from '../types';

const STATE_LABEL: Record<CaseState, string> = {
  new: 'Waiting',
  claimed: 'Claimed',
  in_progress: 'In progress',
  escalated: 'Escalated',
  resolved: 'Resolved',
};
const URGENCY_LABEL: Record<Urgency, string> = { high: 'Urgent', medium: 'Need', low: 'Everyday' };
const STEPS: CaseState[] = ['new', 'claimed', 'in_progress', 'resolved'];

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

const reasonOf = (c: CaseRecord, lang: Profile['lang']) => (c.reasonPhraseId ? phraseText(c.reasonPhraseId, lang) : c.reasonText ?? '');
const isLate = (c: CaseRecord, now: number) => c.state === 'new' && now - c.openedAt > DEFAULT_SLA_MIN[c.urgency] * 60_000;

function Stepper({ c }: { c: CaseRecord }) {
  const reached = new Set(c.history.map((h) => h.state));
  const at = (s: CaseState) => c.history.find((h) => h.state === s);
  return (
    <ol className="stepper" aria-label="Case progress">
      {STEPS.map((s) => {
        const h = at(s);
        return (
          <li key={s} className={`${reached.has(s) ? 'done' : ''} ${c.state === s ? 'current' : ''}`}>
            <span className="stepper-dot" aria-hidden />
            <span className="stepper-label">{s === 'new' ? 'Opened' : STATE_LABEL[s]}</span>
            {h && (
              <span className="stepper-meta">
                {h.actor.name}, {clock(h.at)}
              </span>
            )}
          </li>
        );
      })}
      {c.escalatedAt && (
        <li className="stepper-flag">
          Escalated at {clock(c.escalatedAt)}
        </li>
      )}
    </ol>
  );
}

export function ConsoleView({ me, api }: { me: Profile; api: HavenApi }) {
  const now = useNow();
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const canAct = me.role === 'volunteer' || me.role === 'staff';

  const cases = useMemo(() => sortedCases(api.state), [api.state]);
  const open = cases.filter((c) => c.state !== 'resolved');
  const resolved = cases.filter((c) => c.state === 'resolved');
  const members = useMemo(() => [...api.state.people.values()].filter((p) => p.role === 'member'), [api.state.people]);

  const member = selected ? api.state.people.get(selected) ?? null : null;
  const picked = selectedCase ? api.state.cases.get(selectedCase) ?? null : null;
  const active = picked && picked.state !== 'resolved' && picked.subject.userId === selected ? picked : selected ? open.find((c) => c.subject.userId === selected) ?? null : null;
  const lastResolved = selected && !active ? (picked?.state === 'resolved' && picked.subject.userId === selected ? picked : resolved.find((c) => c.subject.userId === selected) ?? null) : null;
  const shownCase = active ?? lastResolved;
  const thread = selected ? conversation(api.state, me.userId, selected) : [];

  useEffect(() => {
    if (!selected && open[0]) {
      setSelected(open[0].subject.userId);
      setSelectedCase(open[0].caseId);
    }
  }, [open, selected]);

  const claimTimes = cases.filter((c) => c.claimedAt).map((c) => (c.claimedAt! - c.openedAt) / 1000).sort((a, b) => a - b);
  const medianClaim = claimTimes.length ? claimTimes[Math.floor(claimTimes.length / 2)] : null;
  const late = open.filter((c) => isLate(c, now)).length;
  const list = tab === 'open' ? open : resolved;

  async function send(input: { phraseId?: string; text?: string }) {
    if (!member) return;
    await api.reply(member, input, active?.caseId);
    setDraft('');
  }

  return (
    <div className="cs">
      <aside className="cs-queue">
        <div className="cs-queue-head">
          <h2>Requests</h2>
          <div className="seg seg-sm">
            <button aria-pressed={tab === 'open'} onClick={() => setTab('open')}>
              Open <span>{open.length}</span>
            </button>
            <button aria-pressed={tab === 'resolved'} onClick={() => setTab('resolved')}>
              Done <span>{resolved.length}</span>
            </button>
          </div>
        </div>
        <dl className="cs-stats">
          <div>
            <dt>Open</dt>
            <dd>{open.length}</dd>
          </div>
          <div className={late ? 'is-alert' : ''}>
            <dt>Past time limit</dt>
            <dd>{late}</dd>
          </div>
          <div>
            <dt>Typical pick-up</dt>
            <dd>{medianClaim === null ? '–' : medianClaim < 60 ? `${Math.round(medianClaim)}s` : `${Math.round(medianClaim / 60)}m`}</dd>
          </div>
        </dl>
        <ul className="cs-list">
          {list.map((c) => (
            <li key={c.caseId}>
              <button className={`cs-row u-${c.urgency} ${shownCase?.caseId === c.caseId ? 'is-sel' : ''} ${isLate(c, now) ? 'is-late' : ''}`} onClick={() => { setSelected(c.subject.userId); setSelectedCase(c.caseId); }}>
                <span className="cs-row-main">
                  <span className="cs-row-name">{c.subject.name}</span>
                  <span className="cs-row-reason">{reasonOf(c, me.lang)}</span>
                  <span className="cs-row-meta">
                    <span className={`pill pill-${c.state}`}>{STATE_LABEL[c.state]}</span>
                    {c.owner && <span>{c.owner.userId === me.userId ? 'You' : c.owner.name}</span>}
                  </span>
                </span>
                <span className="cs-row-time" title={c.state === 'new' ? 'Waiting for someone to claim' : 'Opened'}>
                  {c.state === 'new' || c.state === 'escalated' ? stopwatch(c.openedAt, now) : timeAgo(c.openedAt, now)}
                </span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="cs-empty">{tab === 'open' ? 'Nothing waiting. New requests from members appear here.' : 'Resolved requests appear here.'}</li>}
        </ul>
      </aside>

      <section className="cs-main">
        {member ? (
          <>
            <header className="cs-head">
              <div className="cs-who">
                <span className="avatar avatar-lg">{member.name.slice(0, 1).toUpperCase()}</span>
                <div>
                  <h1>{member.name}</h1>
                  <p>
                    Reads {LANG_LABEL[member.lang]}. You see their messages in {LANG_LABEL[me.lang]}.
                  </p>
                </div>
              </div>
              {active && canAct && (
                <div className="cs-actions">
                  {active.state !== 'escalated' && me.role !== 'staff' && (
                    <button className="btn btn-quiet" onClick={() => api.setCaseState(active.caseId, active.subject.userId, 'escalated')}>
                      Escalate to staff
                    </button>
                  )}
                  {(active.state === 'new' || active.state === 'escalated') && (
                    <button className="btn btn-primary" onClick={() => api.setCaseState(active.caseId, active.subject.userId, 'claimed')}>
                      Claim request
                    </button>
                  )}
                  {active.owner && active.state !== 'escalated' && (
                    <button className="btn btn-done" onClick={() => api.setCaseState(active.caseId, active.subject.userId, 'resolved')}>
                      Mark resolved
                    </button>
                  )}
                </div>
              )}
            </header>

            {shownCase && (
              <div className={`cs-case u-${shownCase.urgency}`}>
                <div className="cs-case-ask">
                  <span className={`pill pill-u-${shownCase.urgency}`}>{URGENCY_LABEL[shownCase.urgency]}</span>
                  <span className="cs-case-text">{reasonOf(shownCase, me.lang)}</span>
                </div>
                <Stepper c={shownCase} />
              </div>
            )}

            <ul className="cs-thread">
              {thread.map((m) => {
                const mine = m.senderId === me.userId;
                if (m.type === MSG.CHECKIN) {
                  const c = m.content as CheckInContent;
                  return (
                    <li key={m.id} className="msg msg-note">
                      {c.kind === 'ask' ? `${c.from.name} sent a check-in` : c.response === 'ok' ? 'Answered the check-in: I’m okay' : 'Answered the check-in: Not okay'}
                      <time>{clock(m.sentTime)}</time>
                    </li>
                  );
                }
                const c = m.content as SayContent;
                return (
                  <li key={m.id} className={`msg ${mine ? 'msg-out' : 'msg-in'} ${!mine && c.urgency === 'high' ? 'msg-urgent' : ''}`}>
                    {!mine && <b className="msg-from">{c.from.name}</b>}
                    <MessageText content={c} lang={me.lang} />
                    <span className="msg-foot">
                      <time>{clock(m.sentTime)}</time>
                    </span>
                  </li>
                );
              })}
              {thread.length === 0 && <li className="cs-empty">No messages with {member.name} yet.</li>}
            </ul>
            {api.typingFrom === member.userId && <p className="typing"><i /><i /><i /></p>}

            <div className="cs-compose">
              <p className="cs-compose-hint">Quick replies arrive in {LANG_LABEL[member.lang]} and are read aloud to {member.name.split(' ')[0]}.</p>
              <div className="cs-quick">
                {CARER_PHRASES.map((p) => (
                  <button key={p.id} className="qr" onClick={() => send({ phraseId: p.id })}>
                    <span>{p.text[me.lang]}</span>
                    {member.lang !== me.lang && <small>{p.text[member.lang]}</small>}
                  </button>
                ))}
              </div>
              <form
                className="cs-input"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draft.trim()) void send({ text: draft.trim() });
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    api.notifyTyping(member.userId);
                  }}
                  placeholder="Or type a message (sent exactly as written)"
                  aria-label={`Message ${member.name}`}
                />
                <button className="btn btn-primary" disabled={!draft.trim()}>
                  Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="cs-blank">
            <h1>No request selected</h1>
            <p>When a member sends an urgent card or answers a check-in with “not okay”, it appears in Requests. Claim it to let them know you’re on it.</p>
          </div>
        )}
      </section>

      <aside className="cs-people">
        <div className="cs-people-head">
          <h2>Members</h2>
          {canAct && members.length > 0 && (
            <button className="btn btn-quiet btn-sm" onClick={() => members.forEach((p) => void api.askCheckIn(p))}>
              Check in with all
            </button>
          )}
        </div>
        <ul className="cs-roster">
          {members.map((p) => {
            const last = [...api.state.checkIns.values()].filter((k) => k.subjectId === p.userId).sort((a, b) => b.askedAt - a.askedAt)[0];
            const state = !last ? 'none' : last.response === 'ok' ? 'ok' : last.response === 'not_ok' ? 'bad' : 'pending';
            const note = !last ? 'No check-in yet' : state === 'ok' ? 'Okay' : state === 'bad' ? 'Not okay' : `Asked ${timeAgo(last.askedAt, now)} ago`;
            return (
              <li key={p.userId} className={selected === p.userId ? 'is-sel' : ''}>
                <button className="cs-person" onClick={() => { setSelected(p.userId); setSelectedCase(null); }}>
                  <span className="avatar">{p.name.slice(0, 1).toUpperCase()}</span>
                  <span className="cs-person-text">
                    <strong>{p.name}</strong>
                    <small>
                      <span className={`ci ci-${state}`} aria-hidden />
                      {note}
                    </small>
                  </span>
                  <span className="lang-tag">{LANG_LABEL[p.lang]}</span>
                </button>
                {canAct && (
                  <button className="cs-checkin" onClick={() => api.askCheckIn(p)} aria-label={`Send check-in to ${p.name}`}>
                    Check in
                  </button>
                )}
              </li>
            );
          })}
          {members.length === 0 && <li className="cs-empty">Members appear here when they join Haven.</li>}
        </ul>
        <div className="cs-rules">
          <h3>Time limits</h3>
          <p>Urgent requests go to staff if nobody claims them in {DEFAULT_SLA_MIN.high} minutes, other needs in {DEFAULT_SLA_MIN.medium}. A check-in with no answer after 10 minutes becomes a request.</p>
        </div>
      </aside>
    </div>
  );
}

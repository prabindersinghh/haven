import { useEffect, useMemo, useState } from 'react';
import { CARER_PHRASES, LANG_LABEL, phraseText } from '../i18n/phrases';
import { MessageText, clock, timeAgo } from '../components/MessageText';
import type { HavenApi } from '../model/useHaven';
import { DEFAULT_SLA_MIN, conversation, sortedCases, type CaseRecord } from '../model/state';
import { MSG, type CaseState, type CheckInContent, type Profile, type SayContent } from '../types';

const STATE_LABEL: Record<CaseState, string> = {
  new: 'New',
  claimed: 'Claimed',
  in_progress: 'In progress',
  escalated: 'Escalated',
  resolved: 'Resolved',
};

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

function reasonOf(c: CaseRecord, lang: Profile['lang']) {
  return c.reasonPhraseId ? phraseText(c.reasonPhraseId, lang) : c.reasonText ?? '';
}

export function ConsoleView({ me, api }: { me: Profile; api: HavenApi }) {
  const now = useNow();
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [selected, setSelected] = useState<string | null>(null); // member userId
  const [draft, setDraft] = useState('');
  const canClaim = me.role === 'volunteer' || me.role === 'staff';

  const cases = useMemo(() => sortedCases(api.state), [api.state]);
  const open = cases.filter((c) => c.state !== 'resolved');
  const resolved = cases.filter((c) => c.state === 'resolved');
  const members = useMemo(() => [...api.state.people.values()].filter((p) => p.role === 'member'), [api.state.people]);

  const selectedMember = selected ? api.state.people.get(selected) ?? null : null;
  const activeCase = selected ? open.find((c) => c.subject.userId === selected) ?? null : null;
  const thread = selected ? conversation(api.state, me.userId, selected) : [];

  // Auto-select the most urgent open case the first time one appears.
  useEffect(() => {
    if (!selected && open[0]) setSelected(open[0].subject.userId);
  }, [open, selected]);

  const claimTimes = cases.filter((c) => c.claimedAt).map((c) => (c.claimedAt! - c.openedAt) / 1000);
  const medianClaim = claimTimes.length ? claimTimes.sort((a, b) => a - b)[Math.floor(claimTimes.length / 2)] : null;
  const overdue = open.filter((c) => c.state === 'new' && now - c.openedAt > DEFAULT_SLA_MIN[c.urgency] * 60_000).length;

  async function send(input: { phraseId?: string; text?: string }) {
    if (!selectedMember) return;
    await api.reply(selectedMember, input, activeCase?.caseId);
    setDraft('');
  }

  return (
    <div className="console">
      <aside className="pane cases-pane">
        <div className="kpis">
          <div><b>{open.length}</b><span>open</span></div>
          <div className={overdue ? 'warn' : ''}><b>{overdue}</b><span>over SLA</span></div>
          <div><b>{medianClaim === null ? '—' : `${Math.round(medianClaim)}s`}</b><span>median claim</span></div>
        </div>
        <div className="seg small">
          <button className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>Open · {open.length}</button>
          <button className={tab === 'resolved' ? 'on' : ''} onClick={() => setTab('resolved')}>Resolved · {resolved.length}</button>
        </div>
        <ul className="case-list">
          {(tab === 'open' ? open : resolved).map((c) => {
            const late = c.state === 'new' && now - c.openedAt > DEFAULT_SLA_MIN[c.urgency] * 60_000;
            return (
              <li key={c.caseId}>
                <button className={`case-card ${c.urgency} ${selected === c.subject.userId ? 'sel' : ''}`} onClick={() => setSelected(c.subject.userId)}>
                  <span className="case-top">
                    <strong>{c.subject.name}</strong>
                    <span className={`chip ${c.state}`}>{STATE_LABEL[c.state]}</span>
                  </span>
                  <span className="case-reason">“{reasonOf(c, me.lang)}”</span>
                  <span className="case-meta">
                    <span className={`chip u-${c.urgency}`}>{c.urgency}</span>
                    {LANG_LABEL[c.subject.lang]} → {LANG_LABEL[me.lang]}
                    <span className={late ? 'late' : ''}>{timeAgo(c.openedAt, now)}</span>
                  </span>
                  {c.owner && <span className="case-owner">Owner: {c.owner.userId === me.userId ? 'you' : c.owner.name}</span>}
                </button>
              </li>
            );
          })}
          {(tab === 'open' ? open : resolved).length === 0 && <li className="empty">No {tab} cases.</li>}
        </ul>
      </aside>

      <section className="pane thread-pane">
        {selectedMember ? (
          <>
            <header className="thread-head">
              <div>
                <h2>{selectedMember.name}</h2>
                <p className="muted">
                  Reads {LANG_LABEL[selectedMember.lang]} · messages are shown to you in {LANG_LABEL[me.lang]}
                </p>
              </div>
              {activeCase && (
                <div className="actions">
                  <span className={`chip ${activeCase.state}`}>{STATE_LABEL[activeCase.state]}</span>
                  {canClaim && (activeCase.state === 'new' || activeCase.state === 'escalated') && (
                    <button className="primary" onClick={() => api.setCaseState(activeCase.caseId, activeCase.subject.userId, 'claimed')}>
                      Claim
                    </button>
                  )}
                  {canClaim && activeCase.state !== 'escalated' && me.role !== 'staff' && (
                    <button className="ghost" onClick={() => api.setCaseState(activeCase.caseId, activeCase.subject.userId, 'escalated')}>
                      Escalate
                    </button>
                  )}
                  {canClaim && activeCase.owner && (
                    <button className="ok" onClick={() => api.setCaseState(activeCase.caseId, activeCase.subject.userId, 'resolved')}>
                      Resolve
                    </button>
                  )}
                </div>
              )}
            </header>

            {activeCase && (
              <ol className="timeline" aria-label="Case timeline">
                {activeCase.history.map((h, i) => (
                  <li key={i} className={h.state}>
                    <b>{STATE_LABEL[h.state]}</b> · {h.actor.name} · {clock(h.at)}
                  </li>
                ))}
              </ol>
            )}

            <ul className="thread">
              {thread.map((m) => {
                const mine = m.senderId === me.userId;
                if (m.type === MSG.CHECKIN) {
                  const c = m.content as CheckInContent;
                  return (
                    <li key={m.id} className="bubble sys">
                      {c.kind === 'ask' ? `Check-in sent by ${c.from.name}` : c.response === 'ok' ? 'Check-in: “I’m okay”' : 'Check-in: “Not okay”'}
                      <time>{clock(m.sentTime)}</time>
                    </li>
                  );
                }
                const c = m.content as SayContent;
                return (
                  <li key={m.id} className={`bubble ${mine ? 'mine' : 'theirs'} ${c.urgency === 'high' && !mine ? 'urgent' : ''}`}>
                    {!mine && <b className="who">{c.from.name}</b>}
                    <MessageText content={c} lang={me.lang} />
                    <time>{clock(m.sentTime)}</time>
                  </li>
                );
              })}
              {thread.length === 0 && <li className="empty">No messages yet.</li>}
            </ul>
            {api.typingFrom === selectedMember.userId && <p className="typing">{selectedMember.name} is responding…</p>}

            <div className="composer">
              <div className="quick">
                {CARER_PHRASES.map((p) => (
                  <button key={p.id} className="chip-btn" onClick={() => send({ phraseId: p.id })} title={`${p.text[selectedMember.lang]} (${LANG_LABEL[selectedMember.lang]})`}>
                    {p.text[me.lang]}
                  </button>
                ))}
              </div>
              <form
                className="compose-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draft.trim()) void send({ text: draft.trim() });
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    api.notifyTyping(selectedMember.userId);
                  }}
                  placeholder={`Free text is delivered as written. Quick replies above arrive in ${LANG_LABEL[selectedMember.lang]}.`}
                />
                <button className="primary" disabled={!draft.trim()}>Send</button>
              </form>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h2>Dispatch room</h2>
            <p className="muted">Urgent messages from members appear on the left as cases. Claim one to take ownership; unclaimed cases escalate after the SLA.</p>
          </div>
        )}
      </section>

      <aside className="pane people-pane">
        <h3>Members</h3>
        <ul className="people">
          {members.map((p) => {
            const last = [...api.state.checkIns.values()].filter((k) => k.subjectId === p.userId).sort((a, b) => b.askedAt - a.askedAt)[0];
            return (
              <li key={p.userId}>
                <button className={`person ${selected === p.userId ? 'sel' : ''}`} onClick={() => setSelected(p.userId)}>
                  <span className="avatar">{p.name.slice(0, 1).toUpperCase()}</span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {LANG_LABEL[p.lang]}
                      {last && ` · check-in ${last.response === 'ok' ? '✓ okay' : last.response === 'not_ok' ? '⚠ not okay' : `pending ${timeAgo(last.askedAt, now)}`}`}
                    </small>
                  </span>
                </button>
                {canClaim && (
                  <button className="link" onClick={() => api.askCheckIn(p)}>
                    Check in
                  </button>
                )}
              </li>
            );
          })}
          {members.length === 0 && <li className="empty">Members appear here when they join.</li>}
        </ul>
        {canClaim && members.length > 0 && (
          <button className="ghost full" onClick={() => members.forEach((p) => void api.askCheckIn(p))}>
            Check in with everyone
          </button>
        )}
        <div className="sla">
          <h3>Escalation SLA</h3>
          <p className="muted">Unclaimed after: high {DEFAULT_SLA_MIN.high} min · medium {DEFAULT_SLA_MIN.medium} min · low {DEFAULT_SLA_MIN.low} min. Missed check-ins open a case after 10 min.</p>
        </div>
      </aside>
    </div>
  );
}

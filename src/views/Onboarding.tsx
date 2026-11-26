import { useState } from 'react';
import { LANG_LABEL, PHRASE_BY_ID } from '../i18n/phrases';
import type { Lang, Role } from '../types';
import { Logo } from '../components/Logo';

const ROLES: { role: Role; title: string; body: string }[] = [
  { role: 'member', title: 'I need support', body: 'Big cards, voice input and a direct line to your care team.' },
  { role: 'volunteer', title: 'Volunteer', body: 'Pick up requests and reply in your own language.' },
  { role: 'staff', title: 'Care staff', body: 'See every request, handle escalations, run check-ins.' },
  { role: 'family', title: 'Family', body: 'Follow your relative and reply to them.' },
];

const DEMO_CARD = PHRASE_BY_ID.get('water')!;

export function Onboarding({ onDone, busy, error }: { onDone: (v: { name: string; role: Role; lang: Lang }) => void; busy: boolean; error: string | null }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [lang, setLang] = useState<Lang>('hi');

  return (
    <main className="ob">
      <section className="ob-story">
        <div className="ob-brand">
          <Logo size={44} />
          <span>Haven</span>
        </div>
        <h1>Say it your way. Someone will answer.</h1>
        <p>
          Haven is chat for people whose speech is hard to understand. Speak or show a card, confirm it with one tap, and a volunteer replies in your language.
        </p>
        <div className="ob-fan" aria-hidden>
          <div className="tcard calm ob-c1">{DEMO_CARD.text.pa}<small>ਪੰਜਾਬੀ</small></div>
          <div className="tcard calm ob-c2">{DEMO_CARD.text.en}<small>English</small></div>
          <div className="tcard calm ob-c3">{DEMO_CARD.text.hi}<small>हिन्दी</small></div>
        </div>
        <p className="ob-caption">One card. Everyone reads it in their own language.</p>
      </section>

      <form
        className="ob-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onDone({ name: name.trim(), role, lang });
        }}
      >
        <h2>Get started</h2>
        <label className="fld">
          <span>Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Gurdev Singh" maxLength={40} autoFocus required />
        </label>

        <fieldset className="fld">
          <legend>I am joining as</legend>
          <div className="ob-roles">
            {ROLES.map((r) => (
              <button type="button" key={r.role} className="ob-role" aria-pressed={role === r.role} onClick={() => setRole(r.role)}>
                <span className="ob-radio" aria-hidden />
                <span>
                  <strong>{r.title}</strong>
                  <small>{r.body}</small>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="fld">
          <legend>I read</legend>
          <div className="seg">
            {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
              <button type="button" key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
                {LANG_LABEL[l]}
              </button>
            ))}
          </div>
        </fieldset>

        {error && <p className="err">{error}</p>}
        <button className="btn btn-primary btn-lg" disabled={busy || !name.trim()}>
          {busy ? 'Connecting' : 'Continue'}
        </button>
        <p className="ob-fine">Haven helps people reach their carers. It does not diagnose and is not an emergency service.</p>
      </form>
    </main>
  );
}

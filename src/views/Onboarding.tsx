import { useState } from 'react';
import { LANG_LABEL } from '../i18n/phrases';
import type { Lang, Role } from '../types';
import { Logo } from '../components/Logo';

const ROLES: { role: Role; title: string; body: string }[] = [
  { role: 'member', title: 'I need support', body: 'Large buttons, voice input with Awaaz, and a direct line to your care team.' },
  { role: 'volunteer', title: 'Volunteer', body: 'Claim cases in the Dispatch room and reply in your own language.' },
  { role: 'staff', title: 'Care staff', body: 'Oversee every case, receive escalations and run check-ins.' },
  { role: 'family', title: 'Family', body: 'Follow your relative and reply to them in your language.' },
];

export function Onboarding({ onDone, busy, error }: { onDone: (v: { name: string; role: Role; lang: Lang }) => void; busy: boolean; error: string | null }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [lang, setLang] = useState<Lang>('hi');

  return (
    <main className="onboard">
      <section className="onboard-hero">
        <div className="brand">
          <Logo size={64} />
          <div>
            <h1>Haven</h1>
            <p className="powered">powered by Awaaz · built on Nexconn</p>
          </div>
        </div>
        <p className="lede">Chat for people who can't be understood. Speak in your own way, confirm with one tap, and someone answers in your language.</p>
      </section>

      <form
        className="card onboard-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onDone({ name: name.trim(), role, lang });
        }}
      >
        <label className="field">
          <span>Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gurdev Singh" maxLength={40} autoFocus required />
        </label>

        <fieldset className="field">
          <legend>Who are you?</legend>
          <div className="role-grid">
            {ROLES.map((r) => (
              <button type="button" key={r.role} className={`role ${role === r.role ? 'on' : ''}`} onClick={() => setRole(r.role)} aria-pressed={role === r.role}>
                <strong>{r.title}</strong>
                <small>{r.body}</small>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Language you read</legend>
          <div className="seg">
            {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
              <button type="button" key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)} aria-pressed={lang === l}>
                {LANG_LABEL[l]}
              </button>
            ))}
          </div>
        </fieldset>

        {error && <p className="error">{error}</p>}
        <button className="primary big" disabled={busy || !name.trim()}>
          {busy ? 'Connecting…' : 'Continue'}
        </button>
        <p className="fine">Haven supports care. It does not diagnose and is not an emergency service.</p>
      </form>
    </main>
  );
}

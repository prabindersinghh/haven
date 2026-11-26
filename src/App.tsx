import { useEffect, useState } from 'react';
import { Onboarding } from './views/Onboarding';
import { MemberView } from './views/MemberView';
import { ConsoleView } from './views/ConsoleView';
import { useHaven } from './model/useHaven';
import { Logo } from './components/Logo';
import type { Lang, Profile, Role, Session } from './types';

const PROFILE_KEY = 'haven.profile.v1';

interface Stored {
  profile: Profile;
  session: Session;
}

async function startSession(v: { name: string; role: Role; lang: Lang }): Promise<Stored> {
  const res = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Server error ${res.status}`);
  const session = json as Session;
  return { session, profile: { userId: session.userId, name: v.name, role: v.role, lang: v.lang } };
}

export default function App() {
  const [stored, setStored] = useState<Stored | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore the profile and fetch a fresh token for it (tokens are never persisted).
  useEffect(() => {
    const raw = sessionStorage.getItem(PROFILE_KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as Profile;
    setBusy(true);
    startSession(p)
      .then(setStored)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, []);

  async function onDone(v: { name: string; role: Role; lang: Lang }) {
    setBusy(true);
    setError(null);
    try {
      const s = await startSession(v);
      sessionStorage.setItem(PROFILE_KEY, JSON.stringify(s.profile));
      setStored(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!stored) return <Onboarding onDone={onDone} busy={busy} error={error} />;
  return (
    <Shell
      stored={stored}
      onSignOut={() => {
        sessionStorage.removeItem(PROFILE_KEY);
        setStored(null);
      }}
    />
  );
}

function Shell({ stored, onSignOut }: { stored: Stored; onSignOut: () => void }) {
  const { profile, session } = stored;
  const api = useHaven(profile, session);
  const isMember = profile.role === 'member';

  return (
    <div className={`app ${isMember ? 'app-member' : 'app-console'}`}>
      <header className="bar">
        <div className="bar-brand">
          <Logo size={30} />
          <span>Haven</span>
        </div>
        <div className="bar-right">
          <span className={`conn conn-${api.connection}`} title={session.mode === 'nexconn' ? 'Connected through Nexconn' : 'Demo: messages stay in this browser'}>
            <i aria-hidden />
            {api.connection !== 'connected' ? (api.connection === 'connecting' ? 'Connecting' : 'Offline') : session.mode === 'nexconn' ? 'Live' : 'Demo'}
          </span>
          <span className="bar-me">
            <span className="avatar avatar-sm">{profile.name.slice(0, 1).toUpperCase()}</span>
            <span className="bar-me-name">{profile.name}</span>
          </span>
          <button className="btn btn-quiet btn-sm" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>
      {session.mode === 'local' && !isMember && (
        <p className="demo-note">
          Demo mode: messages stay in this browser. Open Haven in another tab as a member to try it, or add <code>NEXCONN_APP_KEY</code> and <code>NEXCONN_APP_SECRET</code> to go live.
        </p>
      )}
      {api.error && <p className="err err-bar">Could not connect: {api.error}</p>}
      {isMember ? <MemberView me={profile} api={api} /> : <ConsoleView me={profile} api={api} />}
    </div>
  );
}

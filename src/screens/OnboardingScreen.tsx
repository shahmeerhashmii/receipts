import React, { useState } from 'react';
import { demoStore } from '../demo/store';
import { AVATAR_COLORS } from '../demo/seed';

interface OnboardingProps {
  onComplete: (userId: string) => void;
}

export function OnboardingScreen({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<'intro' | 'profile' | 'league'>('intro');
  const [name, setName] = useState('');
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [leagueAction, setLeagueAction] = useState<'create' | 'join'>('create');
  const [leagueName, setLeagueName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  function handleProfile() {
    if (!name.trim()) return;
    setStep('league');
  }

  function handleLeague() {
    const userId = 'user-' + Date.now();
    if (leagueAction === 'create') {
      if (!leagueName.trim()) return;
      demoStore.createLeague(leagueName.trim(), userId, name, color);
      onComplete(userId);
    } else {
      const code = joinCode.trim().toUpperCase();
      if (code.length !== 6) { setError('Code must be 6 characters.'); return; }
      const league = demoStore.joinLeagueByCode(code, userId, name, color);
      if (!league) { setError('Code not found. Check again.'); return; }
      onComplete(userId);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'calc(env(safe-area-inset-top) + 32px) 24px calc(env(safe-area-inset-bottom) + 32px)',
    }}>
      <img src="/receipts/logo.svg" alt="Receipts" style={{ width: 80, height: 80, marginBottom: 20 }} />
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Receipts</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 40, fontSize: 15 }}>Proof of who's actually better.</p>

      {step === 'intro' && (
        <div style={{ width: '100%', maxWidth: 380 }}>
          <button className="btn btn-primary" onClick={() => setStep('profile')}>
            Get started
          </button>
        </div>
      )}

      {step === 'profile' && (
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div className="label" style={{ marginBottom: 6 }}>Display name</div>
          <input
            className="input"
            placeholder="Ahmed"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ marginBottom: 20 }}
            autoFocus
          />
          <div className="label" style={{ marginBottom: 10 }}>Avatar color</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
            {AVATAR_COLORS.map((c: string) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: c,
                  border: color === c ? '3px solid var(--text)' : '3px solid transparent',
                  cursor: 'pointer',
                }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <button className="btn btn-primary" onClick={handleProfile} disabled={!name.trim()}>
            Continue
          </button>
        </div>
      )}

      {step === 'league' && (
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button
              className={`btn${leagueAction === 'create' ? ' btn-primary' : ' btn-ghost'}`}
              style={{ flex: 1, height: 44 }}
              onClick={() => setLeagueAction('create')}
            >
              Create league
            </button>
            <button
              className={`btn${leagueAction === 'join' ? ' btn-primary' : ' btn-ghost'}`}
              style={{ flex: 1, height: 44 }}
              onClick={() => setLeagueAction('join')}
            >
              Join league
            </button>
          </div>

          {leagueAction === 'create' ? (
            <>
              <div className="label" style={{ marginBottom: 6 }}>League name</div>
              <input
                className="input"
                placeholder="The Receipts"
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                style={{ marginBottom: 24 }}
                autoFocus
              />
            </>
          ) : (
            <>
              <div className="label" style={{ marginBottom: 6 }}>Join code</div>
              <input
                className="input"
                placeholder="K7QX2M"
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(''); }}
                style={{ marginBottom: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                maxLength={6}
                autoFocus
              />
              {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <div style={{ height: 16 }} />
            </>
          )}

          <button
            className="btn btn-primary"
            onClick={handleLeague}
            disabled={leagueAction === 'create' ? !leagueName.trim() : !joinCode.trim()}
          >
            {leagueAction === 'create' ? 'Create' : 'Join'}
          </button>
        </div>
      )}
    </div>
  );
}

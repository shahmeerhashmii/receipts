import React, { useState } from 'react';
import { demoStore } from '../demo/store';
import { AVATAR_COLORS } from '../demo/seed';
import { useApp } from '../context/AppContext';

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

interface OnboardingProps {
  /** Called after the user successfully creates or joins a league. */
  onComplete: () => void;
  /** Pre-fill the join-code field (from /receipts/join/:CODE route). */
  prefilledCode?: string;
}

export function OnboardingScreen({ onComplete, prefilledCode }: OnboardingProps) {
  const { state, setLiveLeagues } = useApp();

  const [step, setStep] = useState<'profile' | 'league'>('profile');
  const [name, setName] = useState('');
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [leagueAction, setLeagueAction] = useState<'create' | 'join'>(
    prefilledCode ? 'join' : 'create'
  );
  const [leagueName, setLeagueName] = useState('');
  const [joinCode, setJoinCode] = useState(prefilledCode?.toUpperCase() ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function handleProfile() {
    if (!name.trim()) return;
    setStep('league');
  }

  async function handleLeague() {
    if (busy) return;
    setBusy(true);
    setError('');

    try {
      if (IS_DEMO) {
        // Demo mode: direct demoStore calls
        const userId = 'user-' + Date.now();
        if (leagueAction === 'create') {
          if (!leagueName.trim()) { setBusy(false); return; }
          demoStore.createLeague(leagueName.trim(), userId, name, color);
        } else {
          const code = joinCode.trim().toUpperCase();
          if (code.length !== 6) { setError('Code must be 6 characters.'); setBusy(false); return; }
          const league = demoStore.joinLeagueByCode(code, userId, name, color);
          if (!league) { setError('Code not found. Check and try again.'); setBusy(false); return; }
        }
        onComplete();
      } else {
        // Live mode: Supabase RPCs
        // Auth was already done in startup; user id is in state.currentUserId
        const userId = state.currentUserId;
        if (!userId) throw new Error('Not signed in. Please reload and try again.');

        if (leagueAction === 'create') {
          if (!leagueName.trim()) { setBusy(false); return; }
          console.log('[Receipts] onboarding: creating league', leagueName.trim());
          const { supabase } = await import('../lib/supabase');
          const { data, error: rpcError } = await supabase.rpc('rpc_create_league', {
            p_name: leagueName.trim(),
            p_display_name: name.trim(),
            p_avatar_color: color,
          });
          if (rpcError) throw rpcError;
          console.log('[Receipts] onboarding: created league', data);

          // Refresh state by fetching the new league
          await refreshLeagues(userId);
          onComplete();
        } else {
          const code = joinCode.trim().toUpperCase();
          if (code.length !== 6) { setError('Code must be 6 characters.'); setBusy(false); return; }
          console.log('[Receipts] onboarding: joining league with code', code);
          const { supabase } = await import('../lib/supabase');
          const { data, error: rpcError } = await supabase.rpc('rpc_join_league', {
            p_code: code,
            p_display_name: name.trim(),
            p_avatar_color: color,
          });
          if (rpcError) {
            if (rpcError.message?.includes('not found') || rpcError.message?.includes('invalid')) {
              setError('Code not found. Check and try again.');
            } else {
              setError(rpcError.message ?? 'Join failed.');
            }
            setBusy(false);
            return;
          }
          console.log('[Receipts] onboarding: joined league', data);

          await refreshLeagues(userId);
          onComplete();
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Receipts] onboarding error:', msg);
      setError(msg);
      setBusy(false);
    }
  }

  async function refreshLeagues(userId: string) {
    const { supabase } = await import('../lib/supabase');
    const { data: memberRows, error } = await supabase
      .from('league_members')
      .select(`
        league_id, display_name, avatar_color, avatar_url, coins, is_admin, joined_at,
        leagues ( id, name, join_code, fifa_version, created_at,
          games ( id, name, type, is_custom ),
          league_members ( id, display_name, avatar_color, avatar_url, coins, is_admin, joined_at )
        )
      `)
      .eq('user_id', userId);

    if (error || !memberRows) {
      console.warn('[Receipts] onboarding: could not refresh leagues after join/create', error?.message);
      return;
    }

    type LeagueRow = {
      league_id: string;
      leagues: {
        id: string; name: string; join_code: string;
        fifa_version: string | null; created_at: string;
        games: Array<{ id: string; name: string; type: '1v1' | 'puzzle' | 'ffa'; is_custom?: boolean }>;
        league_members: Array<{
          id: string; display_name: string; avatar_color: string;
          avatar_url?: string; coins: number; is_admin: boolean; joined_at: string;
        }>;
      } | null;
    };

    const leagues = (memberRows as unknown as LeagueRow[])
      .map((row) => {
        const lg = row.leagues;
        if (!lg) return null;
        return {
          id: lg.id,
          name: lg.name,
          join_code: lg.join_code,
          fifa_version: lg.fifa_version ?? undefined,
          created_at: lg.created_at,
          games: lg.games ?? [],
          members: lg.league_members ?? [],
        };
      })
      .filter(Boolean) as import('../demo/store').League[];

    // Inject fresh data directly into AppContext state
    setLiveLeagues(leagues, userId, leagues[0]?.id ?? '');
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'calc(env(safe-area-inset-top, 0px) + 32px) 24px calc(env(safe-area-inset-bottom, 0px) + 32px)',
    }}>
      <img src="/receipts/logo.svg" alt="Receipts" style={{ width: 80, height: 80, marginBottom: 20 }} />
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Receipts</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 40, fontSize: 15 }}>Proof of who's actually better.</p>

      {step === 'profile' && (
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div className="label" style={{ marginBottom: 6 }}>Display name</div>
          <input
            className="input"
            placeholder="Ahmed"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleProfile()}
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
                  width: 44, height: 44, borderRadius: '50%', background: c,
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
              onClick={() => { setLeagueAction('create'); setError(''); }}
              disabled={!!prefilledCode}
            >
              Create league
            </button>
            <button
              className={`btn${leagueAction === 'join' ? ' btn-primary' : ' btn-ghost'}`}
              style={{ flex: 1, height: 44 }}
              onClick={() => { setLeagueAction('join'); setError(''); }}
            >
              Join with code
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
                onKeyDown={(e) => e.key === 'Enter' && handleLeague()}
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
                onKeyDown={(e) => e.key === 'Enter' && handleLeague()}
                style={{
                  marginBottom: 8, fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                }}
                maxLength={6}
                autoFocus={!prefilledCode}
                readOnly={!!prefilledCode}
              />
            </>
          )}

          {error && (
            <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleLeague}
            disabled={
              busy ||
              (leagueAction === 'create' ? !leagueName.trim() : joinCode.trim().length !== 6)
            }
            style={{ marginTop: error ? 0 : 8 }}
          >
            {busy ? 'Please wait...' : leagueAction === 'create' ? 'Create' : 'Join'}
          </button>

          <button
            className="btn btn-ghost"
            style={{ marginTop: 10, width: '100%' }}
            onClick={() => setStep('profile')}
            disabled={busy}
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}

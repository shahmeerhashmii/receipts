import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Avatar } from '../components/Avatar';
import { BottomSheet } from '../components/BottomSheet';
import { demoStore } from '../demo/store';

interface LeagueSwitcherProps {
  onSettings: () => void;
}

export function LeagueSwitcher({ onSettings }: LeagueSwitcherProps) {
  const { state, currentLeague, switchLeague } = useApp();
  const [open, setOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [newLeagueName, setNewLeagueName] = useState('');

  const userId = state.currentUserId;
  const myLeagues = state.leagues.filter((l) => l.members.some((m) => m.id === userId));

  function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    const league = demoStore.joinLeagueByCode(code, userId,
      state.leagues.find((l) => l.members.some((m) => m.id === userId))
        ?.members.find((m) => m.id === userId)?.display_name || 'Player',
      state.leagues.find((l) => l.members.some((m) => m.id === userId))
        ?.members.find((m) => m.id === userId)?.avatar_color || '#2EE58A'
    );
    if (!league) { setJoinError('Code not found.'); return; }
    setJoinOpen(false);
    setOpen(false);
    setJoinCode('');
  }

  function handleCreate() {
    if (!newLeagueName.trim()) return;
    const me = state.leagues.find((l) => l.members.some((m) => m.id === userId))?.members.find((m) => m.id === userId);
    demoStore.createLeague(newLeagueName.trim(), userId, me?.display_name || 'Player', me?.avatar_color || '#2EE58A');
    setCreateOpen(false);
    setOpen(false);
    setNewLeagueName('');
  }

  if (!currentLeague) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--raised)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-chip)', padding: '6px 12px',
          cursor: 'pointer', maxWidth: 180,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
          {currentLeague.name}
        </span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1L5 5L9 1" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Leagues">
        <div style={{ paddingBottom: 16 }}>
          {myLeagues.map((l) => (
            <button
              key={l.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
              }}
              onClick={() => { switchLeague(l.id); setOpen(false); }}
            >
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 600, color: l.id === currentLeague?.id ? 'var(--green)' : 'var(--text)' }}>
                  {l.name}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{l.members.length} members</div>
              </div>
              {l.id === currentLeague?.id && (
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, padding: '4px 8px' }}
                  onClick={(e) => { e.stopPropagation(); setOpen(false); onSettings(); }}
                >
                  Settings
                </button>
              )}
            </button>
          ))}
          <button
            className="btn btn-ghost"
            style={{ width: '100%', marginTop: 12, height: 44 }}
            onClick={() => { setOpen(false); setJoinOpen(true); }}
          >
            Join a league
          </button>
          <button
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: 8, height: 44 }}
            onClick={() => { setOpen(false); setCreateOpen(true); }}
          >
            Create a league
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={joinOpen} onClose={() => setJoinOpen(false)} title="Join a league">
        <div style={{ paddingBottom: 16 }}>
          <div className="label" style={{ marginBottom: 6 }}>Enter join code</div>
          <input
            className="input"
            placeholder="K7QX2M"
            value={joinCode}
            onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
            style={{ marginBottom: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            maxLength={6}
          />
          {joinError && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{joinError}</div>}
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={handleJoin} disabled={joinCode.length !== 6}>
            Join
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="Create a league">
        <div style={{ paddingBottom: 16 }}>
          <div className="label" style={{ marginBottom: 6 }}>League name</div>
          <input
            className="input"
            placeholder="The Receipts"
            value={newLeagueName}
            onChange={(e) => setNewLeagueName(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <button className="btn btn-primary" onClick={handleCreate} disabled={!newLeagueName.trim()}>
            Create
          </button>
        </div>
      </BottomSheet>
    </>
  );
}

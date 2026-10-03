import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Avatar } from '../components/Avatar';
import { demoStore } from '../demo/store';
import { generateJoinCode } from '../rules/joinCode';

export function LeagueSettingsScreen({ onClose }: { onClose: () => void }) {
  const { currentLeague, state } = useApp();
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (!currentLeague) return null;

  const userId = state.currentUserId;
  const isAdmin = currentLeague.members.find((m) => m.id === userId)?.is_admin;
  const joinUrl = `${window.location.origin}/receipts/join/${currentLeague.join_code}`;

  function copyCode() {
    navigator.clipboard.writeText(currentLeague!.join_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyLink() {
    navigator.clipboard.writeText(joinUrl);
  }

  function regenerateCode() {
    const newCode = generateJoinCode();
    demoStore.setState((s) => ({
      ...s,
      leagues: s.leagues.map((l) =>
        l.id === currentLeague!.id ? { ...l, join_code: newCode } : l
      ),
    }));
  }

  return (
    <div className="screen" style={{ paddingTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0, fontSize: 24 }}
          onClick={onClose}
        >
          &larr;
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>{currentLeague.name}</h2>
      </div>

      {/* Join code */}
      <div className="section-title">Join code</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="num" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '0.12em', textAlign: 'center', marginBottom: 12, color: 'var(--text)' }}>
          {currentLeague.join_code}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" style={{ flex: 1, height: 40, minHeight: 40, fontSize: 13 }} onClick={copyCode}>
            {copied ? 'Copied!' : 'Copy code'}
          </button>
          <button className="btn btn-secondary" style={{ flex: 1, height: 40, minHeight: 40, fontSize: 13 }} onClick={copyLink}>
            Copy invite link
          </button>
        </div>
        {isAdmin && (
          <button
            className="btn btn-ghost"
            style={{ width: '100%', marginTop: 8, height: 36, minHeight: 36, fontSize: 12 }}
            onClick={regenerateCode}
          >
            Regenerate code
          </button>
        )}
      </div>

      {/* FIFA version */}
      {isAdmin && (
        <>
          <div className="section-title">Current FIFA version</div>
          <div className="card" style={{ marginBottom: 16 }}>
            <input
              type="text"
              className="input"
              placeholder="e.g. FC 27"
              defaultValue={currentLeague.fifa_version || ''}
              onBlur={(e) => {
                demoStore.setState((s) => ({
                  ...s,
                  leagues: s.leagues.map((l) =>
                    l.id === currentLeague.id ? { ...l, fifa_version: e.target.value } : l
                  ),
                }));
              }}
            />
          </div>
        </>
      )}

      {/* Members */}
      <div className="section-title">Members ({currentLeague.members.length})</div>
      <div style={{ marginBottom: 16 }}>
        {currentLeague.members.map((m) => (
          <div key={m.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Avatar member={m} size={38} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{m.display_name}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                {m.is_admin ? 'Admin' : 'Member'}
              </div>
            </div>
            {isAdmin && m.id !== userId && (
              <button
                className="btn btn-ghost"
                style={{ height: 32, minHeight: 32, padding: '0 10px', fontSize: 12 }}
                onClick={() => {
                  demoStore.setState((s) => ({
                    ...s,
                    leagues: s.leagues.map((l) =>
                      l.id === currentLeague.id
                        ? { ...l, members: l.members.filter((mem) => mem.id !== m.id) }
                        : l
                    ),
                  }));
                }}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Leave */}
      <div className="divider" />
      {!confirmLeave ? (
        <button
          className="btn btn-ghost"
          style={{ width: '100%', color: 'var(--red)', borderColor: 'var(--red)' }}
          onClick={() => setConfirmLeave(true)}
        >
          Leave league
        </button>
      ) : (
        <div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>
            Are you sure you want to leave?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmLeave(false)}>Cancel</button>
            <button
              className="btn btn-danger"
              style={{ flex: 1 }}
              onClick={() => {
                demoStore.setState((s) => ({
                  ...s,
                  leagues: s.leagues.map((l) =>
                    l.id === currentLeague.id
                      ? { ...l, members: l.members.filter((m) => m.id !== userId) }
                      : l
                  ),
                  currentLeagueId: s.leagues.find((l) => l.id !== currentLeague.id)?.id || s.currentLeagueId,
                }));
                onClose();
              }}
            >
              Leave
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

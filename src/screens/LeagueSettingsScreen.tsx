import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Avatar } from '../components/Avatar';

export function LeagueSettingsScreen({ onClose }: { onClose: () => void }) {
  const { currentLeague, state, actions, switchLeague } = useApp();
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [fifaInput, setFifaInput] = useState('');
  const [fifaEditing, setFifaEditing] = useState(false);
  const [busy, setBusy] = useState(false);

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

  async function regenerateCode() {
    if (busy) return;
    setBusy(true);
    try {
      await actions.regenerateCode(currentLeague!.id);
    } finally {
      setBusy(false);
    }
  }

  async function saveName() {
    if (!nameInput.trim() || busy) return;
    setBusy(true);
    try {
      await actions.renameLeague(currentLeague!.id, nameInput.trim());
      setEditingName(false);
    } finally {
      setBusy(false);
    }
  }

  async function saveFifaVersion() {
    if (busy) return;
    setBusy(true);
    try {
      await actions.setFifaVersion(currentLeague!.id, fifaInput);
      setFifaEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(memberId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await actions.removeMember(currentLeague!.id, memberId);
    } finally {
      setBusy(false);
    }
  }

  async function leaveLeague() {
    if (busy) return;
    setBusy(true);
    try {
      await actions.leaveLeague(currentLeague!.id);
      onClose();
    } finally {
      setBusy(false);
    }
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
        {editingName ? (
          <div style={{ display: 'flex', gap: 8, flex: 1 }}>
            <input
              className="input"
              style={{ flex: 1, height: 36 }}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
              autoFocus
            />
            <button className="btn btn-primary" style={{ height: 36, minHeight: 36, padding: '0 12px', fontSize: 13 }} onClick={saveName} disabled={busy}>
              Save
            </button>
            <button className="btn btn-ghost" style={{ height: 36, minHeight: 36, padding: '0 10px', fontSize: 13 }} onClick={() => setEditingName(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <h2
            style={{ fontSize: 18, fontWeight: 700, cursor: isAdmin ? 'pointer' : 'default' }}
            onClick={() => { if (isAdmin) { setNameInput(currentLeague.name); setEditingName(true); } }}
            title={isAdmin ? 'Tap to rename' : undefined}
          >
            {currentLeague.name}
            {isAdmin && <span style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 400, marginLeft: 6 }}>edit</span>}
          </h2>
        )}
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
            disabled={busy}
          >
            {busy ? 'Regenerating...' : 'Regenerate code'}
          </button>
        )}
      </div>

      {/* FIFA version */}
      {isAdmin && (
        <>
          <div className="section-title">Current FIFA version</div>
          <div className="card" style={{ marginBottom: 16 }}>
            {fifaEditing ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  placeholder="e.g. FC 27"
                  value={fifaInput}
                  onChange={(e) => setFifaInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveFifaVersion(); if (e.key === 'Escape') setFifaEditing(false); }}
                  style={{ flex: 1 }}
                  autoFocus
                />
                <button className="btn btn-primary" style={{ height: 40, minHeight: 40, padding: '0 12px', fontSize: 13 }} onClick={saveFifaVersion} disabled={busy}>
                  Save
                </button>
              </div>
            ) : (
              <div
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                onClick={() => { setFifaInput(currentLeague.fifa_version || ''); setFifaEditing(true); }}
              >
                <span style={{ color: currentLeague.fifa_version ? 'var(--text)' : 'var(--muted)', fontSize: 15 }}>
                  {currentLeague.fifa_version || 'Not set'}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>edit</span>
              </div>
            )}
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
            {isAdmin && m.id !== userId && !m.is_admin && (
              <button
                className="btn btn-ghost"
                style={{ height: 32, minHeight: 32, padding: '0 10px', fontSize: 12 }}
                onClick={() => removeMember(m.id)}
                disabled={busy}
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
            {isAdmin && currentLeague.members.length > 1
              ? 'You are the admin. Transfer admin to another member before leaving.'
              : 'Are you sure you want to leave?'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmLeave(false)}>
              Cancel
            </button>
            {!(isAdmin && currentLeague.members.length > 1) && (
              <button
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={leaveLeague}
                disabled={busy}
              >
                {busy ? 'Leaving...' : 'Leave'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

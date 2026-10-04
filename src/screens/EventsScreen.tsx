import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Avatar } from '../components/Avatar';
import { BottomSheet } from '../components/BottomSheet';
import { votesNeededToPass } from '../rules/events';
import { format, formatDistanceToNow } from 'date-fns';

const EVENT_LABELS = {
  big_w: { label: 'Big W', color: 'var(--green)', effect: '+15%' },
  small_w: { label: 'Small W', color: 'var(--green)', effect: '+5%' },
  small_l: { label: 'Small L', color: 'var(--red)', effect: '-5%' },
  big_l: { label: 'Big L', color: 'var(--red)', effect: '-15%' },
};

export function EventsScreen() {
  const { currentLeague, state, actions } = useApp();
  const [proposeOpen, setProposeOpen] = useState(false);
  const [form, setForm] = useState({
    subject_id: '',
    description: '',
    size: 'big_w' as 'big_w' | 'small_w' | 'small_l' | 'big_l',
  });

  if (!currentLeague) return <div className="screen"><div className="empty">No league</div></div>;

  const userId = state.currentUserId;
  const leagueEvents = state.events
    .filter((e) => e.league_id === currentLeague.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const open = leagueEvents.filter((e) => e.status === 'open');
  const passed = leagueEvents.filter((e) => e.status === 'passed');
  const failed = leagueEvents.filter((e) => e.status === 'failed');

  function handlePropose() {
    if (!form.subject_id || !form.description) return;
    actions.proposeEvent({
      leagueId: currentLeague!.id,
      subjectId: form.subject_id,
      description: form.description,
      size: form.size,
    });
    setProposeOpen(false);
    setForm({ subject_id: '', description: '', size: 'big_w' });
  }

  function getMember(id: string) {
    return currentLeague!.members.find((m) => m.id === id);
  }

  function renderEvent(event: typeof leagueEvents[number]) {
    const subject = getMember(event.subject_id);
    const proposer = getMember(event.proposer_id);
    const label = EVENT_LABELS[event.size];
    const needed = votesNeededToPass(currentLeague!.members.length);
    const hasVoted = event.votes_for.includes(userId) || event.votes_against.includes(userId);
    const canVote = event.status === 'open' && event.subject_id !== userId && !hasVoted;

    return (
      <div key={event.id} className="card" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {subject && <Avatar member={subject} size={40} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{subject?.display_name}</span>
              <span style={{
                background: label.color === 'var(--green)' ? 'rgba(46,229,138,0.12)' : 'rgba(255,92,92,0.12)',
                color: label.color,
                borderRadius: 'var(--radius-chip)',
                padding: '1px 8px',
                fontSize: 12,
                fontWeight: 700,
              }}>
                {label.label} {label.effect}
              </span>
            </div>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 2 }}>
              "{event.description}"
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              Proposed by {proposer?.display_name} &bull;{' '}
              {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
            </div>
          </div>
        </div>

        {event.status === 'open' && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, background: 'var(--raised)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(event.votes_for.length / needed) * 100}%`,
                  background: 'var(--green)',
                  borderRadius: 999,
                  transition: 'width 0.3s',
                  maxWidth: '100%',
                }} />
              </div>
              <span className="num" style={{ color: 'var(--muted)', fontSize: 12 }}>
                {event.votes_for.length}/{needed}
              </span>
            </div>
            {canVote && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, height: 36, minHeight: 36, fontSize: 13 }}
                  onClick={() => actions.voteEvent(event.id, 'for')}
                >
                  👍 Yes
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ flex: 1, height: 36, minHeight: 36, fontSize: 13 }}
                  onClick={() => actions.voteEvent(event.id, 'against')}
                >
                  👎 No
                </button>
              </div>
            )}
            {hasVoted && (
              <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>
                You voted {event.votes_for.includes(userId) ? 'yes' : 'no'}
              </div>
            )}
          </div>
        )}

        {event.status === 'passed' && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="status-badge status-confirmed">Passed</span>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>Fades over 4 weeks</span>
          </div>
        )}

        {event.status === 'failed' && (
          <span className="status-badge status-voided" style={{ marginTop: 8, display: 'inline-flex' }}>Failed</span>
        )}
      </div>
    );
  }

  return (
    <div className="screen" style={{ paddingTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="section-title" style={{ margin: 0 }}>Events</div>
        <button
          className="btn btn-secondary"
          style={{ fontSize: 12, height: 32, minHeight: 32, padding: '0 12px' }}
          onClick={() => setProposeOpen(true)}
        >
          + Propose
        </button>
      </div>

      {open.length > 0 && (
        <>
          <div className="section-title">Open votes</div>
          {open.map(renderEvent)}
          <div className="divider" />
        </>
      )}

      {passed.length > 0 && (
        <>
          <div className="section-title">Passed</div>
          {passed.map(renderEvent)}
        </>
      )}

      {failed.length > 0 && (
        <>
          <div className="divider" />
          <div className="section-title">Failed</div>
          {failed.map(renderEvent)}
        </>
      )}

      {leagueEvents.length === 0 && (
        <div className="empty">No events yet. Propose something!</div>
      )}

      {/* Propose Sheet */}
      <BottomSheet open={proposeOpen} onClose={() => setProposeOpen(false)} title="Propose an event">
        <div style={{ paddingBottom: 16 }}>
          <div className="label" style={{ marginBottom: 6 }}>About</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {currentLeague.members.map((m) => (
              <button
                key={m.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  background: form.subject_id === m.id ? 'rgba(46,229,138,0.1)' : 'var(--raised)',
                  border: `1px solid ${form.subject_id === m.id ? 'rgba(46,229,138,0.4)' : 'var(--border)'}`,
                  borderRadius: 10, cursor: 'pointer',
                }}
                onClick={() => setForm((f) => ({ ...f, subject_id: m.id }))}
              >
                <Avatar member={m} size={30} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{m.display_name}</span>
                {form.subject_id === m.id && <span style={{ marginLeft: 'auto', color: 'var(--green)' }}>✓</span>}
              </button>
            ))}
          </div>

          <div className="label" style={{ marginBottom: 6 }}>What happened?</div>
          <textarea
            className="input"
            style={{ minHeight: 80, resize: 'none', marginBottom: 16 }}
            placeholder="Got a new setup, played on laggy wifi..."
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />

          <div className="label" style={{ marginBottom: 6 }}>Size</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {(Object.entries(EVENT_LABELS) as Array<[typeof form.size, typeof EVENT_LABELS[typeof form.size]]>).map(([key, val]) => (
              <button
                key={key}
                className={`btn${form.size === key ? '' : ' btn-ghost'}`}
                style={{
                  height: 44,
                  background: form.size === key ? (val.color === 'var(--green)' ? 'rgba(46,229,138,0.2)' : 'rgba(255,92,92,0.2)') : undefined,
                  color: form.size === key ? val.color : 'var(--muted)',
                  border: `1px solid ${form.size === key ? val.color : 'var(--border)'}`,
                  fontSize: 13,
                }}
                onClick={() => setForm((f) => ({ ...f, size: key }))}
              >
                {val.label} ({val.effect})
              </button>
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={handlePropose}
            disabled={!form.subject_id || !form.description}
          >
            Propose event
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

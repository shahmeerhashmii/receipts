import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Avatar } from '../components/Avatar';
import { ReactionBar } from '../components/ReactionBar';
import { BottomSheet } from '../components/BottomSheet';
import { demoStore } from '../demo/store';
import { expectedScore } from '../rules/elo';
import { pickMultiplier, maxStake, minStake, pickPayout } from '../rules/picks';
import { format } from 'date-fns';

const GAME_LABELS: Record<string, string> = {
  fifa: 'FIFA', gp_8ball: '8 Ball', gp_cup_pong: 'Cup Pong', gp_word_hunt: 'Word Hunt',
  wordle: 'Wordle', connections: 'Connections', krillion: 'Krillion', ballpark: 'Ballpark',
};

export function MatchesScreen() {
  const { currentLeague, state, memberStats, actions } = useApp();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [selectedScheduledId, setSelectedScheduledId] = useState<string | null>(null);
  const [pickForm, setPickForm] = useState({ pickedPlayerId: '', stake: 10 });
  const [schedForm, setSchedForm] = useState({ game_id: 'fifa', player_a: '', player_b: '', scheduled_at: '' });

  if (!currentLeague) return <div className="screen"><div className="empty">No league</div></div>;

  const userId = state.currentUserId;
  const leagueMatches = state.matches
    .filter((m) => m.league_id === currentLeague.id)
    .sort((a, b) => b.logged_at.localeCompare(a.logged_at));

  const upcomingScheduled = state.scheduledMatches
    .filter((s) => s.league_id === currentLeague.id && s.status === 'open')
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

  const selectedScheduled = selectedScheduledId
    ? upcomingScheduled.find((s) => s.id === selectedScheduledId)
    : null;

  function getMemberName(id: string) {
    return currentLeague!.members.find((m) => m.id === id)?.display_name || id;
  }

  function getMember(id: string) {
    return currentLeague!.members.find((m) => m.id === id);
  }

  function getPickMultiplier(scheduledId: string, playerId: string): number {
    const sched = upcomingScheduled.find((s) => s.id === scheduledId);
    if (!sched) return 1.9;
    const statsA = memberStats.find((s) => s.memberId === sched.player_a_id);
    const statsB = memberStats.find((s) => s.memberId === sched.player_b_id);
    const rA = statsA?.gameRatings?.[sched.game_id]?.rating || 1000;
    const rB = statsB?.gameRatings?.[sched.game_id]?.rating || 1000;
    const eA = expectedScore(rA, rB);
    const eB = 1 - eA;
    const e = playerId === sched.player_a_id ? eA : eB;
    return pickMultiplier(e);
  }

  function handleMakePick() {
    if (!selectedScheduled || !pickForm.pickedPlayerId) return;
    const mult = getPickMultiplier(selectedScheduled.id, pickForm.pickedPlayerId);
    actions.makePick({
      scheduledMatchId: selectedScheduled.id,
      pickedPlayerId: pickForm.pickedPlayerId,
      stake: pickForm.stake,
      multiplier: mult,
    });
    setPickOpen(false);
    setSelectedScheduledId(null);
  }

  function handleScheduleMatch() {
    if (!schedForm.player_a || !schedForm.player_b || !schedForm.scheduled_at) return;
    actions.scheduleMatch({
      leagueId: currentLeague!.id,
      gameId: schedForm.game_id,
      playerAId: schedForm.player_a,
      playerBId: schedForm.player_b,
      scheduledAt: new Date(schedForm.scheduled_at).toISOString(),
    });
    setScheduleOpen(false);
    setSchedForm({ game_id: 'fifa', player_a: '', player_b: '', scheduled_at: '' });
  }

  const myCoinBalance = currentLeague.members.find((m) => m.id === userId)?.coins || 0;
  const maxPickStake = maxStake(myCoinBalance);

  const pickMult = (selectedScheduled && pickForm.pickedPlayerId)
    ? getPickMultiplier(selectedScheduled.id, pickForm.pickedPlayerId)
    : 1.9;
  const potentialPayout = pickPayout(pickForm.stake, pickMult);

  return (
    <div className="screen" style={{ paddingTop: 16 }}>
      {/* Upcoming */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>Upcoming</div>
        <button className="btn btn-secondary" style={{ fontSize: 12, height: 32, minHeight: 32, padding: '0 12px' }}
          onClick={() => setScheduleOpen(true)}>
          + Schedule
        </button>
      </div>

      {upcomingScheduled.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20, textAlign: 'center' }}>
          No matches scheduled. Schedule one to enable picks.
        </div>
      ) : (
        upcomingScheduled.map((sched) => {
          const memberA = getMember(sched.player_a_id);
          const memberB = getMember(sched.player_b_id);
          const leaguePicks = state.picks.filter((p) => p.scheduled_match_id === sched.id);
          const myPick = leaguePicks.find((p) => p.picker_id === userId);

          return (
            <div key={sched.id} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className="status-badge status-pending">
                  {GAME_LABELS[sched.game_id] || sched.game_id}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                  {format(new Date(sched.scheduled_at), 'MMM d, h:mma')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                {memberA && <Avatar member={memberA} size={30} />}
                <span style={{ fontWeight: 600 }}>{getMemberName(sched.player_a_id)}</span>
                <span style={{ color: 'var(--muted)' }}>vs</span>
                <span style={{ fontWeight: 600 }}>{getMemberName(sched.player_b_id)}</span>
                {memberB && <Avatar member={memberB} size={30} />}
              </div>
              {myPick ? (
                <div>
                  <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>
                    Your pick: <strong style={{ color: 'var(--text)' }}>{getMemberName(myPick.picked_player_id)}</strong>
                    {' '}&bull; Stake <span className="num">{myPick.stake}</span> &rarr; win{' '}
                    <span className="num" style={{ color: 'var(--green)' }}>{pickPayout(myPick.stake, myPick.multiplier)}</span>
                  </div>
                  <button
                    className="btn btn-ghost"
                    style={{ width: '100%', height: 32, minHeight: 32, fontSize: 12 }}
                    onClick={() => {
                      // Refund old pick then reopen (rpc_make_pick handles this server-side;
                      // in demo mode replicate the same: remove old pick and refund coins)
                      demoStore.setState((s) => ({
                        ...s,
                        leagues: s.leagues.map((l) => {
                          if (l.id !== currentLeague!.id) return l;
                          return {
                            ...l,
                            members: l.members.map((m) =>
                              m.id === userId ? { ...m, coins: m.coins + myPick.stake } : m
                            ),
                          };
                        }),
                        picks: s.picks.filter((p) => p.id !== myPick.id),
                      }));
                      setPickForm({ pickedPlayerId: '', stake: myPick.stake });
                      setSelectedScheduledId(sched.id);
                      setPickOpen(true);
                    }}
                  >
                    Change pick
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', height: 36, minHeight: 36, fontSize: 13 }}
                  onClick={() => { setSelectedScheduledId(sched.id); setPickOpen(true); }}
                >
                  Make a pick
                </button>
              )}
            </div>
          );
        })
      )}

      <div className="divider" />

      {/* Recent results */}
      <div className="section-title">Recent results</div>
      {leagueMatches.slice(0, 20).map((match) => {
        const pA = getMember(match.player_a_id);
        const pB = getMember(match.player_b_id);
        const isMyMatch = match.player_a_id === userId || match.player_b_id === userId;
        const myResult = match.player_a_id === userId ? match.result : match.result === 'win' ? 'loss' : match.result === 'loss' ? 'win' : 'draw';

        function handleShare() {
          const nameA = getMemberName(match.player_a_id);
          const nameB = getMemberName(match.player_b_id);
          const game = GAME_LABELS[match.game_id] || match.game_id;
          const score = match.score_a !== undefined ? ` ${match.score_a}-${match.score_b}` : '';
          const resultText = match.result === 'win' ? `${nameA} beat ${nameB}` : match.result === 'draw' ? `${nameA} drew ${nameB}` : `${nameB} beat ${nameA}`;
          const text = `Receipts: ${game}${score} - ${resultText}. Proof of who's actually better.`;
          if (navigator.share) {
            navigator.share({ title: 'Receipts', text });
          } else {
            navigator.clipboard?.writeText(text);
          }
        }

        return (
          <div key={match.id} className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                {GAME_LABELS[match.game_id] || match.game_id}
              </span>
              <span className={`status-badge status-${match.status}`}>{match.status}</span>
              {isMyMatch && match.status === 'pending' && match.logged_by !== userId && (
                <button
                  className="btn btn-primary"
                  style={{ marginLeft: 'auto', height: 28, minHeight: 28, padding: '0 10px', fontSize: 12 }}
                  onClick={() => actions.confirmMatch(match.id)}
                >
                  Confirm
                </button>
              )}
              {isMyMatch && match.status === 'pending' && match.logged_by !== userId && (
                <button
                  className="btn btn-ghost"
                  style={{ height: 28, minHeight: 28, padding: '0 10px', fontSize: 12, marginLeft: 4 }}
                  onClick={() => actions.disputeMatch(match.id)}
                >
                  Dispute
                </button>
              )}
              {match.status === 'confirmed' && (
                <button
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '0 4px', fontSize: 13 }}
                  onClick={handleShare}
                  aria-label="Share"
                  title="Share"
                >
                  Share
                </button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {pA && <Avatar member={pA} size={28} />}
              <span style={{ fontWeight: 600, fontSize: 14 }}>{getMemberName(match.player_a_id)}</span>
              {match.score_a !== undefined && match.score_b !== undefined ? (
                <span className="num" style={{ color: 'var(--muted)', fontSize: 14, fontWeight: 600 }}>
                  {match.score_a} - {match.score_b}
                </span>
              ) : (
                <span style={{ color: 'var(--muted)' }}>vs</span>
              )}
              <span style={{ fontWeight: 600, fontSize: 14 }}>{getMemberName(match.player_b_id)}</span>
              {pB && <Avatar member={pB} size={28} />}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>
              {format(new Date(match.logged_at), 'MMM d')}
              {isMyMatch && match.status === 'confirmed' && (
                <span style={{ marginLeft: 8, color: myResult === 'win' ? 'var(--green)' : myResult === 'loss' ? 'var(--red)' : 'var(--muted)', fontWeight: 600 }}>
                  {myResult === 'win' ? 'Win' : myResult === 'loss' ? 'Loss' : 'Draw'}
                </span>
              )}
            </div>
            <ReactionBar
              reactions={match.reactions || {}}
              currentUserId={userId}
              onReact={(emoji) => demoStore.addReaction(match.id, 'match', emoji, userId, currentLeague.id)}
            />
          </div>
        );
      })}

      {leagueMatches.length === 0 && (
        <div className="empty">No matches yet.</div>
      )}

      {/* Schedule Match Sheet */}
      <BottomSheet open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Schedule a Match">
        <div style={{ paddingBottom: 16 }}>
          <div className="label" style={{ marginBottom: 6 }}>Game</div>
          <div className="chips-row" style={{ marginBottom: 16 }}>
            {currentLeague.games.filter((g) => g.type === '1v1').map((g) => (
              <button key={g.id} className={`chip${schedForm.game_id === g.id ? ' active' : ''}`}
                onClick={() => setSchedForm((f) => ({ ...f, game_id: g.id }))}>
                {g.name.replace('GamePigeon ', '').replace('FIFA / EA FC', 'FIFA')}
              </button>
            ))}
          </div>
          <div className="label" style={{ marginBottom: 6 }}>Player A</div>
          <select className="input" style={{ marginBottom: 12 }} value={schedForm.player_a}
            onChange={(e) => setSchedForm((f) => ({ ...f, player_a: e.target.value }))}>
            <option value="">Select player</option>
            {currentLeague.members.map((m) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
          <div className="label" style={{ marginBottom: 6 }}>Player B</div>
          <select className="input" style={{ marginBottom: 12 }} value={schedForm.player_b}
            onChange={(e) => setSchedForm((f) => ({ ...f, player_b: e.target.value }))}>
            <option value="">Select player</option>
            {currentLeague.members.filter((m) => m.id !== schedForm.player_a).map((m) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
          <div className="label" style={{ marginBottom: 6 }}>Date and time</div>
          <input type="datetime-local" className="input" style={{ marginBottom: 16 }} value={schedForm.scheduled_at}
            onChange={(e) => setSchedForm((f) => ({ ...f, scheduled_at: e.target.value }))} />
          <button className="btn btn-primary"
            onClick={handleScheduleMatch}
            disabled={!schedForm.player_a || !schedForm.player_b || !schedForm.scheduled_at}>
            Schedule match
          </button>
        </div>
      </BottomSheet>

      {/* Pick Sheet */}
      <BottomSheet open={pickOpen && !!selectedScheduled} onClose={() => { setPickOpen(false); setSelectedScheduledId(null); }} title="Make a pick">
        {selectedScheduled && (
          <div style={{ paddingBottom: 16 }}>
            <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
              Pick the winner of{' '}
              <strong style={{ color: 'var(--text)' }}>{getMemberName(selectedScheduled.player_a_id)}</strong>
              {' '}vs{' '}
              <strong style={{ color: 'var(--text)' }}>{getMemberName(selectedScheduled.player_b_id)}</strong>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[selectedScheduled.player_a_id, selectedScheduled.player_b_id].map((pid) => (
                <button
                  key={pid}
                  className={`btn ${pickForm.pickedPlayerId === pid ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, height: 44 }}
                  onClick={() => setPickForm((f) => ({ ...f, pickedPlayerId: pid }))}
                >
                  {getMemberName(pid)}
                </button>
              ))}
            </div>
            <div className="label" style={{ marginBottom: 6 }}>Stake (min {minStake()}, max {maxPickStake})</div>
            <input type="number" min={minStake()} max={maxPickStake} className="input" style={{ marginBottom: 12 }}
              value={pickForm.stake} onChange={(e) => setPickForm((f) => ({ ...f, stake: Math.min(maxPickStake, Math.max(minStake(), parseInt(e.target.value) || 5)) }))} />
            {pickForm.pickedPlayerId && (
              <div style={{ background: 'var(--raised)', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                  Stake <span className="num">{pickForm.stake}</span> coins &rarr; win{' '}
                  <span className="num" style={{ color: 'var(--green)', fontWeight: 700, fontSize: 15 }}>{potentialPayout}</span> coins
                </div>
              </div>
            )}
            <button className="btn btn-primary" onClick={handleMakePick}
              disabled={!pickForm.pickedPlayerId || pickForm.stake < minStake()}>
              Confirm pick
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

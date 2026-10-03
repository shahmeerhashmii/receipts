import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Avatar } from '../components/Avatar';
import { demoStore } from '../demo/store';
import { ACHIEVEMENTS, type AchievementDef } from '../rules/achievements';
import { recalculateRatings, inactivityAdjustment } from '../rules/elo';

const GAME_LABELS: Record<string, string> = {
  fifa: 'FIFA', gp_8ball: '8 Ball', gp_cup_pong: 'Cup Pong', gp_word_hunt: 'Word Hunt',
  wordle: 'Wordle', connections: 'Connections', krillion: 'Krillion', ballpark: 'Ballpark',
};

const BADGE_ICONS: Record<string, string> = {
  first_blood: '💧', hot_streak: '🔥', giant_slayer: '⚔️', comeback_kid: '🔄',
  bounty_hunter: '🎯', called_it: '👁️', oracle: '✨', diamond_hands: '💎',
  puzzle_machine: '🧩', wordle_wizard: '🪄', one_in_a_krillion: '🐟', ironman: '🏋️',
};

// Center-screen badge detail modal
function BadgeModal({
  ach,
  earned,
  badgeIcons,
  onClose,
}: {
  ach: AchievementDef;
  earned: boolean;
  badgeIcons: Record<string, string>;
  onClose: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 24px',
        }}
        aria-hidden="true"
      />
      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 201,
          background: 'var(--raised)',
          border: `1px solid ${ach.color}55`,
          borderRadius: 16,
          padding: 24,
          width: 'min(340px, calc(100vw - 48px))',
          boxSizing: 'border-box',
        }}
      >
        {/* Hex badge large */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{
            width: 72,
            height: 72,
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            background: ach.color + '22',
            border: `3px solid ${ach.color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30,
            opacity: earned ? 1 : 0.45,
          }}>
            {badgeIcons[ach.id] || '🏆'}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: ach.color, marginBottom: 4 }}>
            {ach.name}
          </div>
          {earned && (
            <span style={{
              fontSize: 11, fontWeight: 600,
              background: 'rgba(46,229,138,0.15)', color: 'var(--green)',
              borderRadius: 999, padding: '2px 10px',
            }}>
              Earned
            </span>
          )}
          {!earned && (
            <span style={{
              fontSize: 11, fontWeight: 600,
              background: 'var(--surface)', color: 'var(--muted)',
              borderRadius: 999, padding: '2px 10px',
            }}>
              Locked
            </span>
          )}
        </div>

        <div style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', marginBottom: 16, lineHeight: 1.5 }}>
          {ach.description}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
          <span style={{ color: 'var(--gold)', fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            +{ach.coins} coins
          </span>
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 999, padding: '10px 0', color: 'var(--text)', fontSize: 14,
            fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sora)',
            textAlign: 'center',
          }}
        >
          Close
        </button>
      </div>
    </>
  );
}

// Tappable badge grid - tap any badge to open center modal
function BadgeGrid({
  achievements,
  earnedIds,
  badgeIcons,
}: {
  achievements: AchievementDef[];
  earnedIds: Set<string>;
  badgeIcons: Record<string, string>;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeAch = activeId ? achievements.find((a) => a.id === activeId) : null;

  return (
    <>
      <div className="section-title">Badges</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {achievements.map((ach) => {
          const earned = earnedIds.has(ach.id);
          return (
            <button
              key={ach.id}
              onClick={() => setActiveId(ach.id)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                opacity: earned ? 1 : 0.35,
              }}
              aria-label={ach.name}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  background: 'var(--surface)',
                  border: `3px solid ${ach.color}88`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                }}
              >
                {badgeIcons[ach.id] || '🏆'}
              </div>
              <div style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.2 }}>
                {ach.name}
              </div>
            </button>
          );
        })}
      </div>

      {/* Center modal when a badge is tapped */}
      {activeAch && (
        <BadgeModal
          ach={activeAch}
          earned={earnedIds.has(activeAch.id)}
          badgeIcons={badgeIcons}
          onClose={() => setActiveId(null)}
        />
      )}
    </>
  );
}


export function ProfileScreen({ memberId, onBack }: { memberId?: string; onBack?: () => void }) {
  const { currentLeague, state, memberStats } = useApp();
  const [versionFilter, setVersionFilter] = useState<string | null>(null);

  if (!currentLeague) return null;

  const userId = memberId || state.currentUserId;
  const isOwnProfile = userId === state.currentUserId;
  const member = currentLeague.members.find((m) => m.id === userId);
  if (!member) return null;

  const stats = memberStats.find((s) => s.memberId === userId);
  const myBadges = demoStore.getMemberBadges(userId, currentLeague.id);
  const earnedIds = new Set(myBadges.map((b) => b.achievement_id));

  const leagueMatches = state.matches.filter((m) => m.league_id === currentLeague.id && m.status === 'confirmed');
  const myMatches = leagueMatches.filter(
    (m) => m.player_a_id === userId || m.player_b_id === userId
  );

  const allRatings = recalculateRatings(leagueMatches);
  const now = new Date().toISOString();

  interface GameRating {
    gameId: string;
    name: string;
    rating: number;
    baseRating: number;
    matchCount: number;
    lastPlayedAt: string;
  }
  const gameRatings: GameRating[] = currentLeague.games
    .filter((g) => g.type === '1v1' || g.type === 'puzzle')
    .map((game): GameRating | null => {
      const gr = allRatings.get(userId)?.get(game.id);
      if (!gr) return null;
      const inactivity = inactivityAdjustment(gr.rating, gr.lastPlayedAt, now);
      return {
        gameId: game.id,
        name: game.name,
        rating: gr.rating + inactivity,
        baseRating: gr.rating,
        matchCount: gr.matchCount,
        lastPlayedAt: gr.lastPlayedAt,
      };
    })
    .filter((x): x is GameRating => x !== null);

  // Head-to-head records (only show on own profile to keep other profiles focused)
  const opponents = currentLeague.members.filter((m) => m.id !== userId);
  const h2h = isOwnProfile ? opponents.map((opp) => {
    const matches = myMatches.filter(
      (m) => m.player_a_id === opp.id || m.player_b_id === opp.id
    );
    const filteredMatches = versionFilter
      ? matches.filter((m) => m.fifa_version === versionFilter)
      : matches;
    const wins = filteredMatches.filter(
      (m) => (m.player_a_id === userId && m.result === 'win') || (m.player_b_id === userId && m.result === 'loss')
    ).length;
    const losses = filteredMatches.filter(
      (m) => (m.player_a_id === userId && m.result === 'loss') || (m.player_b_id === userId && m.result === 'win')
    ).length;
    const draws = filteredMatches.filter((m) => m.result === 'draw').length;
    return { opponent: opp, wins, losses, draws, total: filteredMatches.length };
  }).filter((r) => r.total > 0) : [];

  const fifaVersions = isOwnProfile
    ? [...new Set(myMatches.filter((m) => m.fifa_version).map((m) => m.fifa_version!))]
    : [];

  // Stocks this member holds
  const theirHoldings = state.holdings.filter(
    (h) => h.league_id === currentLeague.id && h.holder_id === userId
  );

  return (
    <div className="screen" style={{ paddingTop: 16 }}>
      {/* Back button (when viewing someone else) */}
      {onBack && (
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', color: 'var(--muted)',
            cursor: 'pointer', padding: '0 0 16px', fontSize: 14, fontWeight: 500,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>&#8592;</span>
          Back
        </button>
      )}

      {/* Profile header */}
      <div className="card-raised" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar member={member} size={56} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{member.display_name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>
              {currentLeague.name} {member.is_admin && <span className="status-badge status-confirmed" style={{ fontSize: 10 }}>Admin</span>}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>
              {stats?.overallRating || 1000}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Overall</div>
          </div>
        </div>
      </div>

      {/* Game ratings */}
      {gameRatings.length > 0 && (
        <>
          <div className="section-title">Ratings</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            {gameRatings.map((gr) => (
              <div key={gr.gameId} className="card" style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 4 }}>
                  {GAME_LABELS[gr.gameId] || gr.name}
                </div>
                <div className="num" style={{ fontWeight: 700, fontSize: 20 }}>{gr.rating}</div>
                <div style={{ color: 'var(--muted)', fontSize: 11 }} className="num">
                  {gr.matchCount} {gr.matchCount === 1 ? 'game' : 'games'}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Head-to-head */}
      {h2h.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="section-title" style={{ margin: 0 }}>Head-to-head</div>
            {fifaVersions.length > 0 && (
              <div className="chips-row">
                <button className={`chip${!versionFilter ? ' active' : ''}`} onClick={() => setVersionFilter(null)}>
                  All
                </button>
                {fifaVersions.map((v) => (
                  <button key={v} className={`chip${versionFilter === v ? ' active' : ''}`} onClick={() => setVersionFilter(v)}>
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>
          {h2h.map(({ opponent, wins, losses, draws }) => (
            <div key={opponent.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Avatar member={opponent} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{opponent.display_name}</div>
              </div>
              <div className="num" style={{ fontWeight: 700, fontSize: 15 }}>
                <span style={{ color: 'var(--green)' }}>{wins}</span>
                <span style={{ color: 'var(--muted)' }}> - </span>
                <span style={{ color: 'var(--red)' }}>{losses}</span>
                {draws > 0 && <span style={{ color: 'var(--muted)' }}> - {draws}D</span>}
              </div>
            </div>
          ))}
          <div className="divider" />
        </>
      )}

      {/* Badges */}
      <BadgeGrid achievements={ACHIEVEMENTS} earnedIds={earnedIds} badgeIcons={BADGE_ICONS} />

      {/* Coins */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ color: 'var(--muted)', fontSize: 14 }}>Coin balance</div>
        <div className="num" style={{ fontWeight: 700, fontSize: 18, color: 'var(--gold)' }}>
          {member.coins} coins
        </div>
      </div>

      {/* Stock holdings (shown for everyone) */}
      {theirHoldings.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 16 }}>Portfolio</div>
          {theirHoldings.map((holding) => {
            const subjectMember = currentLeague.members.find((m) => m.id === holding.subject_id);
            const subjectStats = memberStats.find((s) => s.memberId === holding.subject_id);
            const price = subjectStats?.stockPrice || 40;
            if (!subjectMember) return null;
            return (
              <div
                key={holding.id}
                className="card"
                style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}
              >
                <Avatar
                  member={{ display_name: subjectMember.display_name, avatar_color: subjectMember.avatar_color }}
                  size={34}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{subjectMember.display_name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                    <span className="num">{holding.shares}</span> shares
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontWeight: 600, fontSize: 14 }}>{holding.shares * price}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 11 }} className="num">@{price} each</div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

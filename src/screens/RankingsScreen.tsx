import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Avatar } from '../components/Avatar';
import { recalculateRatings, inactivityAdjustment } from '../rules/elo';
import { IconTarget } from '@tabler/icons-react';
import { IconChevronRight } from '@tabler/icons-react';

const GAME_LABELS: Record<string, string> = {
  fifa: 'FIFA',
  gp_8ball: '8 Ball',
  gp_cup_pong: 'Cup Pong',
  gp_word_hunt: 'Word Hunt',
  wordle: 'Wordle',
  connections: 'Connections',
  krillion: 'Krillion',
  ballpark: 'Ballpark',
};

// Lower-wins puzzle types
const LOWER_WINS = new Set(['wordle', 'connections']);

export function RankingsScreen() {
  const { currentLeague, memberStats, state, viewProfile } = useApp();
  const [activeTab, setActiveTab] = useState('overall');

  if (!currentLeague) return <div className="screen"><div className="empty">No league selected</div></div>;

  const leagueMatches = state.matches.filter(
    (m) => m.league_id === currentLeague.id && m.status === 'confirmed'
  );
  const allRatings = recalculateRatings(leagueMatches);
  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];

  const tabs = [
    { id: 'overall', label: 'Overall' },
    ...currentLeague.games.map((g) => ({ id: g.id, label: GAME_LABELS[g.id] || g.name })),
  ];

  const activeGameDef = currentLeague.games.find((g) => g.id === activeTab);
  const isPuzzleTab = activeGameDef?.type === 'puzzle';

  // Get ranked members for a specific game tab
  function getRankedMembers(tab: string) {
    if (tab === 'overall') {
      return [...memberStats].sort((a, b) => b.overallRating - a.overallRating);
    }
    // Per-game tab
    return currentLeague!.members
      .map((member) => {
        const gr = allRatings.get(member.id)?.get(tab);
        const rating = gr?.rating || 1000;
        const matchCount = gr?.matchCount || 0;
        const lastPlayedAt = gr?.lastPlayedAt || '';
        const inactivity = inactivityAdjustment(rating, lastPlayedAt, now);
        const displayRating = rating + inactivity;
        return { member, rating, displayRating, matchCount, lastPlayedAt };
      })
      .sort((a, b) => b.displayRating - a.displayRating);
  }

  // Today's puzzle leaderboard for a puzzle tab
  function getTodayLeaderboard(gameId: string) {
    const subs = state.puzzleSubmissions
      .filter(
        (s) =>
          s.league_id === currentLeague!.id &&
          s.game_id === gameId &&
          s.puzzle_date === today
      );
    if (subs.length === 0) return null;
    const lowerWins = LOWER_WINS.has(gameId);
    return [...subs].sort((a, b) =>
      lowerWins ? a.score - b.score : b.score - a.score
    );
  }

  // Compute bounties
  function getBounty(gameId: string): { holderId: string; amount: number } | null {
    if (gameId === 'overall') return null;
    const ranked = getRankedMembers(gameId).filter((r) => {
      const mc = 'matchCount' in r ? (r as { matchCount: number }).matchCount : 0;
      return mc >= 10;
    });
    if (ranked.length === 0) return null;
    const top = ranked[0] as { member: { id: string } };
    return { holderId: top.member.id, amount: 25 };
  }

  const bounty = getBounty(activeTab);
  const ranked = getRankedMembers(activeTab);
  const todayLeaderboard = isPuzzleTab ? getTodayLeaderboard(activeTab) : null;

  return (
    <div>
      <div className="tab-nav" style={{ position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-nav-item${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="screen">
        {/* Today's puzzle leaderboard for puzzle tabs */}
        {isPuzzleTab && (
          <div style={{ marginBottom: 16 }}>
            <div className="section-title">Today</div>
            {todayLeaderboard && todayLeaderboard.length > 0 ? (
              todayLeaderboard.map((sub, idx) => {
                const member = currentLeague.members.find((m) => m.id === sub.member_id);
                if (!member) return null;
                return (
                  <div key={sub.id} className="card" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="num" style={{ width: 18, textAlign: 'center', color: idx === 0 ? 'var(--gold)' : 'var(--muted)', fontSize: 13, flexShrink: 0, fontWeight: idx === 0 ? 700 : 400 }}>
                      {idx + 1}
                    </span>
                    <Avatar member={member} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{member.display_name}</div>
                      {sub.emoji_grid && (
                        <div style={{ fontSize: 10, lineHeight: 1.3, marginTop: 2, color: 'var(--muted)' }}>
                          {sub.emoji_grid}
                        </div>
                      )}
                    </div>
                    <div className="num" style={{ fontSize: 15, fontWeight: 700, color: idx === 0 ? 'var(--green)' : 'var(--text)', flexShrink: 0 }}>
                      {sub.score}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
                No one has posted today. Be first!
              </div>
            )}
            <div className="divider" style={{ marginTop: 4 }} />
          </div>
        )}

        {/* Rating leaderboard */}
        {!isPuzzleTab && <div className="section-title">Rankings</div>}
        {ranked.map((entry, index) => {
          const isOverall = activeTab === 'overall';
          const member = isOverall
            ? currentLeague.members.find((m) => m.id === (entry as { memberId: string }).memberId)!
            : (entry as { member: { id: string; display_name: string; avatar_color: string; avatar_url?: string } }).member;

          const rating = isOverall
            ? (entry as { overallRating: number }).overallRating
            : (entry as { displayRating: number }).displayRating;

          const matchCount = isOverall ? null : (entry as { matchCount: number }).matchCount;
          const isTop = index === 0;
          const isBountyHolder = bounty && member.id === bounty.holderId;
          const memberId = member.id;

          // Record for this game
          const wins = leagueMatches.filter(
            (m) => (m.game_id === activeTab || activeTab === 'overall') &&
              ((m.player_a_id === memberId && m.result === 'win') ||
               (m.player_b_id === memberId && m.result === 'loss'))
          ).length;
          const losses = leagueMatches.filter(
            (m) => (m.game_id === activeTab || activeTab === 'overall') &&
              ((m.player_a_id === memberId && m.result === 'loss') ||
               (m.player_b_id === memberId && m.result === 'win'))
          ).length;
          const draws = leagueMatches.filter(
            (m) => (m.game_id === activeTab || activeTab === 'overall') &&
              (m.player_a_id === memberId || m.player_b_id === memberId) &&
              m.result === 'draw'
          ).length;

          const memberForAvatar = {
            display_name: member.display_name,
            avatar_color: member.avatar_color,
            avatar_url: member.avatar_url,
          };

          if (isTop) {
            return (
              <button
                key={member.id}
                className="card-raised"
                style={{ marginBottom: 12, position: 'relative', border: '1px solid rgba(242,193,78,0.25)', paddingTop: 28, width: '100%', cursor: 'pointer', textAlign: 'left' }}
                onClick={() => viewProfile(member.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ position: 'relative' }}>
                    <Avatar member={memberForAvatar} size={52} showCrown />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--gold)' }}>#{index + 1}</span>
                      <span style={{ fontWeight: 600, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {member.display_name}
                      </span>
                      {matchCount !== null && matchCount < 10 && (
                        <span className="status-badge status-pending" style={{ fontSize: 10 }}>New</span>
                      )}
                      {isBountyHolder && (
                        <span className="bounty-chip">
                          <IconTarget size={11} /> {bounty.amount}
                        </span>
                      )}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
                      {wins}W-{losses}L{draws > 0 ? `-${draws}D` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>
                      {rating}
                    </div>
                    <IconChevronRight size={16} color="var(--muted)" />
                  </div>
                </div>
              </button>
            );
          }

          return (
            <button
              key={member.id}
              className="card"
              style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, width: '100%', cursor: 'pointer', textAlign: 'left' }}
              onClick={() => viewProfile(member.id)}
            >
              <span className="num" style={{ width: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13, flexShrink: 0 }}>
                {index + 1}
              </span>
              <Avatar member={memberForAvatar} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {member.display_name}
                  </span>
                  {matchCount !== null && matchCount < 10 && (
                    <span className="status-badge status-pending" style={{ fontSize: 10 }}>New</span>
                  )}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                  {wins}W-{losses}L{draws > 0 ? `-${draws}D` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <div className="num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                  {rating}
                </div>
                <IconChevronRight size={14} color="var(--muted)" />
              </div>
            </button>
          );
        })}
        {ranked.length === 0 && !isPuzzleTab && (
          <div className="empty">No matches yet. Log your first game!</div>
        )}
      </div>
    </div>
  );
}

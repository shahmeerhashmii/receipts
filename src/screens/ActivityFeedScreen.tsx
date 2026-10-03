import React from 'react';
import { useApp } from '../context/AppContext';
import { Avatar } from '../components/Avatar';
import { ReactionBar } from '../components/ReactionBar';
import { demoStore } from '../demo/store';
import { formatDistanceToNow } from 'date-fns';

const GAME_LABELS: Record<string, string> = {
  fifa: 'FIFA', gp_8ball: '8 Ball', gp_cup_pong: 'Cup Pong', gp_word_hunt: 'Word Hunt',
  wordle: 'Wordle', connections: 'Connections', krillion: 'Krillion', ballpark: 'Ballpark',
};

const EVENT_EFFECT: Record<string, string> = {
  big_w: '+15%', small_w: '+5%', small_l: '-5%', big_l: '-15%',
};

export function ActivityFeedScreen() {
  const { currentLeague, state } = useApp();

  if (!currentLeague) return <div className="screen"><div className="empty">No league</div></div>;

  const userId = state.currentUserId;

  // Read directly from state so reactions re-render instantly
  const feed = state.feedItems
    .filter((f) => f.league_id === currentLeague.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  function getMember(id: string) {
    return currentLeague!.members.find((m) => m.id === id);
  }

  function renderFeedItem(item: typeof feed[number]) {
    let content: React.ReactNode = null;
    let accent: string | null = null;

    if (item.type === 'match_confirmed' || item.type === 'match_logged') {
      const pA = getMember(item.payload.player_a_id as string);
      const pB = getMember(item.payload.player_b_id as string);
      const result = item.payload.result as string;
      const gameLabel = GAME_LABELS[item.payload.game_id as string] || String(item.payload.game_id);
      const scoreA = item.payload.score_a;
      const scoreB = item.payload.score_b;
      content = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {pA && <Avatar member={pA} size={24} />}
          <span style={{ fontWeight: 600, fontSize: 13 }}>{pA?.display_name}</span>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>
            {result === 'win' ? 'beat' : result === 'draw' ? 'drew with' : 'lost to'}
          </span>
          {pB && <Avatar member={pB} size={24} />}
          <span style={{ fontWeight: 600, fontSize: 13 }}>{pB?.display_name}</span>
          {scoreA !== undefined && scoreB !== undefined && (
            <span className="num" style={{ color: 'var(--muted)', fontSize: 12 }}>
              {String(scoreA)}-{String(scoreB)}
            </span>
          )}
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>in {gameLabel}</span>
          {item.type === 'match_logged' && (
            <span className="status-badge status-pending" style={{ fontSize: 10 }}>pending</span>
          )}
        </div>
      );
    } else if (item.type === 'puzzle_submitted') {
      const member = getMember(item.payload.member_id as string);
      const gameLabel = GAME_LABELS[item.payload.game_id as string] || String(item.payload.game_id);
      const emojiGrid = item.payload.emoji_grid != null ? String(item.payload.emoji_grid) : null;
      content = (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {member && <Avatar member={member} size={24} />}
            <span style={{ fontWeight: 600, fontSize: 13 }}>{member?.display_name}</span>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>posted {gameLabel}</span>
            <span className="num" style={{ color: 'var(--text)', fontSize: 13 }}>
              {item.payload.score !== undefined ? String(item.payload.score) : ''}
            </span>
          </div>
          {emojiGrid && (
            <div style={{ fontSize: 12, lineHeight: 1.4, marginTop: 6, color: 'var(--muted)' }}>
              {emojiGrid}
            </div>
          )}
        </div>
      );
    } else if (item.type === 'event_passed') {
      const subject = getMember(item.payload.subject_id as string);
      const size = item.payload.size as string;
      const effect = EVENT_EFFECT[size] || '';
      const isPositive = effect.startsWith('+');
      const descStr = item.payload.description != null ? String(item.payload.description) : null;
      accent = isPositive ? 'var(--green)' : 'var(--red)';
      content = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {subject && <Avatar member={subject} size={24} />}
          <span style={{ fontWeight: 600, fontSize: 13 }}>{subject?.display_name}</span>
          <span style={{
            background: isPositive ? 'rgba(46,229,138,0.12)' : 'rgba(255,92,92,0.12)',
            color: isPositive ? 'var(--green)' : 'var(--red)',
            borderRadius: 999, padding: '1px 7px', fontSize: 12, fontWeight: 700,
          }}>
            {effect}
          </span>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>event passed</span>
          {descStr && (
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>"{descStr}"</span>
          )}
        </div>
      );
    } else if (item.type === 'badge_earned') {
      const member = getMember(item.payload.member_id as string);
      const badgeName = item.payload.badge_name ? String(item.payload.badge_name) : 'a badge';
      content = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {member && <Avatar member={member} size={24} />}
          <span style={{ fontWeight: 600, fontSize: 13 }}>{member?.display_name}</span>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>earned</span>
          <span style={{
            background: 'rgba(242,193,78,0.12)', color: 'var(--gold)',
            borderRadius: 999, padding: '1px 8px', fontSize: 12, fontWeight: 700,
          }}>
            {badgeName}
          </span>
        </div>
      );
    } else if (item.type === 'pick_settled') {
      const picker = getMember(item.payload.picker_id as string);
      const won = item.payload.status === 'won';
      content = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {picker && <Avatar member={picker} size={24} />}
          <span style={{ fontWeight: 600, fontSize: 13 }}>{picker?.display_name}</span>
          <span style={{ color: won ? 'var(--green)' : 'var(--muted)', fontSize: 13 }}>
            {won ? 'won' : 'lost'}
          </span>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>a pick</span>
          {won && item.payload.payout !== undefined && (
            <span className="num" style={{ color: 'var(--green)', fontSize: 13, fontWeight: 700 }}>
              +{String(item.payload.payout)} coins
            </span>
          )}
        </div>
      );
    } else {
      content = (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>
          {item.type.replace(/_/g, ' ')}
        </div>
      );
    }

    return (
      <div
        key={item.id}
        style={{
          borderBottom: '1px solid var(--border)',
          paddingBottom: 12,
          marginBottom: 12,
          borderLeft: accent ? `3px solid ${accent}` : undefined,
          paddingLeft: accent ? 10 : undefined,
        }}
      >
        <div style={{ marginBottom: 4 }}>{content}</div>
        <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 4 }}>
          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
        </div>
        <ReactionBar
          reactions={item.reactions}
          currentUserId={userId}
          onReact={(emoji) => demoStore.addReaction(item.id, 'feed', emoji, userId, currentLeague!.id)}
        />
      </div>
    );
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div className="section-title" style={{ margin: 0 }}>Activity</div>
        <span className="live-dot" />
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>Live</span>
      </div>

      {feed.length === 0 ? (
        <div className="empty">Nothing yet. Start playing!</div>
      ) : (
        feed.slice(0, 60).map(renderFeedItem)
      )}
    </div>
  );
}

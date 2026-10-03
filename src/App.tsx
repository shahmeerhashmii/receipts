import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { RankingsScreen } from './screens/RankingsScreen';
import { CrewfolioScreen } from './screens/CrewfolioScreen';
import { MatchesScreen } from './screens/MatchesScreen';
import { EventsScreen } from './screens/EventsScreen';
import { ActivityFeedScreen } from './screens/ActivityFeedScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { LeagueSettingsScreen } from './screens/LeagueSettingsScreen';
import { LogSheet } from './screens/LogSheet';
import { LeagueSwitcher } from './components/LeagueSwitcher';
import { Avatar } from './components/Avatar';
import { demoStore } from './demo/store';

import {
  IconTrophy,
  IconBriefcase,
  IconCalendar,
  IconStar,
  IconPlus,
  IconBell,
  IconBellRinging,
} from '@tabler/icons-react';

type Screen = 'rankings' | 'crewfolio' | 'matches' | 'events' | 'feed' | 'profile' | 'settings';

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

function AppShell() {
  const { currentLeague, currentMember, isDemo, state, viewingMemberId, clearProfile } = useApp();
  const [screen, setScreen] = useState<Screen>('rankings');
  const [logOpen, setLogOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  if (!currentLeague || !currentMember) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
        <img src="/receipts/logo.svg" alt="Receipts" width={80} height={80} />
        <div style={{ fontWeight: 700, fontSize: 22 }}>Receipts</div>
        <div style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center' }}>
          Proof of who's actually better.
        </div>
        <div className="spinner" />
      </div>
    );
  }

  const memberForAvatar = {
    display_name: currentMember.display_name,
    avatar_color: currentMember.avatar_color,
    avatar_url: currentMember.avatar_url,
  };

  const renderScreen = () => {
    // If viewing another member's profile, show it on top
    if (viewingMemberId && viewingMemberId !== state.currentUserId) {
      return <ProfileScreen memberId={viewingMemberId} onBack={clearProfile} />;
    }
    switch (screen) {
      case 'rankings': return <RankingsScreen />;
      case 'crewfolio': return <CrewfolioScreen />;
      case 'matches': return <MatchesScreen />;
      case 'events': return <EventsScreen />;
      case 'feed': return <ActivityFeedScreen />;
      case 'profile': return <ProfileScreen />;
      case 'settings': return <LeagueSettingsScreen onClose={() => setScreen('rankings')} />;
      default: return <RankingsScreen />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {/* Demo banner */}
      {isDemo && (
        <div className="demo-banner">
          Demo mode &bull; all data is local
        </div>
      )}

      {/* Top bar */}
      <div className="top-bar" style={{ flexShrink: 0 }}>
        {/* Receipts logo + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
          <img src="/receipts/logo.svg" alt="" width={26} height={26} style={{ borderRadius: 6, flexShrink: 0 }} />
          <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Receipts
          </span>
        </div>

        <LeagueSwitcher onSettings={() => setScreen('settings')} />
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="live-dot" style={{ marginRight: 4 }} />
        </div>
        <button
          onClick={() => { setScreen('feed'); setHasUnread(false); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, position: 'relative', color: 'var(--text)' }}
          aria-label="Activity feed"
        >
          {hasUnread ? <IconBellRinging size={22} /> : <IconBell size={22} />}
          {hasUnread && <span className="unread-dot" />}
        </button>
        <button
          onClick={() => setScreen('profile')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          aria-label="Profile"
        >
          <Avatar member={memberForAvatar} size={32} />
        </button>
      </div>

      {/* Main screen content -- scrollable */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
      } as React.CSSProperties}>
        {renderScreen()}
      </div>

      {/* Bottom tab bar */}
      <div className="tab-bar">
        <button
          className={`tab-item${screen === 'rankings' ? ' active' : ''}`}
          onClick={() => setScreen('rankings')}
          aria-label="Rankings"
        >
          <IconTrophy size={22} />
          <span>Rankings</span>
        </button>
        <button
          className={`tab-item${screen === 'crewfolio' ? ' active' : ''}`}
          onClick={() => setScreen('crewfolio')}
          aria-label="Crewfolio"
        >
          <IconBriefcase size={22} />
          <span>Crewfolio</span>
        </button>

        {/* Raised Log button */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <button className="tab-log-btn" onClick={() => setLogOpen(true)} aria-label="Log">
            <IconPlus size={26} />
          </button>
        </div>

        <button
          className={`tab-item${screen === 'matches' ? ' active' : ''}`}
          onClick={() => setScreen('matches')}
          aria-label="Matches"
        >
          <IconCalendar size={22} />
          <span>Matches</span>
        </button>
        <button
          className={`tab-item${screen === 'events' ? ' active' : ''}`}
          onClick={() => setScreen('events')}
          aria-label="Events"
        >
          <IconStar size={22} />
          <span>Events</span>
        </button>
      </div>

      {/* Log Sheet */}
      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}

// Handle /receipts/join/:code route
function handleJoinRoute() {
  const path = window.location.pathname;
  const match = path.match(/\/receipts\/join\/([A-Z2-9]{6})/i);
  if (match) return match[1].toUpperCase();
  return null;
}

export default function App() {
  const joinCode = handleJoinRoute();

  return (
    <AppProvider>
      <AppShellWithJoin joinCode={joinCode} />
    </AppProvider>
  );
}

function AppShellWithJoin({ joinCode }: { joinCode: string | null }) {
  const { state } = useApp();

  if (joinCode) {
    // Show join prompt
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
        <img src="/receipts/logo.svg" alt="Receipts" width={80} height={80} />
        <div style={{ fontWeight: 700, fontSize: 20 }}>Join league</div>
        <div style={{ color: 'var(--muted)', fontSize: 14 }}>
          Use code: <span className="num" style={{ color: 'var(--text)', fontWeight: 700, letterSpacing: '0.1em' }}>{joinCode}</span>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            const me = state.leagues.find((l) => l.members.some((m) => m.id === state.currentUserId))
              ?.members.find((m) => m.id === state.currentUserId);
            demoStore.joinLeagueByCode(
              joinCode,
              state.currentUserId,
              me?.display_name || 'Player',
              me?.avatar_color || '#2EE58A'
            );
            window.history.replaceState({}, '', '/receipts/');
            window.location.reload();
          }}
          style={{ width: 200 }}
        >
          Join
        </button>
      </div>
    );
  }

  return <AppShell />;
}

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
import { OnboardingScreen } from './screens/OnboardingScreen';
import { LeagueSwitcher } from './components/LeagueSwitcher';
import { Avatar } from './components/Avatar';

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

// --------------------------------------------------------------------------
// Error screen
// --------------------------------------------------------------------------
function StartupErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);

  function copyError() {
    navigator.clipboard.writeText(error).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
      gap: 16,
    }}>
      <img src="/receipts/logo.svg" alt="Receipts" width={64} height={64} />
      <div style={{ fontWeight: 700, fontSize: 20 }}>Something went wrong</div>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '12px 16px',
        fontSize: 13,
        color: 'var(--muted)',
        maxWidth: 340,
        width: '100%',
        wordBreak: 'break-word',
        fontFamily: 'var(--font-mono)',
      }}>
        {error}
      </div>
      <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 340 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onRetry}>
          Try again
        </button>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={copyError}>
          {copied ? 'Copied!' : 'Copy error details'}
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Loading screen
// --------------------------------------------------------------------------
function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 16,
    }}>
      <img src="/receipts/logo.svg" alt="Receipts" width={80} height={80} />
      <div style={{ fontWeight: 700, fontSize: 22 }}>Receipts</div>
      <div style={{ color: 'var(--muted)', fontSize: 14 }}>Proof of who's actually better.</div>
      <div className="spinner" />
    </div>
  );
}

// --------------------------------------------------------------------------
// Main app shell (only shown when startupStatus === 'ready' and there is a league)
// --------------------------------------------------------------------------
function AppShell() {
  const { currentLeague, currentMember, isDemo, state, viewingMemberId, clearProfile } = useApp();
  const [screen, setScreen] = useState<Screen>('rankings');
  const [logOpen, setLogOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // Should never happen when called from App - guard just in case
  if (!currentLeague || !currentMember) return <LoadingScreen />;

  const memberForAvatar = {
    display_name: currentMember.display_name,
    avatar_color: currentMember.avatar_color,
    avatar_url: currentMember.avatar_url,
  };

  const renderScreen = () => {
    if (viewingMemberId && viewingMemberId !== state.currentUserId) {
      return <ProfileScreen memberId={viewingMemberId} onBack={clearProfile} />;
    }
    switch (screen) {
      case 'rankings':  return <RankingsScreen />;
      case 'crewfolio': return <CrewfolioScreen />;
      case 'matches':   return <MatchesScreen />;
      case 'events':    return <EventsScreen />;
      case 'feed':      return <ActivityFeedScreen />;
      case 'profile':   return <ProfileScreen />;
      case 'settings':  return <LeagueSettingsScreen onClose={() => setScreen('rankings')} />;
      default:          return <RankingsScreen />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {isDemo && (
        <div className="demo-banner">
          Demo mode &bull; all data is local
        </div>
      )}

      {/* Top bar */}
      <div className="top-bar" style={{ flexShrink: 0 }}>
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

      {/* Main content */}
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
        <button className={`tab-item${screen === 'rankings' ? ' active' : ''}`} onClick={() => setScreen('rankings')} aria-label="Rankings">
          <IconTrophy size={22} /><span>Rankings</span>
        </button>
        <button className={`tab-item${screen === 'crewfolio' ? ' active' : ''}`} onClick={() => setScreen('crewfolio')} aria-label="Crewfolio">
          <IconBriefcase size={22} /><span>Crewfolio</span>
        </button>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <button className="tab-log-btn" onClick={() => setLogOpen(true)} aria-label="Log">
            <IconPlus size={26} />
          </button>
        </div>
        <button className={`tab-item${screen === 'matches' ? ' active' : ''}`} onClick={() => setScreen('matches')} aria-label="Matches">
          <IconCalendar size={22} /><span>Matches</span>
        </button>
        <button className={`tab-item${screen === 'events' ? ' active' : ''}`} onClick={() => setScreen('events')} aria-label="Events">
          <IconStar size={22} /><span>Events</span>
        </button>
      </div>

      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}

// --------------------------------------------------------------------------
// Join route handler (/receipts/join/:CODE)
// --------------------------------------------------------------------------
function handleJoinRoute(): string | null {
  const path = window.location.pathname;
  const m = path.match(/\/receipts\/join\/([A-Z2-9]{6})/i);
  return m ? m[1].toUpperCase() : null;
}

// --------------------------------------------------------------------------
// Root: dispatches to the right screen based on startupStatus
// --------------------------------------------------------------------------
function AppRoot() {
  const { startupStatus, startupError, isDemo, state } = useApp();
  const joinCode = handleJoinRoute();

  // "Try again" reloads the page
  function handleRetry() {
    window.location.reload();
  }

  if (startupStatus === 'loading') {
    return <LoadingScreen />;
  }

  if (startupStatus === 'error') {
    return <StartupErrorScreen error={startupError ?? 'Unknown error'} onRetry={handleRetry} />;
  }

  // /receipts/join/:CODE route - works in both demo and live mode
  if (joinCode) {
    return (
      <OnboardingScreen
        prefilledCode={joinCode}
        onComplete={() => {
          window.history.replaceState({}, '', '/receipts/');
          // No reload needed - AppContext transitions to 'ready' when leagues > 0
        }}
      />
    );
  }

  // Zero leagues: show welcome / onboarding
  if (startupStatus === 'welcome' || (isDemo && state.leagues.length === 0)) {
    return <OnboardingScreen onComplete={() => {/* context watches leagues.length */}} />;
  }

  // All good - show the main app
  return <AppShell />;
}

export default function App() {
  return (
    <AppProvider>
      <AppRoot />
    </AppProvider>
  );
}

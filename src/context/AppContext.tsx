import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { demoStore, type DemoState, type League, type LeagueMember, type MemberStats } from '../demo/store';

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

interface AppContextType {
  isDemo: boolean;
  isLive: boolean;
  state: DemoState;
  currentLeague: League | null;
  currentMember: LeagueMember | null;
  memberStats: MemberStats[];
  refresh: () => void;
  switchLeague: (id: string) => void;
  // Navigation helpers
  viewProfile: (memberId: string) => void;
  clearProfile: () => void;
  viewingMemberId: string | null;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Store a copy of the demo state so React sees reference changes and re-renders consumers
  const [state, setState] = useState<DemoState>(() => demoStore.getState());
  const [viewingMemberId, setViewingMemberId] = useState<string | null>(null);

  const refresh = useCallback(() => setState({ ...demoStore.getState() }), []);
  const viewProfile = useCallback((memberId: string) => setViewingMemberId(memberId), []);
  const clearProfile = useCallback(() => setViewingMemberId(null), []);

  useEffect(() => {
    if (IS_DEMO) {
      // Whenever the store mutates, snapshot it into React state
      const unsub = demoStore.subscribe(() => {
        setState({ ...demoStore.getState() });
      });
      return unsub;
    }
  }, []);

  // Fake friend activity in demo mode every 20s
  useEffect(() => {
    if (!IS_DEMO) return;
    const interval = setInterval(() => {
      const s = demoStore.getState();
      const league = s.leagues.find((l) => l.id === s.currentLeagueId);
      if (!league) return;
      const friends = league.members.filter((m) => m.id !== s.currentUserId);
      if (friends.length === 0) return;
      const friend = friends[Math.floor(Math.random() * friends.length)];

      const opponent = friends.find((f) => f.id !== friend.id);
      if (!opponent) return;

      demoStore.logMatch({
        league_id: s.currentLeagueId,
        game_id: 'fifa',
        player_a_id: friend.id,
        player_b_id: opponent.id,
        result: Math.random() > 0.5 ? 'win' : 'loss',
        status: 'pending',
        logged_by: friend.id,
      });
      setTimeout(() => {
        const ns = demoStore.getState();
        const pending = ns.matches.filter(
          (m) => m.league_id === s.currentLeagueId && m.status === 'pending' && m.logged_by === friend.id
        );
        if (pending.length > 0) {
          demoStore.confirmMatch(pending[pending.length - 1].id);
        }
      }, 3000);
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const currentLeague = state.leagues.find((l) => l.id === state.currentLeagueId) || null;
  const currentMember = currentLeague?.members.find((m) => m.id === state.currentUserId) || null;
  const memberStats = currentLeague ? demoStore.computeMemberStats(currentLeague.id) : [];

  const switchLeague = useCallback((id: string) => {
    demoStore.switchLeague(id);
    setViewingMemberId(null); // clear any open profile on league switch
  }, []);

  return (
    <AppContext.Provider
      value={{ isDemo: IS_DEMO, isLive: !IS_DEMO, state, currentLeague, currentMember, memberStats, refresh, switchLeague, viewProfile, clearProfile, viewingMemberId }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

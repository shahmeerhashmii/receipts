import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { demoStore, type DemoState, type League, type LeagueMember, type MemberStats } from '../demo/store';

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

// ---------------------------------------------------------------------------
// Storage isolation
// Remove all demo-mode localStorage entries when running in live mode so
// stale demo data never leaks into a real session. This runs synchronously
// at module evaluation time - before any component mounts.
// ---------------------------------------------------------------------------
const DEMO_KEY_PREFIXES = ['receipts:demo:', 'receipts_demo_'];

export function clearDemoStorage() {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && DEMO_KEY_PREFIXES.some((p) => key.startsWith(p))) {
      toRemove.push(key);
    }
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}

if (!IS_DEMO) {
  clearDemoStorage();
}

// ---------------------------------------------------------------------------
// Lazily import Supabase so it is never bundled in demo builds that tree-shake it
// (in practice Vite will include it, but it is never called when IS_DEMO is true)
// ---------------------------------------------------------------------------
async function getSupabase() {
  return import('../lib/supabase');
}

// Empty state used as the initial value in live mode - no demo data is ever read.
const EMPTY_STATE: DemoState = {
  initialized: false,
  leagues: [],
  matches: [],
  puzzleSubmissions: [],
  holdings: [],
  stockPriceHistory: [],
  events: [],
  scheduledMatches: [],
  picks: [],
  feedItems: [],
  badges: [],
  currentUserId: '',
  currentLeagueId: '',
};

export interface Actions {
  logMatch: (params: {
    leagueId: string; gameId: string; opponentId: string;
    result: 'win' | 'loss' | 'draw';
    scoreA?: number; scoreB?: number; starsA?: number; starsB?: number;
  }) => Promise<void>;
  confirmMatch: (matchId: string) => Promise<void>;
  disputeMatch: (matchId: string) => Promise<void>;
  voidMatch: (matchId: string) => Promise<void>;
  submitPuzzle: (params: {
    leagueId: string; gameId: string; puzzleNumber: number;
    puzzleDate: string; score: number; hardMode?: boolean;
    emojiGrid?: string; rawText?: string;
  }) => Promise<void>;
  buyStock: (leagueId: string, subjectId: string, shares: number) => Promise<void>;
  sellStock: (leagueId: string, subjectId: string, shares: number) => Promise<void>;
  scheduleMatch: (params: {
    leagueId: string; gameId: string; playerAId: string;
    playerBId: string; scheduledAt: string;
  }) => Promise<void>;
  makePick: (params: {
    scheduledMatchId: string; pickedPlayerId: string;
    stake: number; multiplier: number;
  }) => Promise<void>;
  proposeEvent: (params: {
    leagueId: string; subjectId: string;
    description: string; size: 'big_w' | 'small_w' | 'small_l' | 'big_l';
  }) => Promise<void>;
  voteEvent: (eventId: string, vote: 'for' | 'against') => Promise<void>;
  weeklyCheckin: (leagueId: string) => Promise<boolean>;
  claimBankruptcyRelief: (leagueId: string) => Promise<void>;
}

// Startup status used by App.tsx to decide which screen to render.
// 'loading'  - waiting for auth + initial data fetch (show spinner)
// 'error'    - startup failed (show error screen)
// 'welcome'  - auth ok, zero leagues (show welcome / onboarding)
// 'ready'    - auth ok, at least one league loaded (show app shell)
export type StartupStatus = 'loading' | 'error' | 'welcome' | 'ready';

// Structured startup error - never loses Supabase fields to String() coercion.
export interface StartupError {
  step: string;        // e.g. "auth", "leagues", "anon sign-in"
  target: string;      // function or table name, e.g. "league_members"
  message: string;
  code: string | null;
  details: string | null;
  hint: string | null;
}

/** Extract every useful field from any thrown value (Error, Supabase PostgRESTError, plain object). */
export function parseStartupError(step: string, target: string, err: unknown): StartupError {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    return {
      step,
      target,
      message: (e['message'] as string | undefined) || 'Unknown error',
      code:    (e['code']    as string | undefined) ?? null,
      details: (e['details'] as string | undefined) ?? null,
      hint:    (e['hint']    as string | undefined) ?? null,
    };
  }
  return { step, target, message: String(err), code: null, details: null, hint: null };
}

interface AppContextType {
  isDemo: boolean;
  isLive: boolean;
  startupStatus: StartupStatus;
  startupError: StartupError | null;
  state: DemoState;
  currentLeague: League | null;
  currentMember: LeagueMember | null;
  memberStats: MemberStats[];
  refresh: () => void;
  switchLeague: (id: string) => void;
  /** Live mode: called by OnboardingScreen after create/join to inject fresh league data. */
  setLiveLeagues: (leagues: League[], currentUserId: string, currentLeagueId: string) => void;
  actions: Actions;
  // Navigation helpers
  viewProfile: (memberId: string) => void;
  clearProfile: () => void;
  viewingMemberId: string | null;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // In live mode, start from a blank slate - never read demo localStorage data.
  const [state, setState] = useState<DemoState>(() => IS_DEMO ? demoStore.getState() : EMPTY_STATE);
  const [viewingMemberId, setViewingMemberId] = useState<string | null>(null);
  // Demo mode is always 'ready' immediately; live mode starts 'loading'.
  const [startupStatus, setStartupStatus] = useState<StartupStatus>(IS_DEMO ? 'ready' : 'loading');
  const [startupError, setStartupError] = useState<StartupError | null>(null);

  const refresh = useCallback(() => {
    if (IS_DEMO) setState({ ...demoStore.getState() });
    // In live mode, refresh is a no-op here; Supabase Realtime handles updates.
  }, []);
  const viewProfile = useCallback((memberId: string) => setViewingMemberId(memberId), []);
  const clearProfile = useCallback(() => setViewingMemberId(null), []);

  // Demo mode: subscribe to store changes
  useEffect(() => {
    if (IS_DEMO) {
      const unsub = demoStore.subscribe(() => {
        setState({ ...demoStore.getState() });
      });
      return unsub;
    }
  }, []);

  // Live mode: auth + data startup sequence
  useEffect(() => {
    if (IS_DEMO) return;

    const TIMEOUT_MS = 10_000;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function startup() {
      try {
        console.log('[Receipts] startup: begin');

        timeoutId = setTimeout(() => {
          if (!cancelled) {
            console.error('[Receipts] startup: timed out after 10s');
            setStartupError({
              step: 'startup', target: 'network',
              message: 'Startup timed out after 10 seconds. Check your connection and try again.',
              code: null, details: null, hint: null,
            });
            setStartupStatus('error');
          }
        }, TIMEOUT_MS);

        const { supabase } = await getSupabase();

        // Step 1: auth - get existing session
        console.log('[Receipts] startup: checking auth session');
        let currentStep = 'auth';
        let currentTarget = 'supabase.auth.getSession';
        let { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw parseStartupError(currentStep, currentTarget, sessionError);

        if (!session) {
          // Step 1b: no existing session - sign in anonymously
          console.log('[Receipts] startup: no session, signing in anonymously');
          currentStep = 'anon sign-in';
          currentTarget = 'supabase.auth.signInAnonymously';
          const { data, error: signInError } = await supabase.auth.signInAnonymously();
          if (signInError) throw parseStartupError(currentStep, currentTarget, signInError);
          session = data.session;
        }

        if (!session?.user) {
          throw parseStartupError('auth', 'supabase.auth', 'Auth succeeded but no user object returned.');
        }
        const userId = session.user.id;
        console.log('[Receipts] startup: authenticated as', userId);

        // Step 2: fetch leagues this user belongs to
        console.log('[Receipts] startup: fetching leagues');
        currentStep = 'leagues';
        currentTarget = 'league_members';
        const { data: memberRows, error: memberError } = await supabase
          .from('league_members')
          .select(`
            league_id, display_name, avatar_color, avatar_url, coins, is_admin, joined_at,
            leagues ( id, name, join_code, fifa_version, created_at,
              games ( id, name, type, is_custom ),
              league_members ( id, display_name, avatar_color, avatar_url, coins, is_admin, joined_at )
            )
          `)
          .eq('user_id', userId);
        if (memberError) throw parseStartupError(currentStep, currentTarget, memberError);

        if (cancelled) return;

        console.log('[Receipts] startup: fetched', memberRows?.length ?? 0, 'league memberships');

        if (!memberRows || memberRows.length === 0) {
          // New user with no leagues - show welcome screen
          console.log('[Receipts] startup: zero leagues, showing welcome screen');
          setState((s) => ({ ...s, currentUserId: userId, initialized: true }));
          if (timeoutId) clearTimeout(timeoutId);
          setStartupStatus('welcome');
          return;
        }

        // Build league objects from the nested query
        const leagues: League[] = memberRows
          .map((row: Record<string, unknown>) => {
            const lg = row.leagues as Record<string, unknown> | null;
            if (!lg) return null;
            return {
              id: lg.id as string,
              name: lg.name as string,
              join_code: lg.join_code as string,
              fifa_version: (lg.fifa_version as string | null) ?? undefined,
              created_at: lg.created_at as string,
              games: (lg.games as Array<{ id: string; name: string; type: '1v1' | 'puzzle' | 'ffa'; is_custom?: boolean }>) ?? [],
              members: (lg.league_members as Array<{
                id: string; display_name: string; avatar_color: string;
                avatar_url?: string; coins: number; is_admin: boolean; joined_at: string;
              }>) ?? [],
            } as League;
          })
          .filter(Boolean) as League[];

        // Deduplicate by league id (user may appear in query multiple times)
        const seen = new Set<string>();
        const uniqueLeagues = leagues.filter((l) => {
          if (seen.has(l.id)) return false;
          seen.add(l.id);
          return true;
        });

        const currentLeagueId = uniqueLeagues[0]?.id ?? '';
        console.log('[Receipts] startup: current league', currentLeagueId);

        setState((s) => ({
          ...s,
          leagues: uniqueLeagues,
          currentUserId: userId,
          currentLeagueId,
          initialized: true,
        }));

        if (timeoutId) clearTimeout(timeoutId);
        console.log('[Receipts] startup: ready');
        setStartupStatus('ready');

        // Realtime subscription is set up after status is 'ready'
        // (handled by a separate effect below)

      } catch (err) {
        if (cancelled) return;
        // err is already a StartupError if thrown by parseStartupError above,
        // otherwise wrap it now (covers plain Error throws and unexpected values).
        const structured: StartupError =
          (err && typeof err === 'object' && 'step' in err)
            ? (err as StartupError)
            : parseStartupError('startup', 'unknown', err);
        console.error('[Receipts] startup: failed -', structured.step, structured.target, structured.message);
        if (timeoutId) clearTimeout(timeoutId);
        setStartupError(structured);
        setStartupStatus('error');
      }
    }

    startup();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live mode: subscribe to Realtime for the current league AFTER startup is ready
  useEffect(() => {
    if (IS_DEMO || startupStatus !== 'ready') return;
    const currentLeagueId = state.currentLeagueId;
    if (!currentLeagueId) return;

    console.log('[Receipts] realtime: subscribing to league', currentLeagueId);

    let unsubscribe: (() => void) | null = null;
    getSupabase().then(({ subscribeToLeague }) => {
      unsubscribe = subscribeToLeague(currentLeagueId, () => {
        // On any change, refetch the league members (minimal refresh)
        getSupabase().then(({ supabase }) => {
          supabase
            .from('league_members')
            .select('id, display_name, avatar_color, avatar_url, coins, is_admin, joined_at')
            .eq('league_id', currentLeagueId)
            .then(({ data }) => {
              if (!data) return;
              setState((s) => ({
                ...s,
                leagues: s.leagues.map((l) =>
                  l.id === currentLeagueId ? { ...l, members: data as League['members'] } : l
                ),
              }));
            });
        });
      });
      console.log('[Receipts] realtime: subscribed');
    });

    return () => {
      console.log('[Receipts] realtime: unsubscribing from league', currentLeagueId);
      unsubscribe?.();
    };
  }, [startupStatus, state.currentLeagueId]);

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
  const memberStats = (IS_DEMO && currentLeague) ? demoStore.computeMemberStats(currentLeague.id) : [];

  const switchLeague = useCallback((id: string) => {
    if (IS_DEMO) {
      demoStore.switchLeague(id);
    } else {
      setState((s) => ({ ...s, currentLeagueId: id }));
    }
    setViewingMemberId(null);
  }, []);

  const setLiveLeagues = useCallback((
    leagues: League[],
    currentUserId: string,
    currentLeagueId: string,
  ) => {
    setState((s) => ({ ...s, leagues, currentUserId, currentLeagueId, initialized: true }));
  }, []);

  // Unified actions: demo mode uses demoStore; production calls Supabase RPCs
  const actions: Actions = {
    logMatch: async (params) => {
      if (IS_DEMO) {
        demoStore.logMatch({
          league_id: params.leagueId,
          game_id: params.gameId,
          player_a_id: demoStore.getCurrentUserId(),
          player_b_id: params.opponentId,
          result: params.result,
          score_a: params.scoreA,
          score_b: params.scoreB,
          stars_a: params.starsA,
          stars_b: params.starsB,
          status: 'pending',
          logged_by: demoStore.getCurrentUserId(),
        });
      } else {
        const { rpcLogMatch } = await getSupabase();
        await rpcLogMatch(params);
      }
    },

    confirmMatch: async (matchId) => {
      if (IS_DEMO) {
        demoStore.confirmMatch(matchId);
      } else {
        const { rpcConfirmMatch } = await getSupabase();
        await rpcConfirmMatch(matchId);
      }
    },

    disputeMatch: async (matchId) => {
      if (IS_DEMO) {
        demoStore.disputeMatch(matchId);
      } else {
        const { rpcDisputeMatch } = await getSupabase();
        await rpcDisputeMatch(matchId);
      }
    },

    voidMatch: async (matchId) => {
      if (IS_DEMO) {
        demoStore.voidMatch(matchId);
      } else {
        const { rpcVoidMatch } = await getSupabase();
        await rpcVoidMatch(matchId);
      }
    },

    submitPuzzle: async (params) => {
      if (IS_DEMO) {
        const today = new Date().toISOString().split('T')[0];
        demoStore.submitPuzzle({
          league_id: params.leagueId,
          member_id: demoStore.getCurrentUserId(),
          game_id: params.gameId,
          puzzle_number: params.puzzleNumber,
          puzzle_date: params.puzzleDate || today,
          score: params.score,
          hard_mode: params.hardMode,
          emoji_grid: params.emojiGrid,
          raw_text: params.rawText || '',
        });
      } else {
        const { rpcSubmitPuzzle } = await getSupabase();
        await rpcSubmitPuzzle(params);
      }
    },

    buyStock: async (leagueId, subjectId, shares) => {
      if (IS_DEMO) {
        const s = demoStore.getState();
        const league = s.leagues.find((l) => l.id === leagueId);
        const stats = demoStore.computeMemberStats(leagueId).find((st) => st.memberId === subjectId);
        const price = stats?.stockPrice || 40;
        demoStore.buyStock(leagueId, s.currentUserId, subjectId, shares, price);
      } else {
        const { rpcBuyStock } = await getSupabase();
        await rpcBuyStock(leagueId, subjectId, shares);
      }
    },

    sellStock: async (leagueId, subjectId, shares) => {
      if (IS_DEMO) {
        const s = demoStore.getState();
        const stats = demoStore.computeMemberStats(leagueId).find((st) => st.memberId === subjectId);
        const price = stats?.stockPrice || 40;
        demoStore.sellStock(leagueId, s.currentUserId, subjectId, shares, price);
      } else {
        const { rpcSellStock } = await getSupabase();
        await rpcSellStock(leagueId, subjectId, shares);
      }
    },

    scheduleMatch: async (params) => {
      if (IS_DEMO) {
        demoStore.scheduledMatch({
          league_id: params.leagueId,
          game_id: params.gameId,
          player_a_id: params.playerAId,
          player_b_id: params.playerBId,
          scheduled_at: params.scheduledAt,
        });
      } else {
        const { rpcScheduleMatch } = await getSupabase();
        await rpcScheduleMatch(params);
      }
    },

    makePick: async (params) => {
      if (IS_DEMO) {
        demoStore.makePick({
          league_id: demoStore.getCurrentLeagueId(),
          scheduled_match_id: params.scheduledMatchId,
          picker_id: demoStore.getCurrentUserId(),
          picked_player_id: params.pickedPlayerId,
          stake: params.stake,
          multiplier: params.multiplier,
        });
      } else {
        const { rpcMakePick } = await getSupabase();
        await rpcMakePick(params);
      }
    },

    proposeEvent: async (params) => {
      if (IS_DEMO) {
        demoStore.proposeEvent({
          league_id: params.leagueId,
          proposer_id: demoStore.getCurrentUserId(),
          subject_id: params.subjectId,
          description: params.description,
          size: params.size,
        });
      } else {
        const { rpcProposeEvent } = await getSupabase();
        await rpcProposeEvent(params);
      }
    },

    voteEvent: async (eventId, vote) => {
      if (IS_DEMO) {
        const s = demoStore.getState();
        const league = s.leagues.find((l) => l.id === s.currentLeagueId);
        demoStore.voteEvent(eventId, s.currentUserId, vote, league?.members.length || 6);
      } else {
        const { rpcVoteEvent } = await getSupabase();
        await rpcVoteEvent(eventId, vote);
      }
    },

    weeklyCheckin: async (leagueId) => {
      if (IS_DEMO) {
        // Demo: always grant for simplicity
        return false;
      } else {
        const { rpcWeeklyCheckin } = await getSupabase();
        return rpcWeeklyCheckin(leagueId);
      }
    },

    claimBankruptcyRelief: async (leagueId) => {
      if (IS_DEMO) {
        // Demo: direct coin grant
        demoStore.setState((s) => ({
          ...s,
          leagues: s.leagues.map((l) => {
            if (l.id !== leagueId) return l;
            return {
              ...l,
              members: l.members.map((m) =>
                m.id === s.currentUserId ? { ...m, coins: m.coins + 100 } : m
              ),
            };
          }),
        }));
      } else {
        const { rpcClaimBankruptcyRelief } = await getSupabase();
        await rpcClaimBankruptcyRelief(leagueId);
      }
    },
  };

  // When a new league is added (after create/join in live mode), re-derive status
  useEffect(() => {
    if (IS_DEMO) return;
    if (startupStatus === 'welcome' && state.leagues.length > 0) {
      console.log('[Receipts] first league added, transitioning to ready');
      setStartupStatus('ready');
    }
  }, [state.leagues.length, startupStatus]);

  return (
    <AppContext.Provider
      value={{
        isDemo: IS_DEMO, isLive: !IS_DEMO,
        startupStatus, startupError,
        state, currentLeague, currentMember, memberStats,
        refresh, switchLeague, setLiveLeagues, actions,
        viewProfile, clearProfile, viewingMemberId,
      }}
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

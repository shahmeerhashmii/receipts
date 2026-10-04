// Demo mode store - localStorage-backed state management
import { createDemoLeagues, seedMatchHistory, GAMES } from './seed';

export { AVATAR_COLORS } from './seed';
import {
  recalculateRatings,
  stockPrice,
  overallRating,
  eventMultiplier,
  generateJoinCode,
} from '../rules';
import type { ActiveEffect } from '../rules/events';

// Namespaced key - clearly separate from any future live-mode keys.
// Old key kept for one-time migration so existing demo sessions survive an upgrade.
const STORAGE_KEY = 'receipts:demo:v1';
const LEGACY_STORAGE_KEY = 'receipts_demo_v1';

export interface DemoState {
  initialized: boolean;
  leagues: League[];
  matches: Match[];
  puzzleSubmissions: PuzzleSubmission[];
  holdings: Holding[];
  stockPriceHistory: StockPricePoint[];
  events: Event[];
  scheduledMatches: ScheduledMatch[];
  picks: Pick[];
  feedItems: FeedItem[];
  badges: Badge[];
  currentUserId: string;
  currentLeagueId: string;
}

export interface League {
  id: string;
  name: string;
  join_code: string;
  members: LeagueMember[];
  games: GameDef[];
  fifa_version?: string;
  created_at: string;
}

export interface LeagueMember {
  id: string;
  display_name: string;
  avatar_color: string;
  avatar_url?: string;
  coins: number;
  is_admin: boolean;
  joined_at: string;
}

export interface GameDef {
  id: string;
  name: string;
  type: '1v1' | 'puzzle' | 'ffa';
  is_custom?: boolean;
}

export interface Match {
  id: string;
  league_id: string;
  game_id: string;
  player_a_id: string;
  player_b_id: string;
  result: 'win' | 'loss' | 'draw';
  score_a?: number;
  score_b?: number;
  stars_a?: number;
  stars_b?: number;
  fifa_version?: string;
  status: 'pending' | 'confirmed' | 'disputed' | 'voided';
  logged_by: string;
  logged_at: string;
  confirmed_at?: string;
  reactions?: Record<string, string[]>;
}

export interface PuzzleSubmission {
  id: string;
  league_id: string;
  member_id: string;
  game_id: string;
  puzzle_number: number;
  puzzle_date: string;
  score: number;
  hard_mode?: boolean;
  emoji_grid?: string;
  raw_text: string;
  submitted_at: string;
}

export interface Holding {
  id: string;
  league_id: string;
  holder_id: string;
  subject_id: string;
  shares: number;
  first_bought_at: string;
  last_bought_at?: string;
}

export interface StockPricePoint {
  league_id: string;
  member_id: string;
  price: number;
  recorded_at: string;
}

export interface Event {
  id: string;
  league_id: string;
  proposer_id: string;
  subject_id: string;
  description: string;
  size: 'big_w' | 'small_w' | 'small_l' | 'big_l';
  votes_for: string[];
  votes_against: string[];
  status: 'open' | 'passed' | 'failed';
  created_at: string;
  resolved_at?: string;
}

export interface ScheduledMatch {
  id: string;
  league_id: string;
  game_id: string;
  player_a_id: string;
  player_b_id: string;
  scheduled_at: string;
  status: 'open' | 'settled' | 'refunded';
  match_id?: string;
}

export interface Pick {
  id: string;
  league_id: string;
  scheduled_match_id: string;
  picker_id: string;
  picked_player_id: string;
  stake: number;
  multiplier: number;
  payout?: number;
  status: 'open' | 'won' | 'lost' | 'refunded';
  created_at: string;
}

export interface FeedItem {
  id: string;
  league_id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
  reactions: Record<string, string[]>;
}

export interface Badge {
  id: string;
  member_id: string;
  league_id: string;
  achievement_id: string;
  earned_at: string;
}

// Computed member stats
export interface MemberStats {
  memberId: string;
  leagueId: string;
  gameRatings: Record<string, { rating: number; matchCount: number; lastPlayedAt: string }>;
  overallRating: number;
  stockPrice: number;
  eventMultiplier: number;
  netWorth: number;
}

function loadState(): DemoState | null {
  try {
    // Migrate from the old key once, then remove it.
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      localStorage.setItem(STORAGE_KEY, legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state: DemoState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let _listeners: Array<() => void> = [];
let _state: DemoState | null = null;

function getState(): DemoState {
  if (!_state) {
    _state = loadState();
    if (!_state || !_state.initialized) {
      _state = initializeDemo();
    }
  }
  return _state;
}

function setState(updater: (s: DemoState) => DemoState) {
  _state = updater(getState());
  saveState(_state);
  _listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}

function initializeDemo(): DemoState {
  const leagues = createDemoLeagues();
  const allMatches: Match[] = [];
  const allFeeds: FeedItem[] = [];

  for (const league of leagues) {
    const rawMatches = seedMatchHistory(league.id, league.members);
    for (const rm of rawMatches) {
      // SeedMatch is compatible with Match (status 'confirmed' is a subset)
      allMatches.push(rm as unknown as Match);
      allFeeds.push({
        id: `feed-${rm.id}`,
        league_id: league.id,
        type: 'match_confirmed',
        payload: { match_id: rm.id, player_a_id: rm.player_a_id, player_b_id: rm.player_b_id, game_id: rm.game_id, result: rm.result },
        created_at: rm.confirmed_at || rm.logged_at,
        reactions: {},
      });
    }
  }

  // Seed some events
  const eventSeeds: Event[] = [
    {
      id: 'evt-1',
      league_id: 'demo-league-1',
      proposer_id: 'demo-ahmed',
      subject_id: 'demo-bilal',
      description: 'Got a new gaming setup',
      size: 'big_w',
      votes_for: ['demo-ahmed', 'demo-sara', 'demo-maya'],
      votes_against: [],
      status: 'passed',
      created_at: daysAgo(5),
      resolved_at: daysAgo(4),
    },
    {
      id: 'evt-2',
      league_id: 'demo-league-1',
      proposer_id: 'demo-sara',
      subject_id: 'demo-zain',
      description: 'Played FIFA on phone wifi',
      size: 'small_l',
      votes_for: ['demo-sara'],
      votes_against: [],
      status: 'open',
      created_at: daysAgo(0.5),
    },
  ];

  // Seed scheduled matches
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const scheduledMatches: ScheduledMatch[] = [
    {
      id: 'sched-1',
      league_id: 'demo-league-1',
      game_id: 'fifa',
      player_a_id: 'demo-user',
      player_b_id: 'demo-ahmed',
      scheduled_at: tomorrow.toISOString(),
      status: 'open',
    },
  ];

  // Seed some picks
  const picks: Pick[] = [
    {
      id: 'pick-1',
      league_id: 'demo-league-1',
      scheduled_match_id: 'sched-1',
      picker_id: 'demo-bilal',
      picked_player_id: 'demo-ahmed',
      stake: 20,
      multiplier: 1.9,
      status: 'open',
      created_at: daysAgo(0.1),
    },
  ];

  // Seed holdings
  const holdings: Holding[] = [
    { id: 'h1', league_id: 'demo-league-1', holder_id: 'demo-user', subject_id: 'demo-ahmed', shares: 5, first_bought_at: daysAgo(20) },
    { id: 'h2', league_id: 'demo-league-1', holder_id: 'demo-user', subject_id: 'demo-bilal', shares: 3, first_bought_at: daysAgo(10) },
    { id: 'h3', league_id: 'demo-league-1', holder_id: 'demo-ahmed', subject_id: 'demo-user', shares: 4, first_bought_at: daysAgo(15) },
  ];

  // Seed badges
  const badges: Badge[] = [
    { id: 'b1', member_id: 'demo-user', league_id: 'demo-league-1', achievement_id: 'first_blood', earned_at: daysAgo(59) },
    { id: 'b2', member_id: 'demo-ahmed', league_id: 'demo-league-1', achievement_id: 'first_blood', earned_at: daysAgo(58) },
    { id: 'b3', member_id: 'demo-user', league_id: 'demo-league-1', achievement_id: 'hot_streak', earned_at: daysAgo(30) },
  ];

  // Convert leagues to full League objects
  const fullLeagues: League[] = leagues.map((l) => ({
    id: l.id,
    name: l.name,
    join_code: l.join_code,
    fifa_version: 'FC 27',
    created_at: l.created_at,
    games: [
      { id: 'fifa', name: 'FIFA / EA FC', type: '1v1' },
      { id: 'gp_8ball', name: 'GamePigeon 8 Ball', type: '1v1' },
      { id: 'gp_cup_pong', name: 'GamePigeon Cup Pong', type: '1v1' },
      { id: 'gp_word_hunt', name: 'GamePigeon Word Hunt', type: '1v1' },
      { id: 'wordle', name: 'Wordle', type: 'puzzle' },
      { id: 'connections', name: 'Connections', type: 'puzzle' },
      { id: 'krillion', name: 'Krillion', type: 'puzzle' },
      { id: 'ballpark', name: 'Ballpark', type: 'puzzle' },
    ],
    members: l.members.map((m) => ({
      ...m,
      joined_at: l.created_at,
    })),
  }));

  const state: DemoState = {
    initialized: true,
    leagues: fullLeagues,
    matches: allMatches,
    puzzleSubmissions: [],
    holdings,
    stockPriceHistory: [],
    events: eventSeeds,
    scheduledMatches,
    picks,
    feedItems: allFeeds,
    badges,
    currentUserId: 'demo-user',
    currentLeagueId: 'demo-league-1',
  };

  return state;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setTime(d.getTime() - n * 86400000);
  return d.toISOString();
}

// Computed stats per member
export function computeMemberStats(leagueId: string): MemberStats[] {
  const state = getState();
  const league = state.leagues.find((l) => l.id === leagueId);
  if (!league) return [];

  const leagueMatches = state.matches.filter((m) => m.league_id === leagueId);
  const allRatings = recalculateRatings(leagueMatches);

  const now = new Date().toISOString();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();

  return league.members.map((member) => {
    const memberRatings = allRatings.get(member.id) || new Map();
    const gameRatings: Record<string, { rating: number; matchCount: number; lastPlayedAt: string }> = {};
    memberRatings.forEach((val, gameId) => {
      gameRatings[gameId] = val;
    });

    // Count recent matches (60 days) per game
    const recentCounts: Record<string, number> = {};
    const allTimeCounts: Record<string, number> = {};
    for (const m of leagueMatches) {
      if (m.status !== 'confirmed') continue;
      if (m.player_a_id !== member.id && m.player_b_id !== member.id) continue;
      allTimeCounts[m.game_id] = (allTimeCounts[m.game_id] || 0) + 1;
      if (m.confirmed_at && m.confirmed_at > sixtyDaysAgo) {
        recentCounts[m.game_id] = (recentCounts[m.game_id] || 0) + 1;
      }
    }

    const gameEntries = Object.entries(gameRatings).map(([gameId, gr]) => ({
      gameId,
      rating: gr.rating,
      recentMatchCount: recentCounts[gameId] || 0,
      allTimeMatchCount: allTimeCounts[gameId] || 0,
    }));

    const overall = overallRating(gameEntries);

    // Event multiplier
    const passedEvents = state.events.filter(
      (e) => e.league_id === leagueId && e.subject_id === member.id && e.status === 'passed'
    );
    const activeEffects: ActiveEffect[] = passedEvents.map((e) => ({
      size: e.size,
      resolvedAt: e.resolved_at || e.created_at,
    }));
    const evMult = eventMultiplier(activeEffects, now);

    const price = stockPrice(overall, evMult);

    // Holdings value
    const myHoldings = state.holdings.filter(
      (h) => h.league_id === leagueId && h.holder_id === member.id
    );
    const holdingsValue = myHoldings.reduce((sum, h) => {
      const subjectStats = allRatings.get(h.subject_id);
      const subjectOverall = subjectStats
        ? overallRating(
            Array.from(subjectStats.entries()).map(([gid, gr]) => ({
              gameId: gid,
              rating: gr.rating,
              recentMatchCount: 0,
              allTimeMatchCount: gr.matchCount,
            }))
          )
        : 1000;
      return sum + h.shares * stockPrice(subjectOverall);
    }, 0);

    return {
      memberId: member.id,
      leagueId,
      gameRatings,
      overallRating: overall,
      stockPrice: price,
      eventMultiplier: evMult,
      netWorth: member.coins + holdingsValue,
    };
  });
}

// Public API
export const demoStore = {
  getState,
  setState,
  subscribe,
  computeMemberStats,

  getCurrentUserId: () => getState().currentUserId,
  getCurrentLeagueId: () => getState().currentLeagueId,

  getLeagues: () => getState().leagues,
  getCurrentLeague: () => {
    const s = getState();
    return s.leagues.find((l) => l.id === s.currentLeagueId) || null;
  },

  switchLeague: (leagueId: string) => {
    setState((s) => ({ ...s, currentLeagueId: leagueId }));
  },

  getLeagueMatches: (leagueId: string) =>
    getState().matches.filter((m) => m.league_id === leagueId),

  getLeagueEvents: (leagueId: string) =>
    getState().events.filter((e) => e.league_id === leagueId),

  getLeagueFeed: (leagueId: string) =>
    getState()
      .feedItems.filter((f) => f.league_id === leagueId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),

  getLeagueScheduledMatches: (leagueId: string) =>
    getState().scheduledMatches.filter((s) => s.league_id === leagueId),

  getLeaguePicks: (leagueId: string) =>
    getState().picks.filter((p) => p.league_id === leagueId),

  getLeagueHoldings: (leagueId: string) =>
    getState().holdings.filter((h) => h.league_id === leagueId),

  getMemberBadges: (memberId: string, leagueId: string) =>
    getState().badges.filter((b) => b.member_id === memberId && b.league_id === leagueId),

  logMatch: (match: Omit<Match, 'id' | 'logged_at' | 'reactions'>) => {
    const id = `match-${Date.now()}`;
    const newMatch: Match = {
      ...match,
      id,
      logged_at: new Date().toISOString(),
      reactions: {},
    };
    setState((s) => {
      const matches = [...s.matches, newMatch];
      const feed: FeedItem = {
        id: `feed-${id}`,
        league_id: match.league_id,
        type: 'match_logged',
        payload: { match_id: id, player_a_id: match.player_a_id, player_b_id: match.player_b_id, game_id: match.game_id },
        created_at: new Date().toISOString(),
        reactions: {},
      };
      return { ...s, matches, feedItems: [...s.feedItems, feed] };
    });
    return newMatch;
  },

  confirmMatch: (matchId: string) => {
    setState((s) => ({
      ...s,
      matches: s.matches.map((m) =>
        m.id === matchId
          ? { ...m, status: 'confirmed', confirmed_at: new Date().toISOString() }
          : m
      ),
    }));
  },

  disputeMatch: (matchId: string) => {
    setState((s) => ({
      ...s,
      matches: s.matches.map((m) =>
        m.id === matchId ? { ...m, status: 'disputed' } : m
      ),
    }));
  },

  voidMatch: (matchId: string) => {
    setState((s) => ({
      ...s,
      matches: s.matches.map((m) =>
        m.id === matchId ? { ...m, status: 'voided' } : m
      ),
    }));
  },

  addReaction: (itemId: string, itemType: 'match' | 'feed', emoji: string, userId: string, _leagueId: string) => {
    setState((s) => {
      function toggleReaction(reactions: Record<string, string[]>) {
        const existing = reactions[emoji] || [];
        const next = existing.includes(userId)
          ? existing.filter((id) => id !== userId)
          : [...existing, userId];
        return { ...reactions, [emoji]: next };
      }

      if (itemType === 'feed') {
        return {
          ...s,
          feedItems: s.feedItems.map((f) => {
            if (f.id !== itemId) return f;
            return { ...f, reactions: toggleReaction(f.reactions) };
          }),
        };
      }
      if (itemType === 'match') {
        return {
          ...s,
          matches: s.matches.map((m) => {
            if (m.id !== itemId) return m;
            return { ...m, reactions: toggleReaction(m.reactions || {}) };
          }),
        };
      }
      return s;
    });
  },

  proposeEvent: (event: Omit<Event, 'id' | 'created_at' | 'votes_for' | 'votes_against' | 'status'>) => {
    const id = `evt-${Date.now()}`;
    const newEvent: Event = {
      ...event,
      id,
      created_at: new Date().toISOString(),
      votes_for: [],
      votes_against: [],
      status: 'open',
    };
    setState((s) => ({ ...s, events: [...s.events, newEvent] }));
    return newEvent;
  },

  voteEvent: (eventId: string, userId: string, vote: 'for' | 'against', totalMembers: number) => {
    setState((s) => {
      const events = s.events.map((e) => {
        if (e.id !== eventId) return e;
        const votes_for = vote === 'for'
          ? [...e.votes_for.filter((v) => v !== userId), userId]
          : e.votes_for.filter((v) => v !== userId);
        const votes_against = vote === 'against'
          ? [...e.votes_against.filter((v) => v !== userId), userId]
          : e.votes_against.filter((v) => v !== userId);

        const needed = Math.ceil((totalMembers - 1) / 2);
        const status = votes_for.length >= needed ? 'passed' : e.status;
        return {
          ...e, votes_for, votes_against, status,
          resolved_at: status === 'passed' ? new Date().toISOString() : e.resolved_at,
        };
      });
      return { ...s, events };
    });
  },

  buyStock: (leagueId: string, buyerId: string, subjectId: string, shares: number, price: number) => {
    const cost = shares * price;
    setState((s) => {
      const members = s.leagues.map((l) => {
        if (l.id !== leagueId) return l;
        return {
          ...l,
          members: l.members.map((m) =>
            m.id === buyerId ? { ...m, coins: Math.max(0, m.coins - cost) } : m
          ),
        };
      });
      const existingHolding = s.holdings.find(
        (h) => h.league_id === leagueId && h.holder_id === buyerId && h.subject_id === subjectId
      );
      const holdings = existingHolding
        ? s.holdings.map((h) =>
            h.id === existingHolding.id
              ? { ...h, shares: h.shares + shares, last_bought_at: new Date().toISOString() }
              : h
          )
        : [
            ...s.holdings,
            {
              id: `h-${Date.now()}`,
              league_id: leagueId,
              holder_id: buyerId,
              subject_id: subjectId,
              shares,
              first_bought_at: new Date().toISOString(),
            },
          ];
      return { ...s, leagues: members, holdings };
    });
  },

  sellStock: (leagueId: string, sellerId: string, subjectId: string, shares: number, price: number) => {
    const gross = shares * price;
    const fee = Math.ceil(gross * 0.05);
    const proceeds = gross - fee;
    setState((s) => {
      const leagues = s.leagues.map((l) => {
        if (l.id !== leagueId) return l;
        return {
          ...l,
          members: l.members.map((m) =>
            m.id === sellerId ? { ...m, coins: m.coins + proceeds } : m
          ),
        };
      });
      const holdings = s.holdings
        .map((h) => {
          if (h.league_id !== leagueId || h.holder_id !== sellerId || h.subject_id !== subjectId) return h;
          return { ...h, shares: h.shares - shares };
        })
        .filter((h) => h.shares > 0);
      return { ...s, leagues, holdings };
    });
  },

  joinLeagueByCode: (code: string, userId: string, displayName: string, avatarColor: string): League | null => {
    const s = getState();
    const league = s.leagues.find((l) => l.join_code === code.toUpperCase());
    if (!league) return null;

    const alreadyMember = league.members.some((m) => m.id === userId);
    if (alreadyMember) {
      setState((prev) => ({ ...prev, currentLeagueId: league.id }));
      return league;
    }

    const newMember: LeagueMember = {
      id: userId,
      display_name: displayName,
      avatar_color: avatarColor,
      coins: 400,
      is_admin: false,
      joined_at: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      currentLeagueId: league.id,
      leagues: prev.leagues.map((l) =>
        l.id === league.id ? { ...l, members: [...l.members, newMember] } : l
      ),
    }));

    return getState().leagues.find((l) => l.id === league.id) || null;
  },

  createLeague: (name: string, userId: string, displayName: string, avatarColor: string): League => {
    const code = generateJoinCode();
    const id = `league-${Date.now()}`;
    const member: LeagueMember = {
      id: userId,
      display_name: displayName,
      avatar_color: avatarColor,
      coins: 400,
      is_admin: true,
      joined_at: new Date().toISOString(),
    };
    const league: League = {
      id,
      name,
      join_code: code,
      fifa_version: 'FC 27',
      created_at: new Date().toISOString(),
      games: [
        { id: 'fifa', name: 'FIFA / EA FC', type: '1v1' },
        { id: 'gp_8ball', name: 'GamePigeon 8 Ball', type: '1v1' },
        { id: 'gp_cup_pong', name: 'GamePigeon Cup Pong', type: '1v1' },
        { id: 'gp_word_hunt', name: 'GamePigeon Word Hunt', type: '1v1' },
        { id: 'wordle', name: 'Wordle', type: 'puzzle' },
        { id: 'connections', name: 'Connections', type: 'puzzle' },
        { id: 'krillion', name: 'Krillion', type: 'puzzle' },
        { id: 'ballpark', name: 'Ballpark', type: 'puzzle' },
      ],
      members: [member],
    };
    setState((s) => ({
      ...s,
      leagues: [...s.leagues, league],
      currentLeagueId: id,
    }));
    return league;
  },

  scheduledMatch: (match: Omit<ScheduledMatch, 'id' | 'status'>) => {
    const id = `sched-${Date.now()}`;
    const newMatch: ScheduledMatch = { ...match, id, status: 'open' };
    setState((s) => ({ ...s, scheduledMatches: [...s.scheduledMatches, newMatch] }));
    return newMatch;
  },

  makePick: (pick: Omit<Pick, 'id' | 'created_at' | 'status'>) => {
    const id = `pick-${Date.now()}`;
    const newPick: Pick = { ...pick, id, created_at: new Date().toISOString(), status: 'open' };
    // Deduct stake
    setState((s) => {
      const leagues = s.leagues.map((l) => {
        if (l.id !== pick.league_id) return l;
        return {
          ...l,
          members: l.members.map((m) =>
            m.id === pick.picker_id ? { ...m, coins: Math.max(0, m.coins - pick.stake) } : m
          ),
        };
      });
      return { ...s, leagues, picks: [...s.picks, newPick] };
    });
    return newPick;
  },

  submitPuzzle: (sub: Omit<PuzzleSubmission, 'id' | 'submitted_at'>) => {
    const id = `puzzle-${Date.now()}`;
    const newSub: PuzzleSubmission = { ...sub, id, submitted_at: new Date().toISOString() };
    setState((s) => ({
      ...s,
      puzzleSubmissions: [...s.puzzleSubmissions, newSub],
      feedItems: [
        ...s.feedItems,
        {
          id: `feed-${id}`,
          league_id: sub.league_id,
          type: 'puzzle_submitted',
          payload: { submission_id: id, game_id: sub.game_id, score: sub.score, member_id: sub.member_id },
          created_at: new Date().toISOString(),
          reactions: {},
        },
      ],
    }));
    return newSub;
  },

  leaveLeague: (leagueId: string, userId: string) => {
    setState((s) => {
      const leagues = s.leagues
        .map((l) => l.id !== leagueId ? l : { ...l, members: l.members.filter((m) => m.id !== userId) })
        .filter((l) => l.members.length > 0); // remove empty leagues
      const currentLeagueId = leagues.find((l) => l.id === s.currentLeagueId)
        ? s.currentLeagueId
        : (leagues[0]?.id ?? '');
      return { ...s, leagues, currentLeagueId };
    });
  },

  removeMember: (leagueId: string, memberId: string) => {
    setState((s) => ({
      ...s,
      leagues: s.leagues.map((l) =>
        l.id !== leagueId ? l : { ...l, members: l.members.filter((m) => m.id !== memberId) }
      ),
    }));
  },

  renameLeague: (leagueId: string, name: string) => {
    setState((s) => ({
      ...s,
      leagues: s.leagues.map((l) => l.id !== leagueId ? l : { ...l, name }),
    }));
  },

  regenerateCode: (leagueId: string) => {
    const newCode = generateJoinCode();
    setState((s) => ({
      ...s,
      leagues: s.leagues.map((l) => l.id !== leagueId ? l : { ...l, join_code: newCode }),
    }));
    return newCode;
  },

  setFifaVersion: (leagueId: string, version: string) => {
    setState((s) => ({
      ...s,
      leagues: s.leagues.map((l) => l.id !== leagueId ? l : { ...l, fifa_version: version }),
    }));
  },

  updateProfile: (leagueId: string, userId: string, fields: { display_name?: string; avatar_color?: string; avatar_url?: string }) => {
    setState((s) => ({
      ...s,
      leagues: s.leagues.map((l) =>
        l.id !== leagueId ? l : {
          ...l,
          members: l.members.map((m) =>
            m.id !== userId ? m : {
              ...m,
              display_name: fields.display_name ?? m.display_name,
              avatar_color: fields.avatar_color ?? m.avatar_color,
              avatar_url:   fields.avatar_url   ?? m.avatar_url,
            }
          ),
        }
      ),
    }));
  },

  reset: () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    _state = null;
    getState(); // reinitialize
  },
};

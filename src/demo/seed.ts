// Demo mode data types and seeding
// Note: generateJoinCode, stockPrice, overallRating, eventMultiplier are used in store.ts

export const AVATAR_COLORS: string[] = [
  '#FF5C5C', '#FF9F43', '#F2C14E', '#2EE58A',
  '#5CC8FF', '#7C9CFF', '#B48CFF', '#FF7EDB',
];

export interface DemoMember {
  id: string;
  display_name: string;
  avatar_color: string;
  coins: number;
  is_admin: boolean;
}

export interface DemoLeague {
  id: string;
  name: string;
  join_code: string;
  members: DemoMember[];
  created_at: string;
}

// Two demo leagues
export function createDemoLeagues(): DemoLeague[] {
  const league1: DemoLeague = {
    id: 'demo-league-1',
    name: 'The Receipts',
    join_code: 'K7QX2M',
    created_at: '2024-10-01T00:00:00Z',
    members: [
      { id: 'demo-user', display_name: 'You', avatar_color: '#2EE58A', coins: 400, is_admin: true },
      { id: 'demo-ahmed', display_name: 'Ahmed', avatar_color: '#FF5C5C', coins: 380, is_admin: false },
      { id: 'demo-bilal', display_name: 'Bilal', avatar_color: '#5CC8FF', coins: 420, is_admin: false },
      { id: 'demo-sara', display_name: 'Sara', avatar_color: '#F2C14E', coins: 360, is_admin: false },
      { id: 'demo-maya', display_name: 'Maya', avatar_color: '#B48CFF', coins: 450, is_admin: false },
      { id: 'demo-zain', display_name: 'Zain', avatar_color: '#FF9F43', coins: 340, is_admin: false },
    ],
  };
  const league2: DemoLeague = {
    id: 'demo-league-2',
    name: 'Clippers',
    join_code: 'R4TW9B',
    created_at: '2024-10-15T00:00:00Z',
    members: [
      { id: 'demo-user', display_name: 'You', avatar_color: '#2EE58A', coins: 400, is_admin: false },
      { id: 'demo-omar', display_name: 'Omar', avatar_color: '#FF5C5C', coins: 390, is_admin: true },
      { id: 'demo-lena', display_name: 'Lena', avatar_color: '#7C9CFF', coins: 410, is_admin: false },
      { id: 'demo-kai', display_name: 'Kai', avatar_color: '#2EE58A', coins: 370, is_admin: false },
      { id: 'demo-rin', display_name: 'Rin', avatar_color: '#FF7EDB', coins: 430, is_admin: false },
      { id: 'demo-max', display_name: 'Max', avatar_color: '#FF9F43', coins: 350, is_admin: false },
    ],
  };
  return [league1, league2];
}

const GAMES = [
  { id: 'fifa', name: 'FIFA / EA FC', type: '1v1' },
  { id: 'gp_8ball', name: 'GamePigeon 8 Ball', type: '1v1' },
  { id: 'gp_cup_pong', name: 'GamePigeon Cup Pong', type: '1v1' },
  { id: 'gp_word_hunt', name: 'GamePigeon Word Hunt', type: '1v1' },
  { id: 'wordle', name: 'Wordle', type: 'puzzle' },
  { id: 'connections', name: 'Connections', type: 'puzzle' },
  { id: 'krillion', name: 'Krillion', type: 'puzzle' },
  { id: 'ballpark', name: 'Ballpark', type: 'puzzle' },
];

function randomBetween(a: number, b: number) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export interface SeedMatch {
  id: string;
  league_id: string;
  game_id: string;
  player_a_id: string;
  player_b_id: string;
  result: 'win' | 'loss' | 'draw';
  score_a?: number;
  score_b?: number;
  status: 'confirmed';
  logged_by: string;
  logged_at: string;
  confirmed_at: string;
  reactions: Record<string, string[]>;
}

/** Generate 60 days of seeded match history */
export function seedMatchHistory(leagueId: string, members: DemoMember[]): SeedMatch[] {
  const matches: SeedMatch[] = [];
  const memberIds = members.map((m) => m.id);
  const fifaGameIds = ['fifa', 'gp_8ball', 'gp_cup_pong'];

  for (let day = 60; day >= 1; day--) {
    const matchCount = randomBetween(1, 3);
    for (let m = 0; m < matchCount; m++) {
      const [pA, pB] = shuffle([...memberIds]).slice(0, 2);
      const gameId = fifaGameIds[randomBetween(0, 2)];
      const result: 'win' | 'loss' = randomBetween(0, 1) === 0 ? 'win' : 'loss';
      const scoreA = gameId === 'fifa' ? randomBetween(0, 5) : undefined;
      const scoreB = gameId === 'fifa' && scoreA !== undefined ? randomBetween(0, 5) : undefined;

      matches.push({
        id: `match-${leagueId}-${day}-${m}`,
        league_id: leagueId,
        game_id: gameId,
        player_a_id: pA,
        player_b_id: pB,
        result,
        score_a: scoreA,
        score_b: scoreB,
        status: 'confirmed',
        logged_by: pA,
        logged_at: daysAgo(day),
        confirmed_at: daysAgo(day),
        reactions: {},
      });
    }
  }
  return matches;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export { GAMES };

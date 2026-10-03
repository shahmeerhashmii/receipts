// Core types shared across rules and app
export type GameId =
  | 'fifa'
  | 'gp_8ball'
  | 'gp_cup_pong'
  | 'gp_word_hunt'
  | 'wordle'
  | 'connections'
  | 'krillion'
  | 'ballpark'
  | string; // custom games

export type MatchResult = 'win' | 'loss' | 'draw';
export type EventSize = 'big_w' | 'small_w' | 'small_l' | 'big_l';

export interface Member {
  id: string;
  display_name: string;
  avatar_color: string;
  avatar_url?: string;
  coins: number;
  joined_at: string;
}

export interface Match {
  id: string;
  league_id: string;
  game_id: GameId;
  player_a_id: string;
  player_b_id: string;
  result: MatchResult; // from player_a perspective
  score_a?: number;
  score_b?: number;
  // FIFA extras
  stars_a?: number;
  stars_b?: number;
  fifa_version?: string;
  // Puzzle extras
  puzzle_number?: number;
  puzzle_score?: number; // for single puzzle submissions
  // Status
  status: 'pending' | 'confirmed' | 'disputed' | 'voided';
  logged_by: string;
  logged_at: string;
  confirmed_at?: string;
}

export interface PuzzleSubmission {
  id: string;
  league_id: string;
  member_id: string;
  game_id: 'wordle' | 'connections' | 'krillion' | 'ballpark';
  puzzle_number: number;
  puzzle_date: string; // YYYY-MM-DD
  score: number; // lower wins for wordle/connections, higher for krillion/ballpark
  hard_mode?: boolean; // wordle only
  emoji_grid?: string;
  raw_text: string;
  submitted_at: string;
}

export interface Rating {
  member_id: string;
  game_id: GameId;
  rating: number;
  match_count: number;
  last_played_at?: string;
}

export interface StockPrice {
  member_id: string;
  price: number;
  computed_at: string;
}

export interface TradeEvent {
  id: string;
  league_id: string;
  buyer_id: string;
  seller_id: string; // 'house' for buys from house
  subject_id: string; // whose stock
  shares: number;
  price_per_share: number;
  fee: number;
  type: 'buy' | 'sell';
  created_at: string;
}

export interface Holding {
  holder_id: string;
  subject_id: string;
  shares: number;
  first_bought_at: string;
}

export interface EventProposal {
  id: string;
  league_id: string;
  proposer_id: string;
  subject_id: string;
  description: string;
  size: EventSize;
  votes_for: string[];
  votes_against: string[];
  status: 'open' | 'passed' | 'failed';
  created_at: string;
  resolved_at?: string;
}

export interface ScheduledMatch {
  id: string;
  league_id: string;
  game_id: GameId;
  player_a_id: string;
  player_b_id: string;
  scheduled_at: string;
  status: 'open' | 'settled' | 'refunded';
  match_id?: string; // filled when settled
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

export interface Bounty {
  game_id: GameId;
  holder_id: string;
  amount: number;
  started_at: string;
}

export interface Badge {
  id: string;
  member_id: string;
  league_id: string;
  achievement_id: string;
  earned_at: string;
}

export interface FeedItem {
  id: string;
  league_id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
  reactions?: Record<string, string[]>; // emoji -> member_ids
}

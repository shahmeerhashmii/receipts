// Supabase client + typed RPC wrappers
// In demo mode (no env vars), these are never imported -- the app uses demoStore directly.
// In production, every action that changes state goes through these functions.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ---- Auth ---------------------------------------------------------------

export async function signInAnonymously() {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}

export async function signInWithEmail(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
}

export function onAuthStateChange(cb: (userId: string | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user?.id ?? null);
  });
}

// ---- League admin RPCs --------------------------------------------------

export async function rpcRenameLeague(leagueId: string, name: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_rename_league', {
    p_league_id: leagueId, p_name: name,
  });
  if (error) throw error;
}

export async function rpcRegenerateCode(leagueId: string): Promise<string> {
  const { data, error } = await supabase.rpc('rpc_regenerate_code', {
    p_league_id: leagueId,
  });
  if (error) throw error;
  return data as string;
}

export async function rpcSetFifaVersion(leagueId: string, version: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_set_fifa_version', {
    p_league_id: leagueId, p_version: version,
  });
  if (error) throw error;
}

export async function rpcLeaveLeague(leagueId: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_leave_league', { p_league_id: leagueId });
  if (error) throw error;
}

export async function rpcRemoveMember(leagueId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_remove_member', {
    p_league_id: leagueId, p_user_id: userId,
  });
  if (error) throw error;
}

export async function rpcUpdateProfile(
  leagueId: string,
  fields: { displayName?: string; avatarColor?: string; avatarUrl?: string },
): Promise<void> {
  const { error } = await supabase.rpc('rpc_update_profile', {
    p_league_id:    leagueId,
    p_display_name: fields.displayName ?? null,
    p_avatar_color: fields.avatarColor ?? null,
    p_avatar_url:   fields.avatarUrl   ?? null,
  });
  if (error) throw error;
}

// ---- League create/join RPCs --------------------------------------------

export async function rpcCreateLeague(
  name: string,
  displayName: string,
  avatarColor: string,
): Promise<{ league_id: string; join_code: string }> {
  const { data, error } = await supabase.rpc('rpc_create_league', {
    p_name: name, p_display_name: displayName, p_avatar_color: avatarColor,
  });
  if (error) throw error;
  return data as { league_id: string; join_code: string };
}

export async function rpcJoinLeague(
  code: string,
  displayName: string,
  avatarColor: string,
): Promise<{ league_id: string; name: string }> {
  const { data, error } = await supabase.rpc('rpc_join_league', {
    p_code: code, p_display_name: displayName, p_avatar_color: avatarColor,
  });
  if (error) throw error;
  return data as { league_id: string; name: string };
}

export async function lookupLeagueByCode(
  code: string,
): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase.rpc('lookup_league_by_code', { p_code: code });
  if (error) throw error;
  return (data as { id: string; name: string }[])?.[0] ?? null;
}

export async function rpcAddLeagueGame(
  leagueId: string,
  gameId: string,
  name: string,
  type: '1v1' | 'puzzle' | 'ffa',
): Promise<void> {
  const { error } = await supabase.rpc('rpc_add_league_game', {
    p_league_id: leagueId,
    p_game_id:   gameId,
    p_name:      name,
    p_type:      type,
  });
  if (error) throw error;
}

// ---- Match RPCs ---------------------------------------------------------

export async function rpcLogMatch(params: {
  leagueId: string;
  gameId: string;
  opponentId: string;
  result: 'win' | 'loss' | 'draw';
  scoreA?: number;
  scoreB?: number;
  starsA?: number;
  starsB?: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc('rpc_log_match', {
    p_league_id:   params.leagueId,
    p_game_id:     params.gameId,
    p_opponent_id: params.opponentId,
    p_result:      params.result,
    p_score_a:     params.scoreA ?? null,
    p_score_b:     params.scoreB ?? null,
    p_stars_a:     params.starsA ?? null,
    p_stars_b:     params.starsB ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function rpcConfirmMatch(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_confirm_match', { p_match_id: matchId });
  if (error) throw error;
}

export async function rpcDisputeMatch(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_dispute_match', { p_match_id: matchId });
  if (error) throw error;
}

export async function rpcVoidMatch(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_void_match', { p_match_id: matchId });
  if (error) throw error;
}

// ---- Puzzle RPCs --------------------------------------------------------

export async function rpcSubmitPuzzle(params: {
  leagueId: string;
  gameId: string;
  puzzleNumber: number;
  puzzleDate: string;
  score: number;
  hardMode?: boolean;
  emojiGrid?: string;
  rawText?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('rpc_submit_puzzle', {
    p_league_id:     params.leagueId,
    p_game_id:       params.gameId,
    p_puzzle_number: params.puzzleNumber,
    p_puzzle_date:   params.puzzleDate,
    p_score:         params.score,
    p_hard_mode:     params.hardMode ?? false,
    p_emoji_grid:    params.emojiGrid ?? null,
    p_raw_text:      params.rawText ?? '',
  });
  if (error) throw error;
  return data as string;
}

// ---- Stock RPCs ---------------------------------------------------------

export async function rpcBuyStock(
  leagueId: string,
  subjectId: string,
  shares: number,
): Promise<void> {
  const { error } = await supabase.rpc('rpc_buy_stock', {
    p_league_id: leagueId, p_subject_id: subjectId, p_shares: shares,
  });
  if (error) throw error;
}

export async function rpcSellStock(
  leagueId: string,
  subjectId: string,
  shares: number,
): Promise<void> {
  const { error } = await supabase.rpc('rpc_sell_stock', {
    p_league_id: leagueId, p_subject_id: subjectId, p_shares: shares,
  });
  if (error) throw error;
}

// ---- Scheduled match + picks RPCs ---------------------------------------

export async function rpcScheduleMatch(params: {
  leagueId: string;
  gameId: string;
  playerAId: string;
  playerBId: string;
  scheduledAt: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('rpc_schedule_match', {
    p_league_id:    params.leagueId,
    p_game_id:      params.gameId,
    p_player_a_id:  params.playerAId,
    p_player_b_id:  params.playerBId,
    p_scheduled_at: params.scheduledAt,
  });
  if (error) throw error;
  return data as string;
}

export async function rpcMakePick(params: {
  scheduledMatchId: string;
  pickedPlayerId: string;
  stake: number;
  multiplier: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc('rpc_make_pick', {
    p_scheduled_match_id: params.scheduledMatchId,
    p_picked_player_id:   params.pickedPlayerId,
    p_stake:              params.stake,
    p_multiplier:         params.multiplier,
  });
  if (error) throw error;
  return data as string;
}

// ---- Event RPCs ---------------------------------------------------------

export async function rpcProposeEvent(params: {
  leagueId: string;
  subjectId: string;
  description: string;
  size: 'big_w' | 'small_w' | 'small_l' | 'big_l';
}): Promise<string> {
  const { data, error } = await supabase.rpc('rpc_propose_event', {
    p_league_id:   params.leagueId,
    p_subject_id:  params.subjectId,
    p_description: params.description,
    p_size:        params.size,
  });
  if (error) throw error;
  return data as string;
}

export async function rpcVoteEvent(
  eventId: string,
  vote: 'for' | 'against',
): Promise<void> {
  const { error } = await supabase.rpc('rpc_vote_event', {
    p_event_id: eventId, p_vote: vote,
  });
  if (error) throw error;
}

// ---- Coin RPCs ----------------------------------------------------------

export async function rpcWeeklyCheckin(leagueId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('rpc_weekly_checkin', { p_league_id: leagueId });
  if (error) throw error;
  return data as boolean;
}

export async function rpcClaimBankruptcyRelief(leagueId: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_claim_bankruptcy_relief', { p_league_id: leagueId });
  if (error) throw error;
}

// ---- Realtime subscriptions ---------------------------------------------

export function subscribeToLeague(
  leagueId: string,
  onChange: () => void,
): () => void {
  const tables = [
    'matches', 'puzzle_submissions', 'holdings', 'stock_price_history',
    'bounties', 'events', 'event_votes', 'scheduled_matches', 'picks',
    'badges', 'feed_items', 'reactions', 'league_members',
  ] as const;

  const channels = tables.map((table) =>
    supabase
      .channel(`${table}:${leagueId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `league_id=eq.${leagueId}` },
        onChange,
      )
      .subscribe(),
  );

  return () => channels.forEach((ch) => supabase.removeChannel(ch));
}

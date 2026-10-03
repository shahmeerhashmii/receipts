// Achievements definitions and checking logic

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  coins: number;
  icon: string; // tabler icon name
  color: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_blood', name: 'First Blood', description: 'First confirmed match', coins: 20, icon: 'IconDroplet', color: '#FF5C5C' },
  { id: 'hot_streak', name: 'Hot Streak', description: 'Win 5 in a row in one game', coins: 40, icon: 'IconFlame', color: '#FF9F43' },
  { id: 'giant_slayer', name: 'Giant Slayer', description: 'Beat someone rated 150+ above you', coins: 50, icon: 'IconSword', color: '#F2C14E' },
  { id: 'comeback_kid', name: 'Comeback Kid', description: 'Win right after losing 5 in a row', coins: 40, icon: 'IconRotateClockwise', color: '#2EE58A' },
  { id: 'bounty_hunter', name: 'Bounty Hunter', description: 'Collect your first bounty', coins: 20, icon: 'IconTarget', color: '#FF5C5C' },
  { id: 'called_it', name: 'Called It', description: 'Win a pick that paid 4x or more', coins: 40, icon: 'IconEye', color: '#7C9CFF' },
  { id: 'oracle', name: 'Oracle', description: 'Win 5 picks in a row', coins: 50, icon: 'IconSparkles', color: '#B48CFF' },
  { id: 'diamond_hands', name: 'Diamond Hands', description: "Hold one member's stock for 30 days without selling", coins: 40, icon: 'IconDiamond', color: '#5CC8FF' },
  { id: 'puzzle_machine', name: 'Puzzle Machine', description: 'Post a daily puzzle 7 days in a row', coins: 40, icon: 'IconPuzzle', color: '#2EE58A' },
  { id: 'wordle_wizard', name: 'Wordle Wizard', description: 'Solve a Wordle in 2', coins: 25, icon: 'IconWand', color: '#6AAA64' },
  { id: 'one_in_a_krillion', name: 'One in a Krillion', description: 'Score over 500 in Krillion', coins: 50, icon: 'IconFish', color: '#3FA9F5' },
  { id: 'ironman', name: 'Ironman', description: '20 confirmed matches in one calendar month', coins: 50, icon: 'IconBarbell', color: '#C9CED6' },
];

export const MONTHLY_AWARDS = [
  { id: 'top_climber', name: 'Top Climber', description: 'Biggest overall rating gain', icon: 'IconTrendingUp' },
  { id: 'wall_street', name: 'Wall Street', description: 'Biggest net worth gain in percent', icon: 'IconBuildingBank' },
  { id: 'puzzle_champ', name: 'Puzzle Champ', description: 'Most daily puzzle mini match wins', icon: 'IconTrophy' },
  { id: 'upset_of_month', name: 'Upset of the Month', description: 'Biggest rating gap overcome in one win', icon: 'IconBolt' },
  { id: 'most_active', name: 'Most Active', description: 'Most confirmed matches and puzzles combined', icon: 'IconActivity' },
];

/** Check if giant slayer applies: winner rated 150+ below loser */
export function isGiantSlayer(winnerRating: number, loserRating: number): boolean {
  return loserRating - winnerRating >= 150;
}

# Receipts

**Proof of who's actually better.**

A private app for friend groups that tracks games with chess-style ratings, plus a fake-coin stock market where you invest in each other, back players in scheduled matches, and vote on real-life events.

---

## What it does

### Ratings
Every member has a separate Elo-style rating for each game, starting at 1000. Ratings are recalculated from the full confirmed match history whenever a match is voided or edited, so the history is always the source of truth.

- **K factor:** 40 for the first 10 matches in a game, 24 thereafter.
- **FIFA handicap:** Log the star rating of each team (0.5 to 5 stars). The higher the star gap, the bigger the underdog boost for the weaker-team player.
- **Margin multiplier:** Enter the score to apply 1.0 (1-goal diff), 1.15 (2-goal diff), or 1.3 (3+ goal diff).
- **Daily puzzles:** Wordle, Connections, Krillion, Ballpark. Each puzzle day settles at midnight Toronto time. Every pair of members who played is a mini Elo match.
- **Overall rating:** Weighted average across games, using recent-60-day match counts (capped at 10) as weights.

### Coins
Everyone starts with 400 coins. Earn coins by playing matches (+20, +10 bonus for wins, first 3 matches per day), posting daily puzzles (+5), winning puzzle leaderboards (+10, split on ties), weekly check-ins (+50), bounties, dividends, achievements, and monthly awards.

### Crewfolio (stocks)
Every member has a stock. Price = `round(40 * 3^((rating - 1000) / 400) * eventMultiplier)`. Buying and selling do not move the price. A 5% fee on sells. Weekly dividends pay 2% of each holding if the subject played at least once that week. Position limit: max 40% of net worth in one stock.

### Events
Any member proposes an event about any member (including themselves), picks a size (Big W +15%, Small W +5%, Small L -5%, Big L -15%), and the league votes. It passes once at least half of eligible members vote yes. Effects fade linearly over 28 days.

### Match picks
Schedule a match, and anyone can back a side before it starts. Payout multiplier = `clamp(0.95 / expectedScore, 1.1, 5.0)`. A draw refunds everyone. If the match is not logged within 48 hours, everyone is refunded.

### Bounties
The #1 player in each game (10+ matches required) carries a bounty starting at 25 coins, growing 5 per week, capped at 75. Whoever beats them collects it.

### Achievements and monthly awards
12 one-time achievements (First Blood, Hot Streak, Giant Slayer, etc.) and 5 monthly awards (Top Climber, Wall Street, Puzzle Champ, Upset of the Month, Most Active).

---

## Running locally in demo mode

When `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing (the default for local development without setup), the app runs in **demo mode**:
- Two fake leagues with 6 friends each and 60 days of seeded history.
- All data is stored in `localStorage`.
- A fake friend logs activity every 20 seconds to simulate live updates.
- A "Demo mode" banner is shown at the top.

```bash
# 1. Clone the repo
git clone https://github.com/shahmeerhashmii/receipts.git
cd receipts

# 2. Install dependencies
npm install

# 3. Run locally (demo mode, no Supabase needed)
npm run dev

# Open http://localhost:5173/receipts/

# 4. Run tests
npm test

# 5. Build
npm run build
```

---

## Supabase setup

### Step 1: Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Choose a region close to your users.

### Step 2: Enable extensions

In the Supabase dashboard, go to **Database > Extensions** and enable:
- `pg_cron`
- `pgcrypto` (usually enabled by default)

### Step 3: Run schema.sql

In **SQL Editor**, paste the contents of `supabase/schema.sql` and run it. This creates all tables, RLS policies, the join code function, Realtime publication, and the settlement cron job.

### Step 4: Enable authentication

In **Authentication > Providers**:
- Turn on **Anonymous sign-ins** so users can join in seconds.
- Turn on **Email** (magic links) so users can save their account and sign in on a new device.

### Step 5: Enable Realtime

In **Database > Replication**, confirm that `supabase_realtime` publication includes all the tables listed at the bottom of `schema.sql`. The schema runs `ALTER PUBLICATION supabase_realtime ADD TABLE ...` for each one.

### Step 6: Add environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your project URL and anon key from **Project Settings > API**:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Step 7: Add secrets to GitHub

For the GitHub Actions deploy workflow to build with Supabase:

1. Go to your GitHub repo > **Settings > Secrets and variables > Actions**.
2. Add two repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

---

## Publishing to GitHub Pages

1. Push your code to GitHub:
   ```bash
   git remote add origin https://github.com/shahmeerhashmii/receipts.git
   git push -u origin main
   ```

2. Go to your GitHub repo > **Settings > Pages**.
3. Under **Source**, select **GitHub Actions**.
4. The included `.github/workflows/deploy.yml` will build and deploy automatically on every push to `main`.

Your app will be live at: `https://shahmeerhashmii.github.io/receipts/`

Invite links like `https://shahmeerhashmii.github.io/receipts/join/K7QX2M` work because `404.html` is a copy of `index.html`, which lets the SPA handle routing on GitHub Pages.

---

## Project structure

```
src/
  rules/          Pure TypeScript functions for all game logic
  rules/__tests__ Vitest unit tests for every rule
  demo/           Demo mode store (localStorage) and seed data
  context/        React context (AppProvider)
  components/     Shared UI components (Avatar, BottomSheet, etc.)
  screens/        App screens (Rankings, Crewfolio, Matches, etc.)
supabase/
  schema.sql      Full Postgres schema with RLS, Realtime, cron
```

---

## Rule reference (plain English)

| Rule | Detail |
|------|--------|
| Starting rating | 1000 per game |
| K factor | 40 for first 10 matches, 24 after |
| Expected score | E = 1 / (1 + 10^((Rb - Ra) / 400)) |
| Rating change | K * (S - E) * marginMultiplier |
| FIFA star gap 1 | +30 handicap to opponent's effective rating |
| FIFA star gap 1.5 | +55 |
| FIFA star gap 2 | +85 |
| FIFA star gap 2.5 | +115 |
| FIFA star gap 3+ | +150 |
| Margin mult (1-goal diff) | 1.0 |
| Margin mult (2-goal diff) | 1.15 |
| Margin mult (3+ diff) | 1.3 |
| Inactivity | 5 pts/week toward 1000 after 30 inactive days, max 50 |
| Overall rating | Weighted avg, 60-day counts capped at 10 |
| Stock price | round(40 * 3^((overall - 1000) / 400) * eventMult), min 2 |
| Sell fee | 5% of gross, rounded up |
| Position limit | Max 40% of net worth in one stock |
| Dividend | 2% of holding value per week if subject played, rounded down |
| Event pass | ceil(eligibleVoters / 2) yes votes |
| Event fade | Linear to 0 over 28 days |
| Pick multiplier | clamp(0.95 / expectedScore, 1.1, 5.0) |
| Bounty | 25 coins, +5/week at top, max 75 |
| Bankruptcy threshold | Net worth < 40, claim 100 coins once/week |

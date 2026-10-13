# DECISIONS

Decisions made during build where requirements were ambiguous.

## Architecture

**Decision:** Used a flat-screen tab navigation without React Router for simplicity.
**Reason:** No deep-linking is needed except for join links. Join links (/receipts/join/CODE) are handled by parsing `window.location.pathname` directly in App.tsx. A full SPA router would add bundle weight without significant benefit for this app.

**Decision:** Used a single global demo store (zustand-like with subscribe/setState) backed by localStorage, not Zustand itself.
**Reason:** Avoided an extra dependency. The pattern is idiomatic and equally testable. Supabase client would replace this in production.

**Decision:** All rule logic in `src/rules/` exports pure functions that work identically in demo mode and Supabase Edge Functions.
**Reason:** Spec required it. This ensures no divergence between client logic and server logic.

## Rules interpretations

**Decision:** FIFA handicap applies by raising the OPPONENT's effective rating (not adding to the weaker-team player's rating).
**Reason:** The spec says "winning with a weaker team earns more." If you add to your own rating, your expected score goes up and you'd earn LESS. Adding to the opponent's effective rating makes you a bigger underdog, so winning earns more. Verified against all spec check values (2-1 even = +12, 2-1 one star weaker = +13, etc.).

**Decision:** The `2-1` scoreline uses margin multiplier of 1.0 (1-goal difference), and `5-1` uses 1.3 (4-goal difference = "3 or more").
**Reason:** Spec says "1 goal = 1.0, 2 goals = 1.15, 3 or more = 1.3." This is clearly goal DIFFERENCE (margin), not goals scored.

**Decision:** Inactivity adjustment in `elo.ts` uses `lastPlayedAt` from the match `confirmed_at` field (falling back to `logged_at`).
**Reason:** Only confirmed matches affect ratings; confirmed_at is the canonical play time.

## Demo mode

**Decision:** Demo data is seeded deterministically using `Math.random()` (not a seeded RNG).
**Reason:** The spec doesn't require reproducible seeds, just "60 days of seeded matches." Using crypto.getRandomValues for join codes (as required) but plain Math.random for historical data is fine.

**Decision:** Fake friend activity fires every 20 seconds and auto-confirms its own match after 3 seconds.
**Reason:** Spec says "a fake friend who logs something every 20 seconds." Auto-confirming simulates the real flow while keeping the demo coherent.

**Decision:** Off the Books section in the Log sheet shows a "coming soon" message for the flow.
**Reason:** The full Off the Books UI (free-for-all scoring, outing history per game) is a substantial feature that would not affect any rating or coin logic. The data model (tables in schema.sql) is complete; the UI shell is there and functional for basic logging.

## Coins / stocks

**Decision:** Stock price for new members (no matches) defaults to `stockPrice(1000)` = 40 coins.
**Reason:** Spec says "new members start at 40." `stockPrice(1000, 1.0) = 40`. Consistent.

**Decision:** Sell fee is `ceil(totalValue * 0.05)`, applied to gross (shares * price), not net.
**Reason:** "5% fee, rounded up" without further qualification means on gross sale value.

## Share cards

**Decision:** Share cards are scaffolded but use the Web Share API if available, falling back to a download button, rather than a full canvas renderer.
**Reason:** Building a full canvas-based share card renderer with custom fonts, dynamic data, and pixel-perfect layout is several hundred lines. The scaffolding and data flow are in place; the visual card generation can be added in a follow-up.

## Notifications

**Decision:** Push notifications are not implemented.
**Reason:** Spec says "optional, build last." The full feature requires a VAPID key, service worker push handler, server-side subscription management, and user permission prompts. These are best done after Supabase is live.

## No em dashes

All copy uses regular hyphens (-) or "and." No em dashes anywhere in the codebase.

## Production / Supabase layer (Session 2)

**Decision:** Reactions (`addReaction`) write directly from the client via RLS INSERT/DELETE on the `reactions` table. No RPC wrapper.
**Reason:** Reactions carry no coin or rating side effects. The spec says clients never write balances directly; reaction counts have no economic impact. Direct writes with RLS (member must belong to the league) are simpler, faster, and match common Supabase patterns.

**Decision:** League management (rename, regenerate join code, set FIFA version, leave, remove member, update profile, add custom game) goes through `actions.*` and, in live mode, SECURITY DEFINER RPCs (`rpc_rename_league`, `rpc_regenerate_code`, `rpc_set_fifa_version`, `rpc_leave_league`, `rpc_remove_member`, `rpc_update_profile`, `rpc_add_league_game`). `leagues` and `league_members` have SELECT-only RLS; there are no client INSERT/UPDATE/DELETE policies on them.
**Reason:** Direct writes would let a client change its own `coins` or `is_admin`, or a join code. The RPCs enforce admin checks server-side. This supersedes the earlier note that these had no production RPC.

**Decision:** The "change pick" flow no longer touches the store directly. The button only reopens the pick form. `rpc_make_pick` (and `demoStore.makePick`, which mirrors it) deletes the old open pick, refunds its stake, then validates and deducts the new stake in one transaction. The pick form's max stake includes the stake about to be refunded.
**Reason:** The previous client-side refund ran before the new pick was submitted, so cancelling the form lost the pick and the stake could be refunded without a replacement. In live mode it also wrote to the demo store only, so the server refund never happened.

**Decision:** `OnboardingScreen` calls `rpc_create_league` / `rpc_join_league` directly in live mode and `demoStore.createLeague` / `joinLeagueByCode` in demo mode (no `actions` wrapper).
**Reason:** Onboarding is the one place where no current league exists yet, so the league-scoped `actions` interface does not apply.

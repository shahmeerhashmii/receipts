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

**Decision:** Admin-only settings mutations (regenerate join code, set FIFA version, remove member, leave league) in `LeagueSettingsScreen` still use `demoStore.setState` directly in demo mode and have no production RPC yet.
**Reason:** None of these change ratings, coins, prices, picks, bounties, badges or event results. The schema has the relevant tables and RLS. RPCs (`rpc_rename_league`, `rpc_remove_member`, `rpc_leave_league`) can be added in a follow-up once Supabase is live without changing any rule logic.

**Decision:** The "change pick" flow in `MatchesScreen` uses a direct `demoStore.setState` to refund coins and remove the old pick before opening the pick form again. In production, `rpc_make_pick` handles this atomically (delete old pick + refund + insert new pick) server-side.
**Reason:** The demo must mirror the production behavior, but the production atomic path is a single `rpc_make_pick` call that already handles both cases. Duplicating the refund logic in an `actions.changePick` wrapper would be redundant.

**Decision:** `OnboardingScreen` uses `demoStore.createLeague` and `demoStore.joinLeagueByCode` directly (no `actions` wrapper).
**Reason:** Onboarding is the one place where a Supabase session does not yet exist. In production these calls would go to `rpc_create_league` / `rpc_join_league` but that requires integrating Supabase anonymous auth and session management, which is a separate concern from the action-dispatch refactor.

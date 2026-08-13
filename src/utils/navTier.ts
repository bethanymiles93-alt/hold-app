/**
 * Two-tier bottom-nav-bar visibility rule (2026-08-13): Tier 1 (Going
 * Quiet, Transition screens, Reconnect including its resumed state, plus
 * Library — see below) hides the nav bar throughout, checked by route
 * prefix, not composition state. Shared between `BottomTabBar` (which
 * route decides whether to render at all) and `Screen` (which route
 * decides whether to reserve bottom space for it, now that it's a
 * root-level floating overlay rather than a navigator-managed bar that
 * used to reserve that space automatically). See
 * `04-ux-content/04-navigation-architecture.md` and docs/09-decision-log.md.
 *
 * `/library` included here too, even though it isn't part of the core
 * journey conceptually: Library never shows the bottom nav bar in any
 * state (a Back button replaces it, see LibraryBackButton), which is a
 * permanent, route-based rule exactly like the journey screens above —
 * not a composition-driven one, so it belongs in this list rather than
 * behind the Tier 2 `isComposing` check. Reconciled 2026-08-13 against
 * this file's rewrite, which landed after Library's own no-nav-bar
 * revision and didn't yet account for it.
 */
const TIER_1_PREFIXES = ["/create", "/return", "/welcome", "/library"];

export function isTier1Route(pathname: string): boolean {
  return TIER_1_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Approximate rendered height of the floating pill + its own top padding
 * (not the safe-area inset, which `Screen`'s SafeAreaView already reserves
 * separately) — deliberately generous rather than pixel-exact, since a
 * little extra bottom whitespace on a scroll view is harmless but content
 * actually hidden under the pill isn't.
 */
export const NAV_BAR_RESERVED_HEIGHT = 84;

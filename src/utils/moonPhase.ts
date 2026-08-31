/**
 * Real moon-phase calculation (2026-08-31) — hold-book itself flags this
 * as needing its own design pass, since "this section never specified
 * what showing a moon phase should actually look like or where"
 * (04-navigation-architecture.md). Placement decided here: Home's own
 * Taking Time header, beside "Quiet since [date]" — a small, ambient
 * marker of time passing during a quiet period, matching the "quiet
 * season" language already used elsewhere (metaphor families,
 * 04-ux-content/02-voice-and-language.md), not a functional/interactive
 * element.
 *
 * Standard synodic-month approximation (29.530588853 days), anchored to a
 * known new moon (2000-01-06 18:14 UTC, a commonly-used reference epoch) —
 * accurate to within about a day either side over any realistic date
 * range for this app, which is all an ambient marker needs; not
 * astronomical-almanac precision.
 */
const SYNODIC_MONTH_DAYS = 29.530588853;
const KNOWN_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14, 0);

export interface MoonPhase {
  /** 0 (new moon) to 1 (just before the next new moon). */
  age: number;
  name: string;
}

const PHASES: { maxAge: number; name: string }[] = [
  { maxAge: 0.033, name: "New moon" },
  { maxAge: 0.216, name: "Waxing crescent" },
  { maxAge: 0.283, name: "First quarter" },
  { maxAge: 0.466, name: "Waxing gibbous" },
  { maxAge: 0.533, name: "Full moon" },
  { maxAge: 0.716, name: "Waning gibbous" },
  { maxAge: 0.783, name: "Last quarter" },
  { maxAge: 0.966, name: "Waning crescent" },
  { maxAge: 1, name: "New moon" }
];

export function getMoonPhase(date: Date = new Date()): MoonPhase {
  const daysSinceKnownNewMoon = (date.getTime() - KNOWN_NEW_MOON_UTC) / (1000 * 60 * 60 * 24);
  const cyclesSince = daysSinceKnownNewMoon / SYNODIC_MONTH_DAYS;
  const age = cyclesSince - Math.floor(cyclesSince);

  const fallback = PHASES[PHASES.length - 1] as (typeof PHASES)[number];
  const match = PHASES.find((phase) => age <= phase.maxAge) ?? fallback;
  return { age, name: match.name };
}

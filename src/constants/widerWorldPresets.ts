/**
 * Fixed preset platforms offered on every context row, alphabetical, same
 * list everywhere (no context-dependent variation) — per direct
 * instruction. Icons are sourced from icon sets already bundled with
 * `@expo/vector-icons` (Ionicons/FontAwesome6), not custom-drawn or
 * downloaded from each platform's own brand kit — monochrome/tintable,
 * matching every other icon already in the app, which sidesteps official
 * brand-colour requirements some kits impose. Substack has no bundled
 * glyph in either set, so it falls back to text-only per the same
 * instruction's own stated rule, not a brand-guideline concern.
 *
 * `expiresAfterHours` is what makes the status-expiry-reminder mechanism
 * (see src/services/widerWorldContextService.ts) apply to a platform —
 * generic and data-driven, not a hardcoded platform check anywhere else in
 * the app. `characterLimit` is what drives the message box's own dynamic
 * "strictest limit among selected platforms" cap (see
 * app/settings/wider-world.tsx) — advisory only, never used to truncate.
 *
 * **Expiry audit, done on direct instruction rather than assuming WhatsApp
 * is the only one:** every other preset here targets a platform's
 * persistent bio/headline/About field, which does not expire or
 * self-clear on any of these platforms — this is standard, well-
 * established behaviour for a bio-type field, not something each platform
 * needed its own dedicated research pass. WhatsApp is confirmed
 * genuinely different: Meta's own two separate fields are "About" (139
 * characters, permanent, no expiry) and "Status" (700 characters, 24-hour
 * expiry, Stories-like). **Per repeated, explicit direct instruction this
 * preset targets "Status," the expiring one** — flagged here because
 * that's in tension with this same feature's own later "persistent
 * bio/status field... not stories or disappearing content" framing;
 * confirm this is still the intended field, not "About," before treating
 * it as settled. Snapchat's Snap Map status TEXT field (distinct from
 * location-sharing, which does have its own separate expiry/permission
 * behaviour) could not be confirmed either way from Snapchat's own docs —
 * left with no expiry set (the more conservative default) rather than
 * guessed, flagged as genuinely unconfirmed, not researched-and-negative
 * like the rest of the list.
 *
 * **All character limits below are sourced from third-party character-
 * limit/social-media-tool aggregator sites, not each platform's own
 * official developer or help documentation** — same caveat already
 * applied to Snapchat's field choice, now extended to every number here.
 * Treat as a reasonable working default, not a verified-correct source of
 * truth. Facebook's own figure varied across sources (101–255); the
 * stricter/lower bound is used here, since this cap is advisory-only
 * (never truncates), so under-restricting the shown counter is the safer
 * direction of error. LinkedIn targets the shorter "headline" field
 * (220 characters) rather than the much longer "About" section (~2,600) —
 * a judgement call for which field reads as the closer analogue to a
 * short status elsewhere on this list, not an explicit instruction; flag
 * if "About" was actually intended.
 */
export interface WiderWorldPresetPlatform {
  id: string;
  name: string;
  icon?: { family: "ionicons"; name: string } | { family: "fa6"; name: string };
  expiresAfterHours?: number;
  characterLimit?: number;
}

export const WIDER_WORLD_PRESET_PLATFORMS: WiderWorldPresetPlatform[] = [
  { id: "preset-bluesky", name: "Bluesky", icon: { family: "fa6", name: "bluesky" }, characterLimit: 256 },
  { id: "preset-facebook", name: "Facebook", icon: { family: "ionicons", name: "logo-facebook" }, characterLimit: 101 },
  { id: "preset-instagram", name: "Instagram", icon: { family: "ionicons", name: "logo-instagram" }, characterLimit: 150 },
  { id: "preset-linkedin", name: "LinkedIn", icon: { family: "ionicons", name: "logo-linkedin" }, characterLimit: 220 },
  // Snap Map status text — see this file's own header comment for why no
  // expiresAfterHours is set (genuinely unconfirmed, not researched-negative).
  { id: "preset-snapchat", name: "Snapchat", icon: { family: "ionicons", name: "logo-snapchat" }, characterLimit: 60 },
  // No bundled icon available — text-only pill, per the stated fallback rule.
  { id: "preset-substack", name: "Substack", characterLimit: 250 },
  { id: "preset-threads", name: "Threads", icon: { family: "ionicons", name: "logo-threads" }, characterLimit: 150 },
  { id: "preset-tiktok", name: "TikTok", icon: { family: "ionicons", name: "logo-tiktok" }, characterLimit: 80 },
  {
    id: "preset-whatsapp",
    name: "WhatsApp",
    icon: { family: "ionicons", name: "logo-whatsapp" },
    expiresAfterHours: 24,
    characterLimit: 700
  },
  { id: "preset-x", name: "X", icon: { family: "ionicons", name: "logo-x" }, characterLimit: 160 }
];

export function findWiderWorldPreset(id: string): WiderWorldPresetPlatform | undefined {
  return WIDER_WORLD_PRESET_PLATFORMS.find((preset) => preset.id === id);
}

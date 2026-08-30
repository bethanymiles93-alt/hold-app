import type { Region } from "@/services/languageLocationService";

export interface CrisisResource {
  label: string;
  detail: string;
}

/**
 * The "core six" — verified 2026-08-12, corroborated across official/
 * government sources (SAMHSA, FCC, Mental Health Commission of Canada,
 * NHS, and others). See hold-book's 06-privacy-security/03-safeguarding.md,
 * "International crisis resources," for the full research and sourcing —
 * not duplicated in comments here to avoid the two drifting apart.
 * Numbers should be re-verified close to each real launch date, not
 * treated as permanently fixed once entered.
 */
export const CRISIS_RESOURCES: Record<Region, CrisisResource[]> = {
  uk: [
    { label: "Samaritans", detail: "116 123, free, 24/7" },
    { label: "NHS", detail: "111, option 2" },
    { label: "Immediate danger", detail: "999" }
  ],
  ie: [
    { label: "Samaritans", detail: "116 123, free, 24/7 (same number as UK)" },
    { label: "Aware", detail: "1800 80 48 48, 10am–10pm" }
  ],
  us: [
    { label: "988 Suicide & Crisis Lifeline", detail: "call or text 988, 24/7" },
    { label: "Crisis Text Line", detail: "text HOME to 741741" }
  ],
  ca: [{ label: "988 Suicide Crisis Helpline", detail: "call or text 988, 24/7" }],
  au: [
    { label: "Lifeline", detail: "13 11 14" },
    { label: "Beyond Blue", detail: "1300 22 4636" }
  ],
  nz: [
    { label: "Need to Talk?", detail: "free call or text 1737" },
    { label: "Lifeline NZ", detail: "0800 543 354" }
  ],
  other: [
    {
      label: "Search for a local crisis line",
      detail: "Hold doesn't yet have a verified number for your region — please look for a local crisis or mental health helpline."
    }
  ]
};

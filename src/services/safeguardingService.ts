import { isHoldPlusActive } from "@/services/holdPlusService";
import { requestSafeguardCheck } from "@/services/aiProxyClient";

/**
 * PLACEHOLDER — not clinically reviewed, must not ship. See hold-book
 * 06-privacy-security/03-safeguarding.md. Real content must come from a
 * clinical safety consultant, not be guessed here — this exists only so
 * the pipeline below is genuinely testable in local dev builds.
 */
const PLACEHOLDER_KEYWORDS = [
  "kill myself",
  "end my life",
  "want to die",
  "suicide",
  "hurt myself",
  "self harm",
  "self-harm"
];

function matchesPlaceholderKeywords(text: string): boolean {
  const normalized = text.toLowerCase();
  return PLACEHOLDER_KEYWORDS.some((phrase) => normalized.includes(phrase));
}

export interface SafeguardingCheckResult {
  triggered: boolean;
}

/**
 * Two-tier detection: free tier gets the on-device keyword layer only; Hold+
 * additionally gets a classifier pass (see aiProxyClient.ts/worker). Tiering
 * only ever affects detection accuracy — see hold-book's 2026-08-10 decision.
 *
 * Hard-gated to local dev builds via __DEV__ (false in any release-mode
 * bundle, including EAS preview/production and TestFlight) — see
 * docs/09-decision-log.md and hold-book's 08-decisions/01-decision-log.md,
 * 2026-08-10. Fails safe/closed: returns not-triggered outside dev, never
 * throws, so this can never break or block real usage even if miswired.
 */
export async function checkForCrisisLanguage(text: string): Promise<SafeguardingCheckResult> {
  if (!__DEV__) return { triggered: false };

  const trimmed = text.trim();
  if (!trimmed) return { triggered: false };

  if (matchesPlaceholderKeywords(trimmed)) {
    return { triggered: true };
  }

  if (await isHoldPlusActive()) {
    try {
      const classifierTriggered = await requestSafeguardCheck(trimmed);
      if (classifierTriggered) return { triggered: true };
    } catch {
      // Fail open on the classifier enhancement only — never let a network/
      // provider failure block drafting or hide the keyword layer's result.
    }
  }

  return { triggered: false };
}

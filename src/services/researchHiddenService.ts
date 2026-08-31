import * as SecureStore from "expo-secure-store";

const HIDDEN_FINDINGS_KEY = "hold.research.hiddenFindings";

/**
 * Per-finding "not helpful for me" hide, modelled on Calm Harm's pattern:
 * an in-context action on the content itself, not a separate management
 * screen. Persisted (not session-local) so it stays hidden across visits,
 * but never a one-way door — Research's index has a "Show hidden" toggle
 * that reveals everything currently hidden, each still individually
 * un-hideable from where it's shown. Per-finding rather than per-page:
 * each finding already needs a stable id for the reference-jump
 * mechanic, so this costs nothing extra on top of that, and lets someone
 * hide one shaky claim (the sound-frequency flag, say) without losing
 * the rest of that page. See docs/09-decision-log.md, 2026-08-31.
 */
export async function getHiddenFindingIds(): Promise<Set<string>> {
  const raw = await SecureStore.getItemAsync(HIDDEN_FINDINGS_KEY);
  return new Set(raw ? (JSON.parse(raw) as string[]) : []);
}

export async function hideFinding(findingId: string): Promise<void> {
  const current = await getHiddenFindingIds();
  current.add(findingId);
  await SecureStore.setItemAsync(HIDDEN_FINDINGS_KEY, JSON.stringify([...current]));
}

export async function unhideFinding(findingId: string): Promise<void> {
  const current = await getHiddenFindingIds();
  current.delete(findingId);
  await SecureStore.setItemAsync(HIDDEN_FINDINGS_KEY, JSON.stringify([...current]));
}

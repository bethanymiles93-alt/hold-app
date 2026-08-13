import * as SecureStore from "expo-secure-store";

const KEY = "hold.suggestedPhrases";

/**
 * Short, pre-written phrases offered as tappable pills above the docked
 * bar app-wide (2026-08-13) — "overwhelmed," "not feeling right," "quiet
 * time" are the given examples. User-editable from Library's Templates tab
 * ("Suggested phrases" section) — add, remove, or amend the wording of
 * their own set; not a fixed, uneditable list. Falls back to this default
 * set until the person ever saves their own. See docs/09-decision-log.md.
 */
const DEFAULT_PHRASES = ["overwhelmed", "not feeling right", "quiet time", "need some space", "taking it slow"];

export async function getSuggestedPhrases(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return DEFAULT_PHRASES;
  const parsed = JSON.parse(raw) as string[];
  return parsed;
}

export async function saveSuggestedPhrases(phrases: string[]): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(phrases));
}

export async function addSuggestedPhrase(phrase: string): Promise<string[]> {
  const trimmed = phrase.trim();
  if (!trimmed) return getSuggestedPhrases();

  const current = await getSuggestedPhrases();
  if (current.includes(trimmed)) return current;

  const next = [...current, trimmed];
  await saveSuggestedPhrases(next);
  return next;
}

export async function removeSuggestedPhrase(phrase: string): Promise<string[]> {
  const current = await getSuggestedPhrases();
  const next = current.filter((existing) => existing !== phrase);
  await saveSuggestedPhrases(next);
  return next;
}

export async function editSuggestedPhrase(oldPhrase: string, newPhrase: string): Promise<string[]> {
  const trimmed = newPhrase.trim();
  if (!trimmed) return getSuggestedPhrases();

  const current = await getSuggestedPhrases();
  const next = current.map((existing) => (existing === oldPhrase ? trimmed : existing));
  await saveSuggestedPhrases(next);
  return next;
}

export async function deleteAllSuggestedPhrases(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}

import * as SecureStore from "expo-secure-store";
import { WIDER_WORLD_PRESET_PLATFORMS, findWiderWorldPreset, type WiderWorldPresetPlatform } from "@/constants/widerWorldPresets";
import type { WiderWorldContext, WiderWorldCustomPlatform, WiderWorldExpiryReminderOptIn } from "@/types/hold";

const CONTEXTS_KEY = "hold.widerWorld.contexts";
const CUSTOM_PLATFORMS_KEY = "hold.widerWorld.customPlatforms";
const EXPIRY_OPT_INS_KEY = "hold.widerWorld.expiryReminderOptIns";

/**
 * Seeded as the real, stored, editable message the moment a context is
 * created — not a placeholder — same "pre-filled but editable" precedent
 * as a Circle's own saved default message. Prefixed with the HoldMark
 * glyph at render time (Settings screen), not part of this string itself.
 */
const DEFAULT_CONTEXT_MESSAGE = "I'm going quiet on here for a bit, I'll come back to you when I can.";

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function writeContexts(contexts: WiderWorldContext[]): Promise<void> {
  await SecureStore.setItemAsync(CONTEXTS_KEY, JSON.stringify(contexts));
}

/**
 * Always returns at least one context — lazily seeds a single "Personal"
 * context on first read rather than requiring an explicit empty-state
 * screen. The Settings page's own "stays unlabeled while it's the only
 * one" rule is a display-time decision (see WiderWorldContext's own
 * comment), so the stored label is "Personal" from the very start.
 */
export async function getWiderWorldContexts(): Promise<WiderWorldContext[]> {
  const raw = await SecureStore.getItemAsync(CONTEXTS_KEY);
  const parsed = raw ? (JSON.parse(raw) as WiderWorldContext[]) : [];
  if (parsed.length > 0) return parsed;

  const seeded: WiderWorldContext[] = [
    { id: generateId(), label: "Personal", selectedPlatformIds: [], message: DEFAULT_CONTEXT_MESSAGE }
  ];
  await writeContexts(seeded);
  return seeded;
}

export async function addWiderWorldContext(label: string): Promise<WiderWorldContext[]> {
  const trimmed = label.trim();
  if (!trimmed) return getWiderWorldContexts();

  const current = await getWiderWorldContexts();
  const next = [
    ...current,
    { id: generateId(), label: trimmed, selectedPlatformIds: [], message: DEFAULT_CONTEXT_MESSAGE }
  ];
  await writeContexts(next);
  return next;
}

export async function renameWiderWorldContext(id: string, label: string): Promise<WiderWorldContext[]> {
  const trimmed = label.trim();
  if (!trimmed) return getWiderWorldContexts();

  const current = await getWiderWorldContexts();
  const next = current.map((context) => (context.id === id ? { ...context, label: trimmed } : context));
  await writeContexts(next);
  return next;
}

/** No-op if this would remove the last remaining context — always at least one exists. */
export async function removeWiderWorldContext(id: string): Promise<WiderWorldContext[]> {
  const current = await getWiderWorldContexts();
  if (current.length <= 1) return current;

  const next = current.filter((context) => context.id !== id);
  await writeContexts(next);
  return next;
}

export async function setWiderWorldContextPlatforms(id: string, platformIds: string[]): Promise<WiderWorldContext[]> {
  const current = await getWiderWorldContexts();
  const next = current.map((context) => (context.id === id ? { ...context, selectedPlatformIds: platformIds } : context));
  await writeContexts(next);
  return next;
}

/**
 * Editing the message clears any existing `sentAt` mark — same "revert on
 * edit" principle already used for Template's green highlight elsewhere:
 * a sent marker claims the currently-shown text was actually posted, so
 * changing that text without also changing the claim would be misleading.
 * A no-op edit (identical text re-saved) leaves the mark untouched.
 */
export async function setWiderWorldContextMessage(id: string, message: string): Promise<WiderWorldContext[]> {
  const current = await getWiderWorldContexts();
  const next = current.map((context) =>
    context.id === id
      ? { ...context, message, sentAt: context.message === message ? context.sentAt : null }
      : context
  );
  await writeContexts(next);
  return next;
}

export async function setWiderWorldContextSentAt(id: string, sentAt: number | null): Promise<WiderWorldContext[]> {
  const current = await getWiderWorldContexts();
  const next = current.map((context) => (context.id === id ? { ...context, sentAt } : context));
  await writeContexts(next);
  return next;
}

async function writeCustomPlatforms(platforms: WiderWorldCustomPlatform[]): Promise<void> {
  await SecureStore.setItemAsync(CUSTOM_PLATFORMS_KEY, JSON.stringify(platforms));
}

export async function getCustomWiderWorldPlatforms(): Promise<WiderWorldCustomPlatform[]> {
  const raw = await SecureStore.getItemAsync(CUSTOM_PLATFORMS_KEY);
  return raw ? (JSON.parse(raw) as WiderWorldCustomPlatform[]) : [];
}

/** Added to a shared pool selectable from every context's row, not scoped to whichever context was open when it was added — matches presets' own always-available behaviour. */
export async function addCustomWiderWorldPlatform(name: string): Promise<WiderWorldCustomPlatform[]> {
  const trimmed = name.trim();
  if (!trimmed) return getCustomWiderWorldPlatforms();

  const current = await getCustomWiderWorldPlatforms();
  const next = [...current, { id: generateId(), name: trimmed }];
  await writeCustomPlatforms(next);
  return next;
}

export interface SelectableWiderWorldPlatform {
  id: string;
  name: string;
  icon?: WiderWorldPresetPlatform["icon"];
  expiresAfterHours?: number;
  characterLimit?: number;
  isCustom: boolean;
}

/** Presets first (fixed, alphabetical), then custom platforms in the order they were added — the full pool every context's pill row selects from. */
export async function getSelectableWiderWorldPlatforms(): Promise<SelectableWiderWorldPlatform[]> {
  const custom = await getCustomWiderWorldPlatforms();
  return [
    ...WIDER_WORLD_PRESET_PLATFORMS.map((preset) => ({ ...preset, isCustom: false })),
    ...custom.map((platform) => ({ ...platform, isCustom: true }))
  ];
}

export function findSelectableWiderWorldPlatformName(
  id: string,
  custom: WiderWorldCustomPlatform[]
): string | undefined {
  return findWiderWorldPreset(id)?.name ?? custom.find((platform) => platform.id === id)?.name;
}

async function writeExpiryOptIns(optIns: WiderWorldExpiryReminderOptIn[]): Promise<void> {
  await SecureStore.setItemAsync(EXPIRY_OPT_INS_KEY, JSON.stringify(optIns));
}

export async function getWiderWorldExpiryReminderOptIns(): Promise<WiderWorldExpiryReminderOptIn[]> {
  const raw = await SecureStore.getItemAsync(EXPIRY_OPT_INS_KEY);
  return raw ? (JSON.parse(raw) as WiderWorldExpiryReminderOptIn[]) : [];
}

/**
 * Off by default, per pairing — only ever set while the person is well,
 * not mid-flow (Settings, never Going Quiet/Reconnect). Eligibility itself
 * (whether this pairing's platform actually has an expiry at all) is the
 * caller's responsibility to check against the platform's own
 * `expiresAfterHours` before offering this — this function doesn't
 * validate that, so it stays platform-agnostic rather than importing
 * preset knowledge into what's otherwise a generic on/off record.
 */
export async function setWiderWorldExpiryReminderOptIn(
  contextId: string,
  platformId: string,
  optedIn: boolean
): Promise<WiderWorldExpiryReminderOptIn[]> {
  const current = await getWiderWorldExpiryReminderOptIns();
  const withoutPair = current.filter((entry) => !(entry.contextId === contextId && entry.platformId === platformId));
  const next = optedIn ? [...withoutPair, { contextId, platformId, optedInAt: Date.now() }] : withoutPair;
  await writeExpiryOptIns(next);
  return next;
}

export async function deleteAllWiderWorldContexts(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(CONTEXTS_KEY),
    SecureStore.deleteItemAsync(CUSTOM_PLATFORMS_KEY),
    SecureStore.deleteItemAsync(EXPIRY_OPT_INS_KEY)
  ]);
}

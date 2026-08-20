import * as SecureStore from "expo-secure-store";
import type { WiderWorldPlatform } from "@/types/hold";

const PLATFORMS_KEY = "hold.widerWorld.platforms";

/**
 * The person's own configured list of "wider world" platforms — Instagram,
 * WhatsApp, whatever they actually use — set via the "Your Wider World"
 * settings screen. No built-in default list: an empty result here is what
 * makes both the "Where did you post this?" step (Going Quiet) and the
 * taken-down checklist (Reconnect) show nothing at all, rather than a
 * generic platform list the person never asked for. See
 * docs/09-decision-log.md, 2026-08-21.
 */
export async function getWiderWorldPlatforms(): Promise<WiderWorldPlatform[]> {
  const raw = await SecureStore.getItemAsync(PLATFORMS_KEY);
  return raw ? (JSON.parse(raw) as WiderWorldPlatform[]) : [];
}

async function writePlatforms(platforms: WiderWorldPlatform[]): Promise<void> {
  await SecureStore.setItemAsync(PLATFORMS_KEY, JSON.stringify(platforms));
}

export async function addWiderWorldPlatform(name: string): Promise<WiderWorldPlatform[]> {
  const trimmed = name.trim();
  if (!trimmed) return getWiderWorldPlatforms();

  const current = await getWiderWorldPlatforms();
  const platform: WiderWorldPlatform = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed
  };
  const next = [...current, platform];
  await writePlatforms(next);
  return next;
}

export async function removeWiderWorldPlatform(id: string): Promise<WiderWorldPlatform[]> {
  const current = await getWiderWorldPlatforms();
  const next = current.filter((platform) => platform.id !== id);
  await writePlatforms(next);
  return next;
}

/**
 * Renames a platform in place, keeping its id — deliberately not
 * remove-then-re-add, which would mint a new id and silently orphan any
 * period's already-recorded `widerWorldPostedPlatforms` entry for it
 * mid-session (rare but real: renaming a platform in Settings while a
 * Going Quiet/Reconnect flow that already referenced it is still open).
 */
export async function renameWiderWorldPlatform(id: string, name: string): Promise<WiderWorldPlatform[]> {
  const trimmed = name.trim();
  if (!trimmed) return getWiderWorldPlatforms();

  const current = await getWiderWorldPlatforms();
  const next = current.map((platform) => (platform.id === id ? { ...platform, name: trimmed } : platform));
  await writePlatforms(next);
  return next;
}

export async function deleteAllWiderWorldPlatforms(): Promise<void> {
  await SecureStore.deleteItemAsync(PLATFORMS_KEY);
}

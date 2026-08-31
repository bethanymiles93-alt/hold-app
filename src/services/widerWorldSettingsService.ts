import * as SecureStore from "expo-secure-store";

const PLATFORMS_KEY = "hold.widerWorld.platforms";

/**
 * Legacy key only, as of 2026-08-31 — the platform list this used to
 * manage (`getWiderWorldPlatforms`/`add`/`remove`/`renameWiderWorldPlatform`)
 * was superseded by `widerWorldContextService.ts`'s Context system, which
 * every real caller (`app/settings/wider-world.tsx`,
 * `app/return/reconnect.tsx`, `app/create/people.tsx`,
 * `WiderWorldPlatformRow.tsx`) already uses under a different storage
 * key. Those four functions had zero remaining callers and were removed
 * as dead code, found in an overnight sweep. This one function stays so
 * "Delete my data" still clears the old key on a device that set it
 * before the redesign — harmless on a device that never did.
 */
export async function deleteAllWiderWorldPlatforms(): Promise<void> {
  await SecureStore.deleteItemAsync(PLATFORMS_KEY);
}

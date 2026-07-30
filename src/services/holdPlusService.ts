import * as SecureStore from "expo-secure-store";

const HOLD_PLUS_ACTIVE_KEY = "hold.holdplus.active";

/**
 * Placeholder entitlement check — Hold+ isn't open for purchase yet (see
 * app/settings/hold-plus.tsx), so this is a locally-persisted dev/test flag,
 * not real purchase verification. Every consumer should go through this
 * function so swapping in genuine entitlement logic later is a one-file
 * change.
 */
export async function isHoldPlusActive(): Promise<boolean> {
  return (await SecureStore.getItemAsync(HOLD_PLUS_ACTIVE_KEY)) === "true";
}

export async function setHoldPlusActive(active: boolean): Promise<void> {
  if (active) {
    await SecureStore.setItemAsync(HOLD_PLUS_ACTIVE_KEY, "true");
  } else {
    await SecureStore.deleteItemAsync(HOLD_PLUS_ACTIVE_KEY);
  }
}

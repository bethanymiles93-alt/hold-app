// expo-file-system's default export is SDK 57's newer class-based API
// (File/Directory/Paths) — its own legacy* re-exports are typed but
// documented to throw at runtime. `/legacy` is Expo's own stated
// migration path for code that wants the stable writeAsStringAsync/
// cacheDirectory surface, which is what this uses.
import * as FileSystem from "expo-file-system/legacy";
import * as LocalAuthentication from "expo-local-authentication";
import * as Sharing from "expo-sharing";
import { formatHistoryExportText } from "@/utils/historyExportFormat";
import type { HoldPeriod } from "@/types/hold";

/**
 * History's own export — separate from the free opt-in backup/sync
 * feature (which uses optional sign-in and stays a genuinely different
 * thing), and separate from the paid Patterns Report (not yet built,
 * expected to warrant a real PDF later since people pay for it — this
 * deliberately doesn't build shared export infrastructure assuming
 * Patterns needs the same treatment). Plain text only, for now: avoids
 * the expo-print dependency entirely, keeps this lightweight, matches
 * History's own stated identity ("just the record, nothing else"). See
 * docs/09-decision-log.md, 2026-08-29.
 */
export { formatHistoryExportText };

export type HistoryExportResult =
  | { ok: true }
  | {
      ok: false;
      reason: "auth-unavailable" | "auth-failed" | "auth-cancelled" | "sharing-unavailable" | "no-cache-directory";
    };

/**
 * Gated behind device-level reauthentication at the moment of export, not
 * app-wide — this is the point the data actually leaves the device.
 * `requireConfirmation` disabled deliberately: Face ID's own default
 * fallback-to-passcode behaviour is what we want, no extra in-app
 * confirmation step layered on top of the OS's own prompt.
 */
export async function requestHistoryExport(periods: HoldPeriod[]): Promise<HistoryExportResult> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!hasHardware || !isEnrolled) return { ok: false, reason: "auth-unavailable" };

  const auth = await LocalAuthentication.authenticateAsync({
    promptMessage: "Confirm to export your Hold History",
    disableDeviceFallback: false
  });
  if (!auth.success) {
    return { ok: false, reason: auth.error === "user_cancel" ? "auth-cancelled" : "auth-failed" };
  }

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) return { ok: false, reason: "sharing-unavailable" };

  if (!FileSystem.cacheDirectory) return { ok: false, reason: "no-cache-directory" };

  const text = formatHistoryExportText(periods);
  const fileUri = `${FileSystem.cacheDirectory}hold-history-${Date.now()}.txt`;
  await FileSystem.writeAsStringAsync(fileUri, text, { encoding: FileSystem.EncodingType.UTF8 });

  await Sharing.shareAsync(fileUri, { mimeType: "text/plain", dialogTitle: "Your Hold History" });

  return { ok: true };
}

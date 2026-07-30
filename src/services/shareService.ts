import { Share } from "react-native";

export interface ShareResult {
  completed: boolean;
  /** Which share-sheet target was used, e.g. a bundle id — iOS only, never present on Android. */
  activityType?: string | null;
}

/**
 * Opens the native share sheet.
 *
 * A resolved result does not always prove that a recipient received the message,
 * so the interface says "share" rather than promising delivery.
 */
export async function shareMessage(message: string): Promise<ShareResult> {
  const result = await Share.share({ message });

  return {
    completed: result.action === Share.sharedAction,
    activityType: result.action === Share.sharedAction ? (result.activityType ?? null) : null
  };
}

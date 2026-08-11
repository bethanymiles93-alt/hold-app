import * as SMS from "expo-sms";
import { shareMessage } from "@/services/shareService";

export type SendChannel = { type: "sms" } | { type: "shared"; activityType: string | null };

export async function isSmsAvailable(): Promise<boolean> {
  return SMS.isAvailableAsync();
}

/**
 * Opens the native Messages compose screen, pre-filled and addressed to every
 * given number as one thread. The user still has to tap Send themselves — iOS
 * gives no way for an app to send an SMS without that native compose screen.
 */
export async function sendTextMessage(numbers: string[], message: string): Promise<void> {
  await SMS.sendSMSAsync(numbers, message);
}

/**
 * SMS when there are numbers to text and it's available, otherwise the share
 * sheet. Used anywhere a message needs to go out directly — Going Quiet's
 * group and individual sends, Conversations' bulk/quick sends, Taking Time's
 * update.
 */
export async function sendOrShare(numbers: string[], message: string): Promise<SendChannel> {
  if (numbers.length > 0 && (await isSmsAvailable())) {
    await sendTextMessage(numbers, message);
    return { type: "sms" };
  }

  const result = await shareMessage(message);
  return { type: "shared", activityType: result.activityType ?? null };
}

/**
 * A flat, storable key for a SendChannel — "sms", "shared", or
 * "shared:<iOS activityType>" when the OS reported one. Process metadata
 * only: which app/route a message went out through, never its content.
 */
export function channelKey(channel: SendChannel): string {
  if (channel.type === "sms") return "sms";
  return channel.activityType ? `shared:${channel.activityType}` : "shared";
}

export interface CircleDeliveryTarget {
  circleId: string;
  /** Default false — see CircleGroup.sendAsGroup. */
  sendAsGroup: boolean;
  numbers: string[];
}

/**
 * Sends one message to several Circles at once, honouring each Circle's own
 * delivery setting independently within the same call — a mixed combination
 * (some group, some individual) is expected, not an edge case (2026-08-11,
 * correcting an earlier instruction that had every combination send as one
 * shared group message unconditionally). `sendAsGroup: true` opens one
 * compose sheet addressed to everyone in that Circle, same as before.
 * `sendAsGroup: false` (the default) opens one compose sheet PER RECIPIENT
 * in that Circle, sequentially — recipients never see each other, but the
 * person sending has to tap through/send each one individually, since
 * neither iOS nor Android lets an app dispatch an SMS without the user
 * completing the native compose screen themselves. A Circle with several
 * members set to individual delivery means several separate compose taps
 * for one "Send," not one. See docs/09-decision-log.md, 2026-08-11.
 */
export async function sendToCircles(
  targets: CircleDeliveryTarget[],
  message: string
): Promise<Map<string, SendChannel>> {
  const channelByCircle = new Map<string, SendChannel>();

  for (const target of targets) {
    if (target.numbers.length === 0) continue;

    if (target.sendAsGroup) {
      try {
        const channel = await sendOrShare(target.numbers, message);
        channelByCircle.set(target.circleId, channel);
      } catch {
        // Move on even if this compose sheet was dismissed.
      }
      continue;
    }

    let lastChannel: SendChannel | null = null;
    for (const number of target.numbers) {
      try {
        lastChannel = await sendOrShare([number], message);
      } catch {
        // Move on to the next recipient even if this compose sheet was dismissed.
      }
    }
    if (lastChannel) channelByCircle.set(target.circleId, lastChannel);
  }

  return channelByCircle;
}

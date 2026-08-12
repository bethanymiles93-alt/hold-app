import { Linking } from "react-native";
import * as SMS from "expo-sms";
import { shareMessage } from "@/services/shareService";
import type { SendingChannel } from "@/services/sendingPreferencesService";

export type SendChannel =
  | { type: "sms" }
  | { type: "shared"; activityType: string | null }
  | { type: "whatsapp" };

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
 * A flat, storable key for a SendChannel — "sms", "whatsapp", "shared", or
 * "shared:<iOS activityType>" when the OS reported one. Process metadata
 * only: which app/route a message went out through, never its content.
 */
export function channelKey(channel: SendChannel): string {
  if (channel.type === "sms") return "sms";
  if (channel.type === "whatsapp") return "whatsapp";
  return channel.activityType ? `shared:${channel.activityType}` : "shared";
}

/**
 * Deep-links directly to one WhatsApp conversation, pre-filled — WhatsApp's
 * own scheme only ever addresses a single phone number, there's no way to
 * deep-link into a group (confirmed; see sendToCircles below for how a
 * "send as group" Circle handles this instead). Falls back to the native
 * share sheet if the scheme can't be opened (WhatsApp not installed, or —
 * on Android — the app hasn't granted this package-visibility query;
 * see docs/09-decision-log.md, 2026-08-13 for the native-config caveat).
 * Numbers are best-effort normalised (digits only, no leading "+") since
 * contacts aren't guaranteed to be stored in international format — the
 * same ambiguity native SMS composition already has to live with.
 */
export async function sendViaWhatsApp(phoneNumber: string, message: string): Promise<SendChannel> {
  const digitsOnly = phoneNumber.replace(/[^\d+]/g, "").replace(/^\+/, "");
  const url = `whatsapp://send?phone=${digitsOnly}&text=${encodeURIComponent(message)}`;
  const canOpen = await Linking.canOpenURL(url).catch(() => false);

  if (!canOpen) {
    const result = await shareMessage(message);
    return { type: "shared", activityType: result.activityType ?? null };
  }

  await Linking.openURL(url);
  return { type: "whatsapp" };
}

/**
 * Individual/BCC-style delivery for one recipient, honouring the given
 * default channel — SMS (the existing sendOrShare) or a WhatsApp deep
 * link. Scoped deliberately to Going Quiet/Reconnect's per-Circle
 * individual delivery specifically (2026-08-13) — every other one-off
 * send in the app (Library's quick message, Taking Time's update,
 * Personalise replies, the safeguarding notify) stays on plain
 * sendOrShare/SMS, unaffected by this preference. See
 * docs/09-decision-log.md.
 */
export async function sendIndividual(
  phoneNumber: string,
  message: string,
  channel: SendingChannel
): Promise<SendChannel> {
  return channel === "whatsapp" ? sendViaWhatsApp(phoneNumber, message) : sendOrShare([phoneNumber], message);
}

/**
 * Group delivery for a Circle with sendAsGroup on, honouring the given
 * default channel. SMS: the existing sendOrShare, a genuine multi-
 * recipient thread. WhatsApp: there is no deep link for an existing
 * WhatsApp group, so this opens the native OS share sheet with the
 * message pre-loaded instead — WhatsApp appears there as a target, and
 * selecting it hands off to WhatsApp's OWN conversation picker (which
 * does include existing groups) to finish the send. One extra manual tap
 * (picking the group inside WhatsApp) compared to individual delivery,
 * traded for genuine group messaging rather than silently substituting a
 * different channel. See docs/09-decision-log.md, 2026-08-13.
 */
async function sendGroup(numbers: string[], message: string, channel: SendingChannel): Promise<SendChannel> {
  if (channel === "whatsapp") {
    const result = await shareMessage(message);
    return { type: "shared", activityType: result.activityType ?? null };
  }
  return sendOrShare(numbers, message);
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
 * for one "Send," not one. `defaultChannel` (2026-08-13) picks SMS vs
 * WhatsApp for both paths — see sendIndividual/sendGroup above for what
 * each one does per channel. See docs/09-decision-log.md, 2026-08-11.
 */
export async function sendToCircles(
  targets: CircleDeliveryTarget[],
  message: string,
  defaultChannel: SendingChannel
): Promise<Map<string, SendChannel>> {
  const channelByCircle = new Map<string, SendChannel>();

  for (const target of targets) {
    if (target.numbers.length === 0) continue;

    if (target.sendAsGroup) {
      try {
        const channel = await sendGroup(target.numbers, message, defaultChannel);
        channelByCircle.set(target.circleId, channel);
      } catch {
        // Move on even if this compose sheet was dismissed.
      }
      continue;
    }

    let lastChannel: SendChannel | null = null;
    for (const number of target.numbers) {
      try {
        lastChannel = await sendIndividual(number, message, defaultChannel);
      } catch {
        // Move on to the next recipient even if this compose sheet was dismissed.
      }
    }
    if (lastChannel) channelByCircle.set(target.circleId, lastChannel);
  }

  return channelByCircle;
}

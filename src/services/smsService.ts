import { AppState, Linking } from "react-native";
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
 * Deep-links directly to one WhatsApp conversation, pre-filled, via
 * WhatsApp's own "Click to Chat" web endpoint (https://wa.me/) rather than
 * the whatsapp:// custom scheme used previously. wa.me only ever addresses
 * a single phone number, there's no way to deep-link into a group
 * (confirmed; see sendToCircles below for how a "send as group" Circle
 * handles this instead).
 *
 * Switched from whatsapp://send (2026-08-29): a custom-scheme URL needs
 * LSApplicationQueriesSchemes on iOS / a <queries> declaration on Android
 * before Linking.canOpenURL will ever return true for it — neither was
 * actually present in this app's native config, so the old path silently
 * fell through to the share-sheet fallback on every device, never once
 * opening WhatsApp directly. https:// needs no such whitelist entry; it
 * always opens (WhatsApp itself, if installed and registered for the
 * universal link, otherwise a browser landing page with its own
 * "Continue to Chat" option), so there's no reliable "can this open"
 * check left to make — canOpenURL is gone, not just unused.
 *
 * The number is best-effort normalised (digits only, no leading "+") since
 * contacts aren't guaranteed to be stored in international format — the
 * same ambiguity native SMS composition already has to live with.
 */
export async function sendViaWhatsApp(phoneNumber: string, message: string): Promise<SendChannel> {
  const digitsOnly = phoneNumber.replace(/[^\d+]/g, "").replace(/^\+/, "");
  const url = `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;

  try {
    await Linking.openURL(url);
    return { type: "whatsapp" };
  } catch {
    const result = await shareMessage(message);
    return { type: "shared", activityType: result.activityType ?? null };
  }
}

/**
 * Resolves once the app has left the foreground and come back — used after
 * opening a WhatsApp deep link, since Linking.openURL resolves the instant
 * the app switch happens, not when the person's actually done in WhatsApp
 * and returned. Without this, a sequential multi-recipient WhatsApp send
 * would fire every deep link back-to-back in the same tick, and only the
 * last one would ever actually surface. SMS and the share sheet don't need
 * this — their own promises already resolve on the native compose
 * sheet/share sheet being dismissed. See docs/09-decision-log.md, 2026-08-29.
 */
function waitForReturnFromExternalApp(): Promise<void> {
  return new Promise((resolve) => {
    let leftForeground = false;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        leftForeground = true;
        return;
      }
      if (!leftForeground) return;
      subscription.remove();
      resolve();
    });
  });
}

/**
 * Individual/BCC-style delivery for one recipient, honouring the given
 * channel — SMS (the existing sendOrShare) or a WhatsApp deep link. Scoped
 * deliberately to Going Quiet/Reconnect's per-Circle individual delivery
 * specifically (2026-08-13) — every other one-off send in the app
 * (Library's quick message, Taking Time's update, Personalise replies, the
 * safeguarding notify) stays on plain sendOrShare/SMS, unaffected by this
 * preference. See docs/09-decision-log.md.
 *
 * `channel` is whatever the caller already resolved — a per-contact
 * preferredChannel if that contact has one set, otherwise the global
 * default. This function doesn't know or care which; see sendToCircles for
 * where that fallback actually happens.
 *
 * Every sequential-send loop in this file calls through here, so the
 * WhatsApp foreground-return wait (2026-08-29) lives in exactly one place
 * rather than being duplicated at each call site.
 */
export async function sendIndividual(
  phoneNumber: string,
  message: string,
  channel: SendingChannel
): Promise<SendChannel> {
  if (channel !== "whatsapp") return sendOrShare([phoneNumber], message);

  const result = await sendViaWhatsApp(phoneNumber, message);
  if (result.type === "whatsapp") await waitForReturnFromExternalApp();
  return result;
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

export interface CircleDeliveryContact {
  phoneNumber: string;
  /** This one person's own channel override, if they have one set in Manage Circles. Falls back to defaultChannel when unset. */
  preferredChannel?: SendingChannel;
}

export interface CircleDeliveryTarget {
  circleId: string;
  /** Default false — see CircleGroup.sendAsGroup. */
  sendAsGroup: boolean;
  contacts: CircleDeliveryContact[];
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
 *
 * Per-contact `preferredChannel` (2026-08-29) only ever applies to
 * individual delivery — a group send is one shared message through one
 * channel, so there's no per-recipient choice left to honour once
 * `sendAsGroup` is on; that path still uses `defaultChannel` only.
 *
 * **Returned map's keys, corrected 2026-09-01**: a `sendAsGroup` Circle
 * is still keyed by its own `circleId` alone (one channel for the whole
 * group). An individually-delivered Circle is keyed per contact
 * (`${circleId}:${phoneNumber}`) instead — recipients can genuinely use
 * different channels from each other via `preferredChannel`, and this
 * used to collapse to whichever contact was processed last, silently
 * discarding the rest (a real bug: a WhatsApp send could show as "Sent
 * via Text message" in History if an SMS-channel contact happened to be
 * last). Both callers (`people.tsx`, `reconnect.tsx`) already treat this
 * map's keys as opaque IDs passed straight to `recordSendChannel`, never
 * re-interpreted as a real circle lookup, so this doesn't need any
 * caller-side change. `summariseSendChannels` (holdHistoryFormat.ts)
 * already deduplicates by value, so a Circle where everyone used the
 * same channel still shows exactly one label — this only changes the
 * outcome for a genuinely mixed Circle. See docs/09-decision-log.md.
 */
export async function sendToCircles(
  targets: CircleDeliveryTarget[],
  message: string,
  defaultChannel: SendingChannel
): Promise<Map<string, SendChannel>> {
  const channelByCircle = new Map<string, SendChannel>();

  for (const target of targets) {
    if (target.contacts.length === 0) continue;

    if (target.sendAsGroup) {
      try {
        const channel = await sendGroup(
          target.contacts.map((contact) => contact.phoneNumber),
          message,
          defaultChannel
        );
        channelByCircle.set(target.circleId, channel);
      } catch {
        // Move on even if this compose sheet was dismissed.
      }
      continue;
    }

    // **Bug fixed 2026-09-01**: this used to track one `lastChannel`
    // across the whole loop and record only that against the Circle,
    // silently discarding every earlier contact's own channel — with
    // per-contact `preferredChannel` overrides (2026-08-29), a Circle's
    // individual-delivery recipients can genuinely use different
    // channels from each other, and the last one processed simply
    // overwrote the rest. Confirmed on-device: a WhatsApp send showed as
    // "Sent via Text message" in History because an SMS-channel contact
    // happened to be last in the loop. Now records one entry per
    // contact, keyed by circleId:phoneNumber rather than circleId alone
    // — summariseSendChannels (holdHistoryFormat.ts) already
    // deduplicates by value, so a Circle where everyone used the same
    // channel still shows exactly one label, same as before; a genuinely
    // mixed Circle now correctly shows every channel actually used. See
    // docs/09-decision-log.md.
    for (const contact of target.contacts) {
      try {
        const channel = await sendIndividual(contact.phoneNumber, message, contact.preferredChannel ?? defaultChannel);
        channelByCircle.set(`${target.circleId}:${contact.phoneNumber}`, channel);
      } catch {
        // Move on to the next recipient even if this compose sheet was dismissed.
      }
    }
  }

  return channelByCircle;
}

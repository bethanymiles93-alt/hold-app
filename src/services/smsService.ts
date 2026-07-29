import * as SMS from "expo-sms";
import { shareMessage } from "@/services/shareService";

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
export async function sendOrShare(numbers: string[], message: string): Promise<void> {
  if (numbers.length > 0 && (await isSmsAvailable())) {
    await sendTextMessage(numbers, message);
  } else {
    await shareMessage(message);
  }
}

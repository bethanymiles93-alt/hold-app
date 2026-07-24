import * as SMS from "expo-sms";

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

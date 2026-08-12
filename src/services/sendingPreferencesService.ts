import * as SecureStore from "expo-secure-store";

const DEFAULT_CHANNEL_KEY = "hold.sending.defaultChannel";

export type SendingChannel = "sms" | "whatsapp";

/** SMS is the standing default — unchanged behaviour for anyone who's never visited the setting. */
export async function getDefaultSendingChannel(): Promise<SendingChannel> {
  const stored = await SecureStore.getItemAsync(DEFAULT_CHANNEL_KEY);
  return stored === "whatsapp" ? "whatsapp" : "sms";
}

export async function setDefaultSendingChannel(channel: SendingChannel): Promise<void> {
  await SecureStore.setItemAsync(DEFAULT_CHANNEL_KEY, channel);
}

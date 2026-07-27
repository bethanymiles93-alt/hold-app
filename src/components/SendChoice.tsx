import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { theme } from "@/constants/theme";
import { shareMessage } from "@/services/shareService";
import { isSmsAvailable, sendTextMessage } from "@/services/smsService";

interface SendChoiceProps {
  recipientLabel: string;
  numbers: string[];
  message: string;
  disabled?: boolean;
  onSent: () => void | Promise<void>;
}

export function SendChoice({
  recipientLabel,
  numbers,
  message,
  disabled = false,
  onSent
}: SendChoiceProps) {
  const [smsAvailable, setSmsAvailable] = useState(false);

  useEffect(() => {
    void isSmsAvailable().then(setSmsAvailable);
  }, []);

  const showTextOption = numbers.length > 0 && smsAvailable;

  const sendViaText = async () => {
    if (numbers.length === 0) return;

    try {
      await sendTextMessage(numbers, message.trim());
      await onSent();
    } catch {
      Alert.alert(
        "Couldn’t open Messages",
        "Your message is still here. Please try again when you’re ready."
      );
    }
  };

  const sendViaShare = async () => {
    try {
      await shareMessage(message.trim());
      await onSent();
    } catch {
      Alert.alert(
        "Couldn’t open sharing",
        "Your message is still here. Please try again when you’re ready."
      );
    }
  };

  if (!showTextOption) {
    return (
      <PrimaryButton
        disabled={disabled}
        label="Share another way"
        onPress={() => void sendViaShare()}
      />
    );
  }

  const primary = { label: `Text ${recipientLabel}`, onPress: sendViaText };
  const secondary = { label: "Share another way", onPress: sendViaShare };

  return (
    <View style={styles.stack}>
      <PrimaryButton disabled={disabled} label={primary.label} onPress={() => void primary.onPress()} />
      <SecondaryButton disabled={disabled} label={secondary.label} onPress={() => void secondary.onPress()} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.md
  }
});

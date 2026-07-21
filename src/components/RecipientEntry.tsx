import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { theme } from "@/constants/theme";

interface RecipientEntryProps {
  recipients: string[];
  onChange: (recipients: string[]) => void;
}

export function RecipientEntry({
  recipients,
  onChange
}: RecipientEntryProps) {
  const [value, setValue] = useState("");

  const addRecipient = () => {
    const name = value.trim();

    if (!name) return;

    if (!recipients.some((item) => item.toLowerCase() === name.toLowerCase())) {
      onChange([...recipients, name]);
    }

    setValue("");
  };

  const removeRecipient = (name: string) => {
    onChange(recipients.filter((item) => item !== name));
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel="Name of person to add"
          autoCapitalize="words"
          onChangeText={setValue}
          onSubmitEditing={addRecipient}
          placeholder="Name"
          placeholderTextColor={theme.colors.textMuted}
          returnKeyType="done"
          style={styles.input}
          value={value}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add person"
          disabled={!value.trim()}
          onPress={addRecipient}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addPressed,
            !value.trim() && styles.disabled
          ]}
        >
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>

      <View style={styles.chips}>
        {recipients.map((name) => (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${name}`}
            onPress={() => removeRecipient(name)}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{name} ×</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.note}>
        For this first version, names stay in the current app session. Hold does not upload your address book.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg
  },
  inputRow: {
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  input: {
    flex: 1,
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 17,
    backgroundColor: theme.colors.white
  },
  addButton: {
    minWidth: 72,
    minHeight: 54,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  addPressed: {
    backgroundColor: theme.colors.primaryPressed
  },
  disabled: {
    opacity: 0.4
  },
  addText: {
    color: theme.colors.onPrimary,
    fontSize: 16,
    fontWeight: "600"
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceStrong,
    paddingHorizontal: theme.spacing.md
  },
  chipText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "500"
  },
  note: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 21
  }
});

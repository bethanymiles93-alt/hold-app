import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { theme } from "@/constants/theme";
import type { CircleGroup } from "@/types/hold";

export interface GoingQuietRecipient {
  contactId: string;
  name: string;
  phoneNumber: string;
  circleName: string;
  included: boolean;
  personalisedMessage: string | null;
}

export function buildGoingQuietRecipients(groups: CircleGroup[]): GoingQuietRecipient[] {
  const seen = new Set<string>();
  const recipients: GoingQuietRecipient[] = [];

  for (const group of groups) {
    for (const contact of group.contacts) {
      if (seen.has(contact.phoneNumber)) continue;
      seen.add(contact.phoneNumber);
      recipients.push({
        contactId: contact.id,
        name: contact.name,
        phoneNumber: contact.phoneNumber,
        circleName: group.name,
        included: true,
        personalisedMessage: null
      });
    }
  }

  return recipients;
}

interface RecipientSection {
  circleName: string;
  people: GoingQuietRecipient[];
}

function groupByCircle(recipients: GoingQuietRecipient[]): RecipientSection[] {
  const sections: RecipientSection[] = [];
  const indexByName = new Map<string, number>();

  for (const recipient of recipients) {
    let index = indexByName.get(recipient.circleName);
    if (index === undefined) {
      index = sections.length;
      indexByName.set(recipient.circleName, index);
      sections.push({ circleName: recipient.circleName, people: [] });
    }
    sections[index]?.people.push(recipient);
  }

  return sections;
}

interface RecipientPersonalisationProps {
  recipients: GoingQuietRecipient[];
  onRecipientsChange: (recipients: GoingQuietRecipient[]) => void;
  defaultMessage: string;
}

export function RecipientPersonalisation({
  recipients,
  onRecipientsChange,
  defaultMessage
}: RecipientPersonalisationProps) {
  if (recipients.length < 2) return null;

  const sections = groupByCircle(recipients);

  const update = (contactId: string, patch: Partial<GoingQuietRecipient>) => {
    onRecipientsChange(
      recipients.map((recipient) => (recipient.contactId === contactId ? { ...recipient, ...patch } : recipient))
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Who gets this</Text>
      <Text style={styles.helper}>
        Untick anyone who doesn’t need it this time, or personalise the message for one or two people.
      </Text>

      {sections.map((section) => (
        <View key={section.circleName} style={styles.section}>
          <Text style={styles.circleName}>{section.circleName}</Text>

          {section.people.map((recipient) => (
            <View key={recipient.contactId} style={styles.row}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: recipient.included }}
                onPress={() => update(recipient.contactId, { included: !recipient.included })}
                style={styles.tapArea}
              >
                <View style={[styles.checkbox, recipient.included && styles.checkboxChecked]} />
                <Text style={[styles.name, !recipient.included && styles.nameExcluded]}>
                  {recipient.name}
                </Text>
              </Pressable>

              {recipient.included ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    update(recipient.contactId, {
                      personalisedMessage: recipient.personalisedMessage === null ? defaultMessage : null
                    })
                  }
                >
                  <Text style={styles.linkText}>
                    {recipient.personalisedMessage === null ? "Personalise" : "Use default message"}
                  </Text>
                </Pressable>
              ) : null}

              {recipient.included && recipient.personalisedMessage !== null ? (
                <TextInput
                  accessibilityLabel={`Message for ${recipient.name}`}
                  multiline
                  onChangeText={(text) => update(recipient.contactId, { personalisedMessage: text })}
                  style={styles.input}
                  textAlignVertical="top"
                  value={recipient.personalisedMessage}
                />
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm
  },
  title: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "600"
  },
  helper: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  section: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm
  },
  circleName: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  row: {
    gap: theme.spacing.xs
  },
  tapArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: 40
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: theme.radius.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.primary
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary
  },
  name: {
    color: theme.colors.text,
    fontSize: 16
  },
  nameExcluded: {
    color: theme.colors.textMuted,
    textDecorationLine: "line-through"
  },
  linkText: {
    color: theme.colors.link,
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 32
  },
  input: {
    marginLeft: 32,
    minHeight: 60,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 21,
    backgroundColor: theme.colors.white
  }
});

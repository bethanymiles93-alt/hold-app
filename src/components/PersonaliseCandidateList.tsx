import { StyleSheet, View } from "react-native";
import { theme } from "@/constants/theme";
import { PersonaliseAccordion } from "@/components/PersonaliseAccordion";
import type { ConversationPerson } from "@/services/conversationService";
import type { ReturnStyle } from "@/types/hold";

const styles = StyleSheet.create({
  list: {
    gap: theme.spacing.md
  },
  row: {
    gap: theme.spacing.xs
  }
});

interface PersonaliseCandidateListProps {
  people: ConversationPerson[];
  expandedId: string | null;
  onToggle: (personId: string) => void;
  onSent: () => void;
  drafts: Record<string, string>;
  onChangeDraft: (personId: string, text: string) => void;
  styles: Record<string, ReturnStyle>;
  onChangeStyle: (personId: string, style: ReturnStyle) => void;
  replyTargetPersonId: string | null;
  onActivateReply: (
    personId: string,
    bundle: { onChangeText: (text: string) => void; friendMessage: string }
  ) => void;
}

/** Presentational — pairs with usePersonaliseCompletion, one row per candidate. */
export function PersonaliseCandidateList({
  people,
  expandedId,
  onToggle,
  onSent,
  drafts,
  onChangeDraft,
  styles: replyStyles,
  onChangeStyle,
  replyTargetPersonId,
  onActivateReply
}: PersonaliseCandidateListProps) {
  return (
    <View style={styles.list}>
      {people.map((person) => (
        <View key={person.id} style={styles.row}>
          <PersonaliseAccordion
            person={person}
            isOpen={expandedId === person.id}
            onToggle={() => onToggle(person.id)}
            onSent={onSent}
            draft={drafts[person.id] ?? ""}
            onChangeDraft={(text) => onChangeDraft(person.id, text)}
            style={replyStyles[person.id] ?? null}
            onChangeStyle={(style) => onChangeStyle(person.id, style)}
            isReplyActive={replyTargetPersonId === person.id}
            onActivateReply={(bundle) => onActivateReply(person.id, bundle)}
          />
        </View>
      ))}
    </View>
  );
}

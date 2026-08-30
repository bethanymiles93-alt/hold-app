import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { DropdownArrowBadge } from "@/components/DropdownArrowBadge";
import { PersonaliseAccordion } from "@/components/PersonaliseAccordion";
import { DockedFieldPreview } from "@/components/DockedFieldPreview";
import { CompactSendButton } from "@/components/CompactSendButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { DEFAULT_QUICK_MESSAGE, type UseConversationsReturn } from "@/hooks/useConversations";

interface ConversationsViewProps {
  conversations: UseConversationsReturn;
  /**
   * "browse" — Library's own standalone tab: circle-browsing/selection row,
   * only selected ungrouped people become cards, "+ New Circle" bundling.
   * "flat" — an embedded, already-scoped audience (Reconnect's own "want to
   * reply to anyone properly?" step): no browsing needed, every person in
   * scope renders as a card directly. Same card/accordion/actions either
   * way — this only changes whether there's a selection step in front of
   * them. See docs/09-decision-log.md, 2026-08-20.
   */
  mode: "browse" | "flat";
}

/**
 * The one Conversations rendering — extracted from `library.tsx` 2026-08-20
 * so Library's standalone tab and Reconnect's embedded step show the same
 * data, the same way, not two implementations independently reading the
 * same store. See `useConversations` for the shared state/query/actions
 * this pairs with, and the reasoning for why this mattered enough to
 * refactor rather than just patch the data layer.
 */
export function ConversationsView({ conversations: c, mode }: ConversationsViewProps) {
  const { colors } = useAppTheme("normal");
  const styles = createStyles(colors);

  const cardPeople = mode === "browse" ? c.ungroupedPeople.filter((person) => c.selectedIds.has(person.id)) : c.people;

  return (
    <>
      {c.stopPermissionShown ? (
        <Text style={styles.stopPermission}>You can stop here. What's sent is enough for today.</Text>
      ) : null}

      {mode === "browse" ? (
        <View style={styles.pinnedRow}>
          <AdaptiveCircleChip
            label="+"
            accessibilityLabel="Add person"
            accessibilityRole="button"
            outline
            isSelected={false}
            labelFontSize={28}
            labelBold
            onPress={c.addNewPerson}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            style={styles.pillScroll}
          >
            {c.allIds.length > 0 ? (
              <AdaptiveCircleChip
                label="All"
                isSelected={c.allSelected}
                labelBold
                onPress={c.toggleAll}
                accessibilityRole="button"
              />
            ) : null}

            {c.circleSections.map((section) => {
              const isExpanded = c.expandedCircleIds.has(section.circleId);

              return (
                <View key={section.circleId} style={styles.circleUnit}>
                  <AdaptiveCircleChip
                    label={section.circleName}
                    isSelected={isExpanded}
                    onPress={() => c.toggleCircleExpanded(section.circleId)}
                    accessibilityRole="button"
                    accessibilityLabel={`${section.circleName}, ${isExpanded ? "hide" : "show"} people`}
                  />
                  <DropdownArrowBadge
                    expanded={isExpanded}
                    onPress={() => c.toggleCircleExpanded(section.circleId)}
                    accessibilityLabel={`${section.circleName}, ${isExpanded ? "hide" : "show"} people`}
                    style={styles.arrowButton}
                  />
                </View>
              );
            })}

            {c.ungroupedPeople.map((person) => {
              const isSelected = c.selectedIds.has(person.id);
              const sentLook = person.completed && !isSelected;

              return (
                <AdaptiveCircleChip
                  key={person.id}
                  label={person.name}
                  compact
                  isSelected={isSelected}
                  hasSentThisSession={person.completed}
                  onPress={() => c.toggleId(person.id)}
                  accessibilityRole="button"
                  accessibilityLabel={sentLook ? `${person.name}, already sent. Tap to send another message.` : person.name}
                />
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {mode === "browse" && c.expandedPeople.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {c.expandedPeople.map((person) => {
            const isOpen = c.expandedPersonaliseId === person.id;
            const sentLook = person.completed && !isOpen;

            return (
              <AdaptiveCircleChip
                key={person.id}
                label={person.name}
                compact
                isSelected={isOpen}
                hasSentThisSession={person.completed}
                onPress={() => c.togglePersonalisePerson(person.id)}
                accessibilityRole="button"
                accessibilityLabel={sentLook ? `${person.name}, already replied to. Tap to send another message.` : person.name}
              />
            );
          })}
        </ScrollView>
      ) : null}

      {mode === "browse" && c.expandedPersonalisePerson
        ? (() => {
            const expandedPerson = c.expandedPersonalisePerson;
            return (
              <PersonaliseAccordion
                person={expandedPerson}
                isOpen
                onToggle={() => c.togglePersonalisePerson(expandedPerson.id)}
                onSent={(sentText) => c.onSentFromAccordion(expandedPerson.id, sentText)}
                onInsertLastSent={c.setPendingInsertText}
                draft={c.personaliseDrafts[expandedPerson.id] ?? ""}
                onChangeDraft={(text) =>
                  c.setPersonaliseDrafts((current) => ({ ...current, [expandedPerson.id]: text }))
                }
                style={c.personaliseStyles[expandedPerson.id] ?? null}
                onChangeStyle={(style) =>
                  c.setPersonaliseStyles((current) => ({ ...current, [expandedPerson.id]: style }))
                }
                isReplyActive={c.personaliseReplyTarget?.personId === expandedPerson.id}
                onActivateReply={(bundle) => c.setPersonaliseReplyTarget({ personId: expandedPerson.id, ...bundle })}
              />
            );
          })()
        : null}

      <View style={styles.cardList}>
        {cardPeople.map((person, index) => {
          const selectedForCircle = c.selectedOtherIds.has(person.id);
          // Explicit visual marker for a still-grouped linked cluster —
          // confirmed needed on top of the adjacency ordering
          // sortByLinkedClusterAdjacency already applies, since ordering
          // alone doesn't read as "these are connected" without also
          // looking at circle names. A left-edge line, same colour
          // LinkedCircleCluster's own connecting line uses when grouped
          // (colors.primary) — the label appears once, on the first card
          // of each cluster's run, not repeated on every card in it. See
          // docs/09-decision-log.md, 2026-08-21.
          const clusterKey = c.linkedClusterKeyByPersonId.get(person.id);
          const previousPerson = index > 0 ? cardPeople[index - 1] : undefined;
          const previousClusterKey = previousPerson ? c.linkedClusterKeyByPersonId.get(previousPerson.id) : undefined;
          const isFirstInCluster = clusterKey !== undefined && clusterKey !== previousClusterKey;

          return (
            <View key={person.id} style={[styles.card, clusterKey !== undefined && styles.cardLinked]}>
              {isFirstInCluster ? <Text style={styles.linkedLabel}>🔗 Linked</Text> : null}
              <View style={styles.cardHeader}>
                {mode === "browse" ? (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Select ${person.name} to group into a Circle`}
                    accessibilityState={{ checked: selectedForCircle }}
                    onPress={() => c.toggleOtherSelection(person)}
                  >
                    <Text style={[styles.cardTitle, selectedForCircle && styles.cardTitleSelected]}>
                      {person.name}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={styles.cardTitle}>{person.name}</Text>
                )}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${person.name}: Conversation complete`}
                  accessibilityState={{ checked: person.completed }}
                  onPress={() => c.markConversationComplete(person)}
                  hitSlop={8}
                  style={styles.conversationCompleteRow}
                >
                  <View style={[styles.checkbox, person.completed && styles.checkboxChecked]}>
                    {person.completed ? <Text style={styles.checkboxGlyph}>✓</Text> : null}
                  </View>
                  <Text style={styles.conversationCompleteLabel}>Conversation complete</Text>
                </Pressable>
              </View>

              {c.personaliseSwapIds.has(person.id) ? (
                <>
                  <PersonaliseAccordion
                    person={person}
                    isOpen={c.expandedPersonaliseId === person.id}
                    onToggle={() => c.togglePersonalisePerson(person.id)}
                    onSent={(sentText) => c.onSentFromAccordion(person.id, sentText)}
                    onInsertLastSent={c.setPendingInsertText}
                    draft={c.personaliseDrafts[person.id] ?? ""}
                    onChangeDraft={(text) => c.setPersonaliseDrafts((current) => ({ ...current, [person.id]: text }))}
                    style={c.personaliseStyles[person.id] ?? null}
                    onChangeStyle={(style) => c.setPersonaliseStyles((current) => ({ ...current, [person.id]: style }))}
                    isReplyActive={c.personaliseReplyTarget?.personId === person.id}
                    onActivateReply={(bundle) => c.setPersonaliseReplyTarget({ personId: person.id, ...bundle })}
                  />
                  <Pressable accessibilityRole="button" onPress={() => c.togglePersonaliseSwap(person.id)}>
                    <Text style={styles.linkText}>Use a quick message instead</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <DockedFieldPreview
                    value={c.individualMessages[person.id] ?? DEFAULT_QUICK_MESSAGE}
                    placeholder={`Message for ${person.name}`}
                    isActive={c.activeField === `individual-message:${person.id}`}
                    onPress={() => c.setActiveField(`individual-message:${person.id}`)}
                    accessibilityLabel={`Message for ${person.name}`}
                  />
                  <View style={styles.excludedActions}>
                    <CompactSendButton
                      disabled={!(c.individualMessages[person.id] ?? DEFAULT_QUICK_MESSAGE).trim()}
                      accessibilityLabel={`Send to ${person.name}`}
                      onPress={() => c.sendIndividual(person)}
                    />
                    <Pressable accessibilityRole="button" onPress={() => c.togglePersonaliseSwap(person.id)}>
                      <Text style={styles.linkText}>Conversations</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          );
        })}
      </View>

      {mode === "browse" && c.circlePromptStage === "confirm" ? (
        <View style={styles.createCirclePrompt}>
          <Text style={styles.createCirclePromptText}>Create a Circle for these people?</Text>
          <View style={styles.createCircleActions}>
            <SecondaryButton label="No" onPress={c.declineCreateCircle} />
            <SecondaryButton label="Yes" onPress={() => c.setActiveField(null)} />
          </View>
        </View>
      ) : null}
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    stopPermission: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: theme.spacing.sm
    },
    pinnedRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm
    },
    pillScroll: {
      flex: 1
    },
    chipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    circleUnit: {
      position: "relative",
      alignSelf: "flex-start"
    },
    arrowButton: {
      position: "absolute",
      right: 10,
      bottom: 12,
      alignItems: "center",
      justifyContent: "center"
    },
    cardList: {
      gap: theme.spacing.lg
    },
    card: {
      gap: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: theme.spacing.md
    },
    // Same colour LinkedCircleCluster's own connecting line uses while
    // grouped (colors.primary) — a left-edge "spine" reading as connected
    // when cards from the same cluster sit stacked directly beneath each
    // other, same as this component's own card list already renders them.
    cardLinked: {
      borderLeftWidth: 4,
      borderLeftColor: colors.primary
    },
    linkedLabel: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "700"
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center"
    },
    cardTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600"
    },
    cardTitleSelected: {
      color: colors.primary
    },
    conversationCompleteRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs
    },
    conversationCompleteLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600"
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: theme.radius.sm,
      borderWidth: 1.5,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center"
    },
    checkboxChecked: {
      backgroundColor: colors.primary
    },
    checkboxGlyph: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: "700"
    },
    excludedActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md
    },
    linkText: {
      color: colors.link,
      fontSize: 13,
      fontWeight: "600"
    },
    createCirclePrompt: {
      gap: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surface,
      padding: theme.spacing.md
    },
    createCirclePromptText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600"
    },
    createCircleActions: {
      flexDirection: "row",
      gap: theme.spacing.sm
    }
  });
}

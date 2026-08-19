import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/Screen";
import { SecondaryButton } from "@/components/SecondaryButton";
import { CompactSendButton } from "@/components/CompactSendButton";
import { DockedInputBar } from "@/components/DockedInputBar";
import { DockedFieldPreview } from "@/components/DockedFieldPreview";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { PersonaliseAccordion } from "@/components/PersonaliseAccordion";
import { ResearchContent } from "@/components/ResearchContent";
import { SuggestedPhrasesEditor } from "@/components/SuggestedPhrasesEditor";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { QUICK_RECONNECT_MESSAGES } from "@/constants/copy";
import {
  addPerson,
  getAll as getAllConversationPeople,
  markQuickSent,
  toggleComplete,
  type ConversationPerson
} from "@/services/conversationService";
import { addContactToGroup, createGroup, getGroups } from "@/services/circleService";
import { pickContact } from "@/services/contactPickerService";
import { sendOrShare } from "@/services/smsService";
import { getReconnectingPeriod } from "@/services/holdHistoryService";
import { getAllTemplates, saveCircleTemplate } from "@/services/templateService";
import type { ReturnStyle } from "@/types/hold";

const DEFAULT_QUICK_MESSAGE = QUICK_RECONNECT_MESSAGES[0]?.text ?? "";

interface TemplateRow {
  circleId: string;
  circleName: string;
  text: string;
}

interface CircleSection {
  circleId: string;
  circleName: string;
  people: ConversationPerson[];
}

function groupByCircle(people: ConversationPerson[]): CircleSection[] {
  const sections: CircleSection[] = [];
  const indexByCircleId = new Map<string, number>();

  for (const person of people) {
    if (!person.circleId) continue;

    let index = indexByCircleId.get(person.circleId);
    if (index === undefined) {
      index = sections.length;
      indexByCircleId.set(person.circleId, index);
      sections.push({ circleId: person.circleId, circleName: person.circleName ?? "Circle", people: [] });
    }

    sections[index]?.people.push(person);
  }

  return sections;
}

/** Every screen-owned docked-bar field, keyed by tag — mirrors create/people.tsx's pattern. Personalise's "Your reply" is handled separately (personaliseReplyTarget below), since its persistence is owned by each PersonaliseAccordion instance, not by the screen. */
type ActiveField = `individual-message:${string}` | "new-circle" | `template:${string}`;

interface PersonaliseReplyTarget {
  personId: string;
  onChangeText: (text: string) => void;
  friendMessage: string;
}

type LibraryTab = "conversations" | "templates" | "research";

export default function LibraryScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Segmented tab structure (2026-08-13) — Conversations/Templates/Research,
  // Conversations default. Research moved here from its own Settings screen
  // (removed); the Settings drawer's Research row now links into this tab
  // instead of maintaining a second copy of the content — see
  // ResearchContent.tsx. Initial tab honours ?tab=research so the drawer
  // link and the "Where this comes from" link (settings/circle/index.tsx)
  // land directly on the right pane. See docs/09-decision-log.md.
  const { tab: initialTabParam } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<LibraryTab>(
    initialTabParam === "research" || initialTabParam === "templates" ? initialTabParam : "conversations"
  );
  const [people, setPeople] = useState<ConversationPerson[]>([]);

  // Per-circle dropdown-arrow reveal — a Set, not a single value, since
  // "All" (below) can expand every circle at once for scanning across
  // everyone; an individual arrow tap only ever toggles its own circle in
  // or out of the set. See docs/09-decision-log.md, 2026-08-12.
  const [expandedCircleIds, setExpandedCircleIds] = useState<Set<string>>(new Set());
  // Which one person's PersonaliseAccordion is open — a single value, same
  // single-expand convention as everywhere else this pattern exists.
  const [expandedPersonaliseId, setExpandedPersonaliseId] = useState<string | null>(null);
  const [personaliseDrafts, setPersonaliseDrafts] = useState<Record<string, string>>({});
  const [personaliseStyles, setPersonaliseStyles] = useState<Record<string, ReturnStyle>>({});
  const [personaliseReplyTarget, setPersonaliseReplyTarget] = useState<PersonaliseReplyTarget | null>(null);

  // Ungrouped people only now — circle-grouped people are reached via each
  // circle's own dropdown arrow instead (2026-08-12). Still gates each
  // ungrouped person's own expanded card below, and still feeds the
  // 2-selected -> "Create a Circle for these people?" prompt.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [individualMessages, setIndividualMessages] = useState<Record<string, string>>({});
  const [personaliseSwapIds, setPersonaliseSwapIds] = useState<Set<string>>(new Set());

  const [selectedOtherIds, setSelectedOtherIds] = useState<Set<string>>(new Set());
  const [circlePromptStage, setCirclePromptStage] = useState<"none" | "confirm" | "naming">("none");
  const [newOtherCircleName, setNewOtherCircleName] = useState("");
  const [activeField, setActiveField] = useState<ActiveField | null>(null);
  // Library never shows the bottom tab bar, in any state, on any of its
  // three tabs — a Back button (top-left, see _layout.tsx) takes its
  // place. Enforced via navTier's TIER_1_PREFIXES ("/library" included
  // there, reconciled 2026-08-13) rather than a per-screen hook call, now
  // that BottomTabBar is a root-level overlay reading route + ComposingContext
  // directly, not per-screen navigation options — useComposingGestureLock's
  // hideTabBar mechanism no longer does anything, so the call is removed
  // rather than left in as inert. See docs/09-decision-log.md, 2026-08-13.

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templateDrafts, setTemplateDrafts] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const all = await getAllConversationPeople();
    setPeople(all);

    // Only a real, still-open Reconnect journey earns the "You're reconnected" screen —
    // Library is also reachable standalone, where reaching zero-incomplete has no such
    // journey to close out. Checked against the same durable RECONNECTING_KEY marker
    // Home's own resume logic uses, not in-memory flow-context mode — mode resets to
    // its default on force-quit, which would otherwise silently swallow this redirect
    // for anyone who closes the app mid-Reconnect and finishes addressing everyone later.
    if (all.length > 0 && all.every((person) => person.completed)) {
      const reconnectingPeriod = await getReconnectingPeriod();
      if (reconnectingPeriod) {
        router.replace("/return/done");
      }
    }

    const [savedTemplates, groups] = await Promise.all([getAllTemplates(), getGroups()]);
    const nameById = new Map(groups.map((group) => [group.id, group.name]));

    const rows = savedTemplates
      .map((template) => {
        const circleName = nameById.get(template.circleId);
        return circleName ? { circleId: template.circleId, circleName, text: template.text } : null;
      })
      .filter((row): row is TemplateRow => row !== null);

    setTemplates(rows);
    setTemplateDrafts((current) => {
      const next = { ...current };
      for (const row of rows) {
        if (!(row.circleId in next)) next[row.circleId] = row.text;
      }
      return next;
    });
  }, []);

  const changeTemplateDraft = (circleId: string, text: string) => {
    setTemplateDrafts((current) => ({ ...current, [circleId]: text }));
  };

  const saveTemplate = (circleId: string) => {
    const text = (templateDrafts[circleId] ?? "").trim();
    if (!text) return;
    void saveCircleTemplate(circleId, text).then(refresh);
  };

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const circleSections = useMemo(() => groupByCircle(people), [people]);
  const ungroupedPeople = useMemo(() => people.filter((person) => person.circleId === null), [people]);

  // One shared row, ordered to match each person's parent circle's
  // left-to-right position in the circle row above — circleSections is
  // already in that same order, so filtering+flatMapping it in place
  // preserves it without needing a separate sort. See
  // docs/09-decision-log.md, 2026-08-12.
  const expandedPeople = useMemo(
    () =>
      circleSections
        .filter((section) => expandedCircleIds.has(section.circleId))
        .flatMap((section) => section.people),
    [circleSections, expandedCircleIds]
  );
  const expandedPersonalisePerson = expandedPersonaliseId
    ? (expandedPeople.find((person) => person.id === expandedPersonaliseId) ?? null)
    : null;

  const allIds = useMemo(() => ungroupedPeople.map((person) => person.id), [ungroupedPeople]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  };

  const toggleId = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleCircleExpanded = (circleId: string) => {
    setExpandedCircleIds((current) => {
      const next = new Set(current);
      if (next.has(circleId)) {
        next.delete(circleId);

        // Collapsing removes this circle's people from the shared pill
        // row — if the currently-open accordion belonged to one of them,
        // close it too, rather than leaving it floating with no visible
        // pill above it. Their draft is untouched either way (it lives in
        // personaliseDrafts/replyStorageService, not here) — reopening the
        // circle and tapping their pill again brings it straight back.
        const section = circleSections.find((s) => s.circleId === circleId);
        if (section?.people.some((person) => person.id === expandedPersonaliseId)) {
          setExpandedPersonaliseId(null);
        }
      } else {
        next.add(circleId);
      }
      return next;
    });
  };

  const togglePersonalisePerson = (personId: string) => {
    setExpandedPersonaliseId((current) => (current === personId ? null : personId));
  };

  const activeIndividualMessageId = activeField?.startsWith("individual-message:")
    ? activeField.slice("individual-message:".length)
    : null;
  const activeTemplateId = activeField?.startsWith("template:") ? activeField.slice("template:".length) : null;
  const activeIndividualPerson = activeIndividualMessageId
    ? people.find((p) => p.id === activeIndividualMessageId)
    : undefined;
  const activeTemplate = activeTemplateId ? templates.find((t) => t.circleId === activeTemplateId) : undefined;

  const activeFieldValue = (): string => {
    if (activeIndividualMessageId) {
      // Ungrouped people default to the quick-message text; a circle's
      // excluded member defaults to empty — matches each field's own prior
      // fallback exactly.
      const fallback = activeIndividualPerson?.circleId === null ? DEFAULT_QUICK_MESSAGE : "";
      return individualMessages[activeIndividualMessageId] ?? fallback;
    }
    if (activeField === "new-circle") return newOtherCircleName;
    if (activeTemplateId) return templateDrafts[activeTemplateId] ?? activeTemplate?.text ?? "";
    return "";
  };

  const setActiveFieldValue = (text: string) => {
    if (activeIndividualMessageId) {
      setIndividualMessages((current) => ({ ...current, [activeIndividualMessageId]: text }));
    } else if (activeField === "new-circle") {
      setNewOtherCircleName(text);
    } else if (activeTemplateId) {
      changeTemplateDraft(activeTemplateId, text);
    }
  };

  const activeFieldLabel = (): string => {
    if (activeIndividualPerson) return `Message for ${activeIndividualPerson.name}`;
    if (activeField === "new-circle") return "New Circle name";
    if (activeTemplate) return `Saved message for ${activeTemplate.circleName}`;
    return "Message";
  };

  const togglePersonaliseSwap = (personId: string) => {
    setPersonaliseSwapIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  };

  const sendIndividual = (person: ConversationPerson) => {
    const text = (individualMessages[person.id] ?? "").trim();
    if (!text) return;

    void (async () => {
      try {
        await sendOrShare([person.phoneNumber], text);
      } catch {
        // The compose sheet closing is the only signal available either way.
      }
      await markQuickSent([person.id]);
      await refresh();
    })();
  };

  const toggleCompletePerson = (person: ConversationPerson) => {
    void (async () => {
      await toggleComplete(person.id, !person.completed);
      await refresh();
    })();
  };

  /**
   * The one add-person entry point on this screen — "+" in the circle row
   * (2026-08-12, replaces the old full-width "Add person" button, now
   * redundant with "+" positioned first). Adds an ungrouped person; folding
   * someone into a Circle is a separate, existing action (select 2+ below).
   */
  const addNewPerson = () => {
    void (async () => {
      const picked = await pickContact();
      if (!picked) return;

      await addPerson(picked);
      await refresh();
    })();
  };

  const toggleOtherSelection = (person: ConversationPerson) => {
    setSelectedOtherIds((current) => {
      const next = new Set(current);
      if (next.has(person.id)) {
        next.delete(person.id);
        if (next.size < 2) setCirclePromptStage("none");
        return next;
      }

      next.add(person.id);
      if (next.size === 2) setCirclePromptStage("confirm");
      return next;
    });
  };

  const declineCreateCircle = () => {
    setCirclePromptStage("none");
    setSelectedOtherIds(new Set());
  };

  const submitCreateCircle = async () => {
    const name = newOtherCircleName.trim();
    if (!name) return;

    const selectedPeople = ungroupedPeople.filter((person) => selectedOtherIds.has(person.id));
    const group = await createGroup(name);
    for (const person of selectedPeople) {
      await addContactToGroup(group.id, { name: person.name, phoneNumber: person.phoneNumber });
    }

    setNewOtherCircleName("");
    setCirclePromptStage("none");
    setSelectedOtherIds(new Set());
    await refresh();
  };

  return (
    <Screen
      contentContainerStyle={styles.content}
      dockedInput={
        personaliseReplyTarget ? (
          <DockedInputBar
            value={personaliseDrafts[personaliseReplyTarget.personId] ?? ""}
            onChangeText={personaliseReplyTarget.onChangeText}
            onDone={() => setPersonaliseReplyTarget(null)}
            placeholder="Your reply"
            accessibilityLabel="Your reply"
            aiAmend={{
              surface: "conversations-reply",
              context: {
                returnStyle: personaliseStyles[personaliseReplyTarget.personId] ?? undefined,
                friendMessage: personaliseReplyTarget.friendMessage
              }
            }}
          />
        ) : activeField ? (
          <DockedInputBar
            value={activeFieldValue()}
            onChangeText={setActiveFieldValue}
            onDone={() => setActiveField(null)}
            placeholder={activeFieldLabel()}
            accessibilityLabel={activeFieldLabel()}
            aiAmend={
              activeIndividualPerson
                ? {
                    surface: "conversations-reply",
                    context: { recipientLabel: activeIndividualPerson.name }
                  }
                : activeTemplateId
                  ? { surface: "template" }
                  : undefined
            }
          />
        ) : null
      }
    >
      {/* Segmented Conversations/Templates/Research control, Conversations
          default — replaces the old plain "Conversations" page title. See
          docs/09-decision-log.md, 2026-08-13. */}
      <View style={styles.toggle}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: activeTab === "conversations" }}
          onPress={() => setActiveTab("conversations")}
          style={[styles.toggleButton, activeTab === "conversations" && styles.toggleActive]}
        >
          <Text style={[styles.toggleLabel, activeTab === "conversations" && styles.toggleLabelActive]}>
            Conversations
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: activeTab === "templates" }}
          onPress={() => setActiveTab("templates")}
          style={[styles.toggleButton, activeTab === "templates" && styles.toggleActive]}
        >
          <Text style={[styles.toggleLabel, activeTab === "templates" && styles.toggleLabelActive]}>
            Templates
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: activeTab === "research" }}
          onPress={() => setActiveTab("research")}
          style={[styles.toggleButton, activeTab === "research" && styles.toggleActive]}
        >
          <Text style={[styles.toggleLabel, activeTab === "research" && styles.toggleLabelActive]}>
            Research
          </Text>
        </Pressable>
      </View>

      {activeTab === "research" ? <ResearchContent /> : null}

      {activeTab === "conversations" && people.length === 0 ? (
        <Text style={styles.empty}>
          Nothing here yet. When you need help replying to someone, this is where you’ll find it.
        </Text>
      ) : null}

      {activeTab !== "conversations" ? null : (
      <>
      {/* "+" pinned outside the scroll (never scrolls away), "All" first
          inside it — matches GroupPicker.tsx's own pinnedRow/newCircleStack
          treatment exactly, an app-wide convention, not specific to this
          screen (2026-08-13). See docs/09-decision-log.md. */}
      <View style={styles.pinnedRow}>
        <AdaptiveCircleChip
          label="+"
          accessibilityLabel="Add person"
          accessibilityRole="button"
          outline
          isSelected={false}
          labelFontSize={28}
          labelBold
          onPress={addNewPerson}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.pillScroll}
        >
        {allIds.length > 0 ? (
          <AdaptiveCircleChip
            label="All"
            isSelected={allSelected}
            labelBold
            onPress={toggleAll}
            accessibilityRole="button"
          />
        ) : null}

        {circleSections.map((section) => {
          const isExpanded = expandedCircleIds.has(section.circleId);

          return (
            <View key={section.circleId} style={styles.circleUnit}>
              <AdaptiveCircleChip
                label={section.circleName}
                isSelected={isExpanded}
                onPress={() => toggleCircleExpanded(section.circleId)}
                accessibilityRole="button"
                accessibilityLabel={`${section.circleName}, ${isExpanded ? "hide" : "show"} people`}
              />
              {/* Independent of the chip's own tap, same as Going Quiet's —
                  both happen to do the same thing here (there's no separate
                  "select for a shared send" meaning left to keep apart, see
                  docs/09-decision-log.md, 2026-08-12), but the visual
                  affordance stays consistent with the rest of the app. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${section.circleName}, ${isExpanded ? "hide" : "show"} people`}
                accessibilityState={{ expanded: isExpanded }}
                hitSlop={8}
                onPress={() => toggleCircleExpanded(section.circleId)}
                style={styles.arrowButton}
              >
                {({ pressed }) => (
                  <View style={[styles.arrowBadge, pressed && styles.arrowPressed]}>
                    <Text style={styles.arrowGlyph}>{isExpanded ? "▲" : "▼"}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          );
        })}

        {ungroupedPeople.map((person) => {
          const isSelected = selectedIds.has(person.id);
          const sentLook = person.completed && !isSelected;

          return (
            <AdaptiveCircleChip
              key={person.id}
              label={sentLook ? `✓ ${person.name}` : person.name}
              compact
              isSelected={isSelected}
              hasSentThisSession={person.completed}
              onPress={() => toggleId(person.id)}
              accessibilityRole="button"
              accessibilityLabel={sentLook ? `${person.name}, already sent. Tap to send another message.` : person.name}
            />
          );
        })}
        </ScrollView>
      </View>

      {/* One shared row, not a pop-up per circle — continues the same
          visual flow directly beneath the circle row above. A circle's
          arrow adds/removes only that circle's own people; with more than
          one circle expanded, people are ordered to match their parent
          circle's left-to-right position above, not grouped or separated
          visually by circle (2026-08-12, corrects this pass's own earlier,
          per-circle-row draft). Standard chip size throughout — no
          override — and sent-state (dark-green fill) is never locked, same
          "reselect to message again" rule as every other sent chip in the
          app. Drafts survive a circle being collapsed and reopened: they
          live in personaliseDrafts (this screen) backed by
          replyStorageService's own durable per-person storage inside
          PersonaliseAccordion itself, never cleared by
          toggleCircleExpanded — collapsing only changes who's currently
          visible in the row, never the underlying draft. See
          docs/09-decision-log.md, 2026-08-12. */}
      {expandedPeople.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {expandedPeople.map((person) => {
            const isOpen = expandedPersonaliseId === person.id;
            const sentLook = person.completed && !isOpen;

            return (
              <AdaptiveCircleChip
                key={person.id}
                label={sentLook ? `✓ ${person.name}` : person.name}
                compact
                isSelected={isOpen}
                hasSentThisSession={person.completed}
                onPress={() => togglePersonalisePerson(person.id)}
                accessibilityRole="button"
                accessibilityLabel={
                  sentLook
                    ? `${person.name}, already replied to. Tap to send another message.`
                    : person.name
                }
              />
            );
          })}
        </ScrollView>
      ) : null}

      {expandedPersonalisePerson ? (
        <PersonaliseAccordion
          person={expandedPersonalisePerson}
          isOpen
          onToggle={() => setExpandedPersonaliseId(null)}
          onSent={() => void refresh()}
          draft={personaliseDrafts[expandedPersonalisePerson.id] ?? ""}
          onChangeDraft={(text) =>
            setPersonaliseDrafts((current) => ({ ...current, [expandedPersonalisePerson.id]: text }))
          }
          style={personaliseStyles[expandedPersonalisePerson.id] ?? null}
          onChangeStyle={(style) =>
            setPersonaliseStyles((current) => ({ ...current, [expandedPersonalisePerson.id]: style }))
          }
          isReplyActive={personaliseReplyTarget?.personId === expandedPersonalisePerson.id}
          onActivateReply={(bundle) =>
            setPersonaliseReplyTarget({ personId: expandedPersonalisePerson.id, ...bundle })
          }
        />
      ) : null}

      <View style={styles.cardList}>
        {ungroupedPeople
          .filter((person) => selectedIds.has(person.id))
          .map((person) => {
            const selectedForCircle = selectedOtherIds.has(person.id);

            return (
              <View key={person.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Select ${person.name} to group into a Circle`}
                    accessibilityState={{ checked: selectedForCircle }}
                    onPress={() => toggleOtherSelection(person)}
                  >
                    <Text style={[styles.cardTitle, selectedForCircle && styles.cardTitleSelected]}>
                      {person.name}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Mark ${person.name} complete`}
                    accessibilityState={{ checked: person.completed }}
                    onPress={() => toggleCompletePerson(person)}
                    hitSlop={8}
                  >
                    <View style={[styles.checkbox, person.completed && styles.checkboxChecked]} />
                  </Pressable>
                </View>

                {personaliseSwapIds.has(person.id) ? (
                  <>
                    <PersonaliseAccordion
                      person={person}
                      isOpen={expandedPersonaliseId === person.id}
                      onToggle={() =>
                        setExpandedPersonaliseId((current) => (current === person.id ? null : person.id))
                      }
                      onSent={() => void refresh()}
                      draft={personaliseDrafts[person.id] ?? ""}
                      onChangeDraft={(text) =>
                        setPersonaliseDrafts((current) => ({ ...current, [person.id]: text }))
                      }
                      style={personaliseStyles[person.id] ?? null}
                      onChangeStyle={(style) =>
                        setPersonaliseStyles((current) => ({ ...current, [person.id]: style }))
                      }
                      isReplyActive={personaliseReplyTarget?.personId === person.id}
                      onActivateReply={(bundle) =>
                        setPersonaliseReplyTarget({ personId: person.id, ...bundle })
                      }
                    />
                    <Pressable accessibilityRole="button" onPress={() => togglePersonaliseSwap(person.id)}>
                      <Text style={styles.linkText}>Use a quick message instead</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <DockedFieldPreview
                      value={individualMessages[person.id] ?? DEFAULT_QUICK_MESSAGE}
                      placeholder={`Message for ${person.name}`}
                      isActive={activeField === `individual-message:${person.id}`}
                      onPress={() => setActiveField(`individual-message:${person.id}`)}
                      accessibilityLabel={`Message for ${person.name}`}
                    />
                    <View style={styles.excludedActions}>
                      <CompactSendButton
                        disabled={!(individualMessages[person.id] ?? DEFAULT_QUICK_MESSAGE).trim()}
                        accessibilityLabel={`Send to ${person.name}`}
                        onPress={() => sendIndividual(person)}
                      />
                      <Pressable accessibilityRole="button" onPress={() => togglePersonaliseSwap(person.id)}>
                        <Text style={styles.linkText}>Personalise</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            );
          })}
      </View>

      {circlePromptStage === "confirm" ? (
        <View style={styles.createCirclePrompt}>
          <Text style={styles.createCirclePromptText}>Create a Circle for these people?</Text>
          <View style={styles.createCircleActions}>
            <SecondaryButton label="No" onPress={declineCreateCircle} />
            <SecondaryButton label="Yes" onPress={() => setCirclePromptStage("naming")} />
          </View>
        </View>
      ) : circlePromptStage === "naming" ? (
        <View style={styles.createCirclePrompt}>
          <DockedFieldPreview
            value={newOtherCircleName}
            placeholder="Circle name"
            isActive={activeField === "new-circle"}
            onPress={() => setActiveField("new-circle")}
            accessibilityLabel="New Circle name"
          />
          <SecondaryButton
            disabled={!newOtherCircleName.trim()}
            label="Create Circle"
            onPress={() => void submitCreateCircle()}
          />
        </View>
      ) : null}
      </>
      )}

      {activeTab === "templates" ? (
      <View style={styles.section}>
        {/* Two labelled sections within this one existing tab, not a new
            tab (2026-08-13) — "Your saved messages" is the pre-existing
            per-circle default list, unchanged in function, just organised
            under this heading now; "Suggested phrases" is new, where the
            app-wide sentence-pill content lives and is user-editable. See
            docs/09-decision-log.md. */}
        <Text style={styles.sectionHeading}>Your saved messages</Text>
        {templates.length === 0 ? (
          <Text style={styles.helper}>
            Saved messages appear here once you save one from Going Quiet.
          </Text>
        ) : (
          <View style={styles.templateList}>
            {templates.map((row) => {
              const draft = templateDrafts[row.circleId] ?? row.text;
              return (
                <View key={row.circleId} style={styles.templateBlock}>
                  <Text style={styles.cardTitle}>{row.circleName}</Text>
                  <DockedFieldPreview
                    value={draft}
                    placeholder={`Saved message for ${row.circleName}`}
                    isActive={activeField === `template:${row.circleId}`}
                    onPress={() => setActiveField(`template:${row.circleId}`)}
                    accessibilityLabel={`Saved message for ${row.circleName}`}
                  />
                  <SecondaryButton
                    disabled={!draft.trim()}
                    label="Save"
                    onPress={() => saveTemplate(row.circleId)}
                  />
                </View>
              );
            })}
          </View>
        )}

        <Text style={[styles.sectionHeading, styles.sectionHeadingSpaced]}>Suggested phrases</Text>
        <SuggestedPhrasesEditor />
      </View>
      ) : null}
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  content: {
    gap: theme.spacing.lg
  },
  toggle: {
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  toggleButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: colors.border
  },
  toggleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceStrong
  },
  toggleLabel: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "600"
  },
  toggleLabelActive: {
    color: colors.text
  },
  empty: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24
  },
  section: {
    gap: theme.spacing.md
  },
  sectionHeading: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700"
  },
  sectionHeadingSpaced: {
    marginTop: theme.spacing.xl
  },
  helper: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  templateList: {
    gap: theme.spacing.md
  },
  templateBlock: {
    gap: theme.spacing.xs
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  // "+" pinned outside the scroll (never scrolls away), "All" first inside
  // it — matches GroupPicker.tsx's own pinnedRow/newCircleStack treatment.
  pinnedRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm
  },
  pillScroll: {
    flex: 1
  },
  // Wraps tightly to the chip's own rendered size — the dropdown arrow is
  // positioned inside it, not beside it. Matches GroupPicker.tsx's own
  // circleUnit/arrowButton treatment exactly. See docs/09-decision-log.md,
  // 2026-08-12.
  circleUnit: {
    position: "relative",
    alignSelf: "flex-start"
  },
  arrowButton: {
    position: "absolute",
    right: 6,
    bottom: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  arrowBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.12)"
  },
  arrowPressed: {
    opacity: 0.6
  },
  arrowGlyph: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600"
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
  linkText: {
    color: colors.link,
    fontSize: 13,
    fontWeight: "600"
  },
  excludedActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: theme.radius.sm,
    borderWidth: 1.5,
    borderColor: colors.primary
  },
  checkboxChecked: {
    backgroundColor: colors.primary
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
  },
  });
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/Screen";
import { SecondaryButton } from "@/components/SecondaryButton";
import { DockedInputBar } from "@/components/DockedInputBar";
import { DockedFieldPreview } from "@/components/DockedFieldPreview";
import { ConversationsView } from "@/components/ConversationsView";
import { ResearchIndex } from "@/components/ResearchIndex";
import { SuggestedPhrasesEditor } from "@/components/SuggestedPhrasesEditor";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useConversations } from "@/hooks/useConversations";
import { getGroups, NEWLY_ADDED_APOLOGY_PHRASE, PENDING_CIRCLE_ID_PREFIX } from "@/services/circleService";
import { getReconnectingPeriod } from "@/services/holdHistoryService";
import { getAllTemplates, saveCircleTemplate } from "@/services/templateService";

interface TemplateRow {
  circleId: string;
  circleName: string;
  text: string;
}

/** Templates tab's own docked-bar field — Conversations' own fields (individual-message/new-circle/personalise-reply) now live inside useConversations, kept separate since Templates isn't part of that shared hook. */
type TemplateActiveField = `template:${string}`;

type LibraryTab = "conversations" | "templates" | "research";

export default function LibraryScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Segmented tab structure (2026-08-13) — Conversations/Templates/Research,
  // Conversations default. Research moved here from its own Settings screen
  // (removed); the Settings drawer's Research row now links into this tab
  // instead of maintaining a second copy of the content. The Research tab
  // itself is an index of six concept-page links since 2026-08-31 (see
  // ResearchIndex.tsx) rather than an inline scrollable page. Initial tab
  // honours ?tab=research so the drawer link and the "Where this comes
  // from" link (settings/circle/index.tsx) land directly on the index.
  // See docs/09-decision-log.md.
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<LibraryTab>(
    tabParam === "research" || tabParam === "templates" ? tabParam : "conversations"
  );
  const scrollRef = useRef<ScrollView>(null);

  // Library's own screen instance stays mounted across tab navigations
  // (it's a Tabs-navigator route), so a second visit with ?tab=research
  // (e.g. tapping a citation marker from Transition while already having
  // been on this screen before) wouldn't re-run the useState initialiser
  // above — this keeps a later navigation honoured too, not just the first.
  useEffect(() => {
    if (tabParam === "research" || tabParam === "templates") setActiveTab(tabParam);
  }, [tabParam]);

  /**
   * Standalone, unscoped — every ConversationPerson ever added, same
   * component and query logic Reconnect's own embedded step now uses too
   * (scoped to just its period's audience there). Extracted 2026-08-20 so
   * the two entry points show the same "what's pending" picture, not two
   * implementations reading the same store differently. See
   * docs/09-decision-log.md.
   */
  const conversations = useConversations("all");

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
  const [templateActiveField, setTemplateActiveField] = useState<TemplateActiveField | null>(null);

  const refresh = useCallback(async () => {
    const all = await conversations.refresh();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.refresh]);

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

  return (
    <Screen
      contentContainerStyle={styles.content}
      scrollRef={scrollRef}
      dockedInput={
        conversations.personaliseReplyTarget ? (
          <DockedInputBar
            value={conversations.personaliseDrafts[conversations.personaliseReplyTarget.personId] ?? ""}
            onChangeText={conversations.personaliseReplyTarget.onChangeText}
            onDone={() => {
              // Was just closing the field — the docked bar's Send icon
              // never actually sent anything, matching Box A's own Send
              // button. Fixed 2026-08-29: onSend closes over this
              // instance's own PersonaliseAccordion.sendNow. See
              // docs/09-decision-log.md.
              conversations.personaliseReplyTarget?.onSend();
              conversations.setPersonaliseReplyTarget(null);
            }}
            placeholder="Your reply"
            accessibilityLabel="Your reply"
            pendingInsert={conversations.pendingInsertText}
            pendingInsertBold={conversations.pendingInsertText !== undefined}
            aiAmend={{
              surface: "conversations-reply",
              context: {
                returnStyle: conversations.personaliseStyles[conversations.personaliseReplyTarget.personId] ?? undefined,
                friendMessage: conversations.personaliseReplyTarget.friendMessage
              }
            }}
            extraPhrases={
              conversations.people
                .find((person) => person.id === conversations.personaliseReplyTarget?.personId)
                ?.circleId?.startsWith(PENDING_CIRCLE_ID_PREFIX)
                ? [NEWLY_ADDED_APOLOGY_PHRASE]
                : []
            }
          />
        ) : conversations.activeField ? (
          <DockedInputBar
            value={conversations.activeFieldValue()}
            onChangeText={conversations.setActiveFieldValue}
            onDone={() => conversations.setActiveField(null)}
            placeholder={conversations.activeFieldLabel()}
            accessibilityLabel={conversations.activeFieldLabel()}
            aiAmend={
              conversations.activeIndividualPerson
                ? {
                    surface: "conversations-reply",
                    context: { recipientLabel: conversations.activeIndividualPerson.name }
                  }
                : undefined
            }
            extraPhrases={
              conversations.activeIndividualPerson?.circleId?.startsWith(PENDING_CIRCLE_ID_PREFIX)
                ? [NEWLY_ADDED_APOLOGY_PHRASE]
                : []
            }
          />
        ) : templateActiveField ? (
          <DockedInputBar
            value={
              templateDrafts[templateActiveField.slice("template:".length)] ??
              templates.find((t) => t.circleId === templateActiveField.slice("template:".length))?.text ??
              ""
            }
            onChangeText={(text) => changeTemplateDraft(templateActiveField.slice("template:".length), text)}
            onDone={() => setTemplateActiveField(null)}
            placeholder={`Saved message for ${templates.find((t) => t.circleId === templateActiveField.slice("template:".length))?.circleName ?? ""}`}
            accessibilityLabel="Saved message"
            aiAmend={{ surface: "template" }}
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

      {activeTab === "research" ? (
        <ResearchIndex />
      ) : null}

      {activeTab === "conversations" && conversations.people.length === 0 ? (
        <Text style={styles.empty}>
          Nothing here yet. When you need help replying to someone, this is where you’ll find it.
        </Text>
      ) : null}

      {activeTab === "conversations" ? <ConversationsView conversations={conversations} mode="browse" /> : null}

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
                    isActive={templateActiveField === `template:${row.circleId}`}
                    onPress={() => setTemplateActiveField(`template:${row.circleId}`)}
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
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600"
  },
  });
}

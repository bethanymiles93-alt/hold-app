import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { DockedFieldPreview } from "@/components/DockedFieldPreview";
import { DockedInputBar } from "@/components/DockedInputBar";
import { HoldMark } from "@/components/HoldMark";
import { WiderWorldPlatformPill } from "@/components/WiderWorldPlatformPill";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { WIDER_WORLD_PRESET_PLATFORMS, findWiderWorldPreset } from "@/constants/widerWorldPresets";
import {
  addCustomWiderWorldPlatform,
  addWiderWorldContext,
  getCustomWiderWorldPlatforms,
  getWiderWorldContexts,
  getWiderWorldExpiryReminderOptIns,
  renameWiderWorldContext,
  setWiderWorldContextMessage,
  setWiderWorldContextPlatforms,
  setWiderWorldContextSentAt,
  setWiderWorldExpiryReminderOptIn
} from "@/services/widerWorldContextService";
import type { WiderWorldContext, WiderWorldCustomPlatform, WiderWorldExpiryReminderOptIn } from "@/types/hold";

type ActiveField = { kind: "message" | "label"; contextId: string } | { kind: "custom-platform"; contextId: string };

/** "A" / "A and B" / "A, B, and C" — used only for combining same-duration expiry wording into one line. */
function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * "Wider World" — rebuilt as named contexts (Personal, Work...), each with
 * its own platform pill selection and its own single shared message,
 * replacing the old freeform flat text-entry list. The legacy
 * WiderWorldPlatform list/service is deliberately untouched — Going
 * Quiet's "Where did you post this?" step and Reconnect's taken-down
 * checklist still read from it exactly as before; wiring those (and
 * Reconnect/Conversations' own inline platform rows) onto this new
 * Contexts system is separate, later work, not this pass. See
 * docs/09-decision-log.md.
 */
export default function WiderWorldSettingsScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [contexts, setContexts] = useState<WiderWorldContext[]>([]);
  const [customPlatforms, setCustomPlatforms] = useState<WiderWorldCustomPlatform[]>([]);
  const [expiryOptIns, setExpiryOptIns] = useState<WiderWorldExpiryReminderOptIn[]>([]);
  const [activeField, setActiveField] = useState<ActiveField | null>(null);
  const [draftValue, setDraftValue] = useState("");

  useFocusEffect(
    useCallback(() => {
      void Promise.all([getWiderWorldContexts(), getCustomWiderWorldPlatforms(), getWiderWorldExpiryReminderOptIns()]).then(
        ([nextContexts, nextCustom, nextOptIns]) => {
          setContexts(nextContexts);
          setCustomPlatforms(nextCustom);
          setExpiryOptIns(nextOptIns);
        }
      );
    }, [])
  );

  const selectablePlatforms = useMemo(
    () => [
      ...WIDER_WORLD_PRESET_PLATFORMS,
      ...customPlatforms.map((platform) => ({
        id: platform.id,
        name: platform.name,
        icon: undefined,
        expiresAfterHours: undefined,
        characterLimit: undefined
      }))
    ],
    [customPlatforms]
  );

  const activateMessage = (context: WiderWorldContext) => {
    setActiveField({ kind: "message", contextId: context.id });
    setDraftValue(context.message);
  };

  const activateLabel = (context: WiderWorldContext) => {
    setActiveField({ kind: "label", contextId: context.id });
    setDraftValue(context.label);
  };

  const activateCustomPlatform = (context: WiderWorldContext) => {
    setActiveField({ kind: "custom-platform", contextId: context.id });
    setDraftValue("");
  };

  const commitActiveField = async () => {
    if (!activeField) return;

    if (activeField.kind === "message") {
      const next = await setWiderWorldContextMessage(activeField.contextId, draftValue);
      setContexts(next);
    } else if (activeField.kind === "label") {
      const next = await renameWiderWorldContext(activeField.contextId, draftValue);
      setContexts(next);
    } else {
      const trimmed = draftValue.trim();
      if (trimmed) {
        const nextCustomList = await addCustomWiderWorldPlatform(trimmed);
        setCustomPlatforms(nextCustomList);
        const created = nextCustomList[nextCustomList.length - 1];
        const context = contexts.find((candidate) => candidate.id === activeField.contextId);
        if (created && context) {
          const nextContexts = await setWiderWorldContextPlatforms(context.id, [...context.selectedPlatformIds, created.id]);
          setContexts(nextContexts);
        }
      }
    }
    setActiveField(null);
  };

  // A half-typed custom platform name shouldn't silently create one on
  // tap-outside — same "discard, don't create" rule Going Quiet's own new-
  // Circle naming uses. Message/label edits still save on dismiss, since
  // losing typed Settings text on a tap-outside would be a real regression,
  // not a safety rail.
  const dismissActiveField = async () => {
    if (activeField?.kind === "custom-platform") {
      setActiveField(null);
      return;
    }
    await commitActiveField();
  };

  const togglePlatform = async (context: WiderWorldContext, platformId: string) => {
    const isSelected = context.selectedPlatformIds.includes(platformId);
    const nextIds = isSelected
      ? context.selectedPlatformIds.filter((id) => id !== platformId)
      : [...context.selectedPlatformIds, platformId];
    const next = await setWiderWorldContextPlatforms(context.id, nextIds);
    setContexts(next);
  };

  const addContext = async () => {
    const next = await addWiderWorldContext(`Context ${contexts.length + 1}`);
    setContexts(next);
    const created = next[next.length - 1];
    if (created) activateLabel(created);
  };

  const isExpiryOptedIn = (contextId: string, platformId: string) =>
    expiryOptIns.some((entry) => entry.contextId === contextId && entry.platformId === platformId);

  /** One toggle governs every platform sharing this duration group at once — checked only when all are opted in, sets all together either way. */
  const toggleExpiryReminderGroup = async (context: WiderWorldContext, platformIds: string[], optedIn: boolean) => {
    let next = expiryOptIns;
    for (const platformId of platformIds) {
      next = await setWiderWorldExpiryReminderOptIn(context.id, platformId, optedIn);
    }
    setExpiryOptIns(next);
  };

  const toggleMarkedSent = async (context: WiderWorldContext) => {
    const next = await setWiderWorldContextSentAt(context.id, context.sentAt ? null : Date.now());
    setContexts(next);
  };

  const dockedField = (): { value: string; placeholder: string; label: string } => {
    if (!activeField) return { value: "", placeholder: "", label: "" };
    if (activeField.kind === "message") return { value: draftValue, placeholder: "Wider World message", label: "Wider World message" };
    if (activeField.kind === "label") return { value: draftValue, placeholder: "Context name, e.g. Work", label: "Context name" };
    return { value: draftValue, placeholder: "Platform name", label: "Add a platform" };
  };

  const field = dockedField();

  return (
    <Screen
      dockedInput={
        activeField ? (
          <DockedInputBar
            value={field.value}
            onChangeText={setDraftValue}
            onDone={() => void commitActiveField()}
            onDismiss={() => void dismissActiveField()}
            placeholder={field.placeholder}
            accessibilityLabel={field.label}
          />
        ) : null
      }
    >
      <View style={styles.titleRow}>
        <Text style={styles.title}>Wider World</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Add a context" onPress={() => void addContext()} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
        </Pressable>
      </View>

      <Text style={styles.guidance}>
        Choose the few places people are most likely to check on you — not everywhere you have an account.
      </Text>

      {contexts.map((context) => {
        const showLabel = contexts.length > 1;
        const selectedPresets = context.selectedPlatformIds
          .map((id) => findWiderWorldPreset(id))
          .filter((preset): preset is NonNullable<typeof preset> => Boolean(preset));

        // Combined by duration, not one block per platform — two platforms
        // sharing the same expiry read as one line ("X and Y statuses
        // disappear after 24 hours"), not stacked duplicates.
        const expiryGroups = Array.from(
          selectedPresets
            .filter((preset) => preset.expiresAfterHours)
            .reduce<Map<number, typeof selectedPresets>>((groups, preset) => {
              const hours = preset.expiresAfterHours!;
              groups.set(hours, [...(groups.get(hours) ?? []), preset]);
              return groups;
            }, new Map())
            .entries()
        );

        // The message box's own character cap is the strictest limit among
        // whichever platforms are currently selected — dynamic, never
        // fixed, never a separate box per platform. No cap shown at all if
        // nothing selected has one.
        const characterLimits = selectedPresets
          .map((preset) => preset.characterLimit)
          .filter((limit): limit is number => typeof limit === "number");
        const characterLimit = characterLimits.length > 0 ? Math.min(...characterLimits) : undefined;
        const overLimit = characterLimit !== undefined && context.message.length > characterLimit;

        return (
          <View key={context.id} style={styles.contextBlock}>
            {showLabel ? (
              <Pressable accessibilityRole="button" onPress={() => activateLabel(context)} style={styles.labelRow}>
                <Text style={styles.contextLabel}>{context.label}</Text>
                <Ionicons name="pencil-outline" size={14} color={colors.textMuted} />
              </Pressable>
            ) : null}

            <View style={styles.pillWrap}>
              {selectablePlatforms.map((platform) => (
                <WiderWorldPlatformPill
                  key={platform.id}
                  name={platform.name}
                  icon={platform.icon}
                  isSelected={context.selectedPlatformIds.includes(platform.id)}
                  onPress={() => void togglePlatform(context, platform.id)}
                />
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add a custom platform"
                onPress={() => activateCustomPlatform(context)}
                style={styles.addPlatformPill}
              >
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={styles.addPlatformText}>Add</Text>
              </Pressable>
            </View>

            {expiryGroups.map(([hours, presets]) => {
              const names = joinWithAnd(presets.map((preset) => preset.name));
              const noun = presets.length === 1 ? "status" : "statuses";
              const verb = presets.length === 1 ? "disappears" : "disappear";
              const platformIds = presets.map((preset) => preset.id);
              const isGroupOptedIn = platformIds.every((id) => isExpiryOptedIn(context.id, id));

              return (
                <View key={hours} style={styles.expiryBlock}>
                  <Text style={styles.expiryText}>
                    {names} {noun} {verb} after {hours} hours.
                  </Text>
                  <View style={styles.expiryToggleRow}>
                    <Text style={styles.expiryToggleLabel}>Remind me if this is still needed after it expires?</Text>
                    <Switch
                      accessibilityLabel={`Remind me if my ${names} ${noun} ${presets.length === 1 ? "is" : "are"} still needed after ${presets.length === 1 ? "it expires" : "they expire"}`}
                      value={isGroupOptedIn}
                      onValueChange={(value) => void toggleExpiryReminderGroup(context, platformIds, value)}
                      trackColor={{ true: colors.primary, false: colors.border }}
                    />
                  </View>
                </View>
              );
            })}

            <View style={styles.messageRow}>
              <HoldMark size={20} />
              <View style={styles.messagePreview}>
                <DockedFieldPreview
                  value={context.message}
                  placeholder="Wider World message"
                  isActive={activeField?.kind === "message" && activeField.contextId === context.id}
                  onPress={() => activateMessage(context)}
                  accessibilityLabel={`${showLabel ? context.label + " " : ""}Wider World message`}
                />
                <View style={styles.messageFooter}>
                  {characterLimit !== undefined ? (
                    <Text style={[styles.characterCount, overLimit && styles.characterCountOver]}>
                      {context.message.length} of {characterLimit} characters
                    </Text>
                  ) : (
                    <View />
                  )}
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${showLabel ? context.label + " " : ""}message marked as posted`}
                    accessibilityState={{ checked: Boolean(context.sentAt) }}
                    onPress={() => void toggleMarkedSent(context)}
                    hitSlop={8}
                    style={styles.sentRow}
                  >
                    <View style={[styles.sentCheckbox, context.sentAt ? styles.sentCheckboxChecked : null]}>
                      {context.sentAt ? <Text style={styles.sentCheckboxGlyph}>✓</Text> : null}
                    </View>
                    <Text style={styles.sentLabel}>Posted</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between"
    },
    title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "700"
    },
    guidance: {
      marginTop: theme.spacing.sm,
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20
    },
    contextBlock: {
      marginTop: theme.spacing.xl,
      gap: theme.spacing.sm
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6
    },
    contextLabel: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600"
    },
    pillWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm
    },
    addPlatformPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      minHeight: 40,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: colors.primary
    },
    addPlatformText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "600"
    },
    expiryBlock: {
      gap: theme.spacing.xs,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.sm,
      backgroundColor: colors.surface
    },
    expiryText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18
    },
    expiryToggleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md
    },
    expiryToggleLabel: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      fontWeight: "500"
    },
    messageRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm
    },
    messagePreview: {
      flex: 1,
      gap: theme.spacing.xs
    },
    messageFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between"
    },
    characterCount: {
      color: colors.textMuted,
      fontSize: 12
    },
    characterCountOver: {
      color: colors.error,
      fontWeight: "600"
    },
    sentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6
    },
    // Exact match to Conversations' own "Conversation complete" checkbox
    // (src/components/ConversationsView.tsx) — same sent/checkmark
    // treatment reused, not a new one invented for this screen.
    sentCheckbox: {
      width: 22,
      height: 22,
      borderRadius: theme.radius.sm,
      borderWidth: 1.5,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center"
    },
    sentCheckboxChecked: {
      backgroundColor: colors.primary
    },
    sentCheckboxGlyph: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: "700"
    },
    sentLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600"
    }
  });
}

import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { BottomSheetDrawer } from "@/components/BottomSheetDrawer";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { DropdownArrowBadge } from "@/components/DropdownArrowBadge";
import { LinkedCircleCluster, LinkGroupToggle, type LinkedClusterMember } from "@/components/LinkedCircleCluster";
import { CompactSendButton } from "@/components/CompactSendButton";
import { combinationKey } from "@/services/templateService";
import {
  getAllUpdateCombinationTemplates,
  getUpdateCircleTemplate,
  getUpdateCombinationTemplate,
  getUpdateStartingPointsForCombination,
  saveUpdateCircleTemplate,
  saveUpdateCombinationTemplate
} from "@/services/updateTemplateService";
import { markUpdateSent } from "@/services/holdHistoryService";
import { sendOrShare } from "@/services/smsService";
import type { AudienceCircle, HoldPeriod } from "@/types/hold";

interface TakingTimeUpdateDrawerProps {
  visible: boolean;
  onClose: () => void;
  period: HoldPeriod;
  /** Re-reads the period after a send, so sent-state (updateSentCircleIds) persists into the next open. */
  onSent: () => void;
}

/**
 * "Send an Update" — reuses the true-circle/dropdown-arrow/shared-text-box
 * pattern already established in Going Quiet and Reconnect, not pills. Only
 * shows Circles already in the tracked audience (`period.audienceCircles`)
 * — no "+" here; extending who's included is exclusively "Add to Going
 * Quiet"'s job (not yet built — see docs/09-decision-log.md, 2026-08-13).
 * Ungrouped audience members are out of scope for this drawer: the request
 * that specified this exclusively describes Circles throughout, with no
 * mention of ungrouped individuals — flagged rather than silently including
 * or excluding them by assumption.
 */
export function TakingTimeUpdateDrawer({ visible, onClose, period, onSent }: TakingTimeUpdateDrawerProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const audienceCircles = period.audienceCircles ?? [];
  const sentCircleIds = period.updateSentCircleIds ?? [];

  const [selectedCircleIds, setSelectedCircleIds] = useState<Set<string>>(new Set());
  const [expandedCircleIds, setExpandedCircleIds] = useState<Set<string>>(new Set());
  const [includedPersonIds, setIncludedPersonIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [startingPoints, setStartingPoints] = useState<{ circleId: string; circleName: string; text: string }[]>([]);
  const [savedDefaultText, setSavedDefaultText] = useState<string | null>(null);
  // Linked clusters (Olympic-rings) — Circles with a saved combination
  // template have previously been sent one combined message together.
  // Session-local only: "ungrouping" separates them for this visit without
  // touching the saved template itself, so it's still there to relink to
  // next time. See docs/09-decision-log.md, 2026-08-13.
  const [linkedCombos, setLinkedCombos] = useState<string[][]>([]);
  const [ungroupedKeys, setUngroupedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    setSelectedCircleIds(new Set());
    setExpandedCircleIds(new Set());
    setIncludedPersonIds(new Set());
    setMessage("");
    setStartingPoints([]);
    setSavedDefaultText(null);
    setUngroupedKeys(new Set());

    void (async () => {
      const combos = await getAllUpdateCombinationTemplates();
      const audienceIds = new Set(audienceCircles.map((circle) => circle.circleId));
      // A Circle can only ever belong to one displayed cluster — its most
      // recently-saved combination wins if it appears in more than one.
      const byCircle = new Map<string, { key: string; circleIds: string[]; updatedAt: number }>();
      for (const combo of combos) {
        if (combo.circleIds.length < 2) continue;
        if (!combo.circleIds.every((id) => audienceIds.has(id))) continue;
        for (const circleId of combo.circleIds) {
          const existing = byCircle.get(circleId);
          if (!existing || existing.updatedAt < combo.updatedAt) {
            byCircle.set(circleId, { key: combo.combinationKey, circleIds: combo.circleIds, updatedAt: combo.updatedAt });
          }
        }
      }
      const seen = new Set<string>();
      const clusters: string[][] = [];
      for (const entry of byCircle.values()) {
        if (seen.has(entry.key)) continue;
        seen.add(entry.key);
        clusters.push(entry.circleIds);
      }
      setLinkedCombos(clusters);
    })();
  }, [visible, period.id]);

  const clusterFor = (circleId: string): string[] | null => {
    const cluster = linkedCombos.find((ids) => ids.includes(circleId));
    if (!cluster) return null;
    return ungroupedKeys.has(combinationKey(cluster)) ? null : cluster;
  };

  const loadMessageForSelection = async (circleIds: string[], previousText: string) => {
    if (circleIds.length === 0) {
      setMessage("");
      setSavedDefaultText(null);
      setStartingPoints([]);
      return;
    }

    if (circleIds.length === 1) {
      const singleDefault = await getUpdateCircleTemplate(circleIds[0] ?? "");
      setSavedDefaultText(singleDefault);
      setStartingPoints([]);
      setMessage(singleDefault ?? "");
      return;
    }

    const comboDefault = await getUpdateCombinationTemplate(circleIds);
    if (comboDefault !== null) {
      setSavedDefaultText(comboDefault);
      setStartingPoints([]);
      setMessage(comboDefault);
      return;
    }

    setSavedDefaultText(null);
    const points = await getUpdateStartingPointsForCombination(circleIds);
    const nameById = new Map(audienceCircles.map((circle) => [circle.circleId, circle.circleName]));
    setStartingPoints(points.map((point) => ({ ...point, circleName: nameById.get(point.circleId) ?? point.circleId })));
    setMessage(previousText);
  };

  const toggleCircle = (circleId: string) => {
    const cluster = clusterFor(circleId);
    const idsToToggle = cluster ?? [circleId];
    const isCurrentlySelected = idsToToggle.every((id) => selectedCircleIds.has(id));
    const previousText = message;

    const next = new Set(selectedCircleIds);
    for (const id of idsToToggle) {
      if (isCurrentlySelected) next.delete(id);
      else next.add(id);
    }
    setSelectedCircleIds(next);
    void loadMessageForSelection([...next], previousText);
  };

  const toggleArrow = (circleId: string) => {
    setExpandedCircleIds((current) => {
      const next = new Set(current);
      if (next.has(circleId)) next.delete(circleId);
      else next.add(circleId);
      return next;
    });
  };

  const visibleCircles = audienceCircles.filter((circle) => expandedCircleIds.has(circle.circleId));
  const pillPeople = visibleCircles.flatMap((circle) =>
    circle.contacts.map((contact) => ({ key: `${circle.circleId}:${contact.phoneNumber}`, id: contact.phoneNumber, name: contact.name, circleId: circle.circleId }))
  );

  const togglePerson = (personId: string) => {
    setIncludedPersonIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  };

  const isSaved = savedDefaultText !== null && message === savedDefaultText;

  const saveTemplate = async () => {
    const ids = [...selectedCircleIds];
    if (ids.length === 1) await saveUpdateCircleTemplate(ids[0] ?? "", message);
    else if (ids.length > 1) await saveUpdateCombinationTemplate(ids, message);
    setSavedDefaultText(message);
  };

  const send = async () => {
    const selectedCircles = audienceCircles.filter((circle) => selectedCircleIds.has(circle.circleId));
    const numbers = selectedCircles.flatMap((circle) =>
      circle.contacts
        .filter((contact) => {
          // Only a Circle whose arrow was never opened sends to everyone in
          // it by default; once opened, per-person inclusion (defaulting to
          // included) governs — matches Reconnect's own "arrow reveals,
          // then inclusion narrows" convention.
          if (!expandedCircleIds.has(circle.circleId)) return true;
          return !includedPersonIds.has(`exclude:${contact.phoneNumber}`);
        })
        .map((contact) => contact.phoneNumber)
    );
    if (numbers.length === 0 || !message.trim()) return;

    try {
      await sendOrShare(numbers, message.trim());
    } catch {
      // The compose sheet closing is the only signal available either way.
    }

    for (const circleId of selectedCircleIds) {
      await markUpdateSent(circleId);
    }
    if (selectedCircleIds.size === 1) {
      await saveUpdateCircleTemplate([...selectedCircleIds][0] ?? "", message.trim());
    } else if (selectedCircleIds.size > 1) {
      await saveUpdateCombinationTemplate([...selectedCircleIds], message.trim());
    }

    setSelectedCircleIds(new Set());
    setMessage("");
    setSavedDefaultText(null);
    onSent();
  };

  const selectedClusterKey =
    selectedCircleIds.size > 1 ? combinationKey([...selectedCircleIds]) : null;
  const showGroupToggle =
    selectedClusterKey !== null && linkedCombos.some((ids) => combinationKey(ids) === selectedClusterKey);

  return (
    <BottomSheetDrawer
      visible={visible}
      onClose={onClose}
      title="Send an update"
      sendSlot={<CompactSendButton onPress={() => void send()} disabled={selectedCircleIds.size === 0 || !message.trim()} />}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.circleRow}>
          {(() => {
            const rendered = new Set<string>();
            return audienceCircles.map((circle) => {
              if (rendered.has(circle.circleId)) return null;
              const cluster = clusterFor(circle.circleId);
              if (cluster) {
                for (const id of cluster) rendered.add(id);
                const members: LinkedClusterMember[] = audienceCircles
                  .filter((c) => cluster.includes(c.circleId))
                  .map((c) => ({
                    circleId: c.circleId,
                    circleName: c.circleName,
                    isSelected: selectedCircleIds.has(c.circleId),
                    hasSentThisSession: sentCircleIds.includes(c.circleId),
                    isExpanded: expandedCircleIds.has(c.circleId)
                  }));
                return (
                  <LinkedCircleCluster
                    key={combinationKey(cluster)}
                    members={members}
                    onToggle={() => toggleCircle(circle.circleId)}
                    onToggleArrow={toggleArrow}
                  />
                );
              }

              rendered.add(circle.circleId);
              const isSelected = selectedCircleIds.has(circle.circleId);
              const hasSent = sentCircleIds.includes(circle.circleId);
              const isExpanded = expandedCircleIds.has(circle.circleId);
              const sentLook = hasSent && !isSelected;

              return (
                <View key={circle.circleId} style={styles.circleUnit}>
                  <AdaptiveCircleChip
                    label={circle.circleName}
                    isSelected={isSelected}
                    hasSentThisSession={hasSent}
                    onPress={() => toggleCircle(circle.circleId)}
                    accessibilityRole="button"
                  />
                  <DropdownArrowBadge
                    expanded={isExpanded}
                    checked={sentLook}
                    onPress={() => toggleArrow(circle.circleId)}
                    accessibilityLabel={
                      sentLook
                        ? `${circle.circleName}, already sent. ${isExpanded ? "Hide" : "Show"} people.`
                        : `${circle.circleName}, ${isExpanded ? "hide" : "show"} people`
                    }
                    style={styles.arrowButton}
                  />
                </View>
              );
            });
          })()}
        </View>

        {showGroupToggle && selectedClusterKey ? (
          <LinkGroupToggle
            grouped={!ungroupedKeys.has(selectedClusterKey)}
            onPress={() => {
              setUngroupedKeys((current) => {
                const next = new Set(current);
                if (next.has(selectedClusterKey)) next.delete(selectedClusterKey);
                else next.add(selectedClusterKey);
                return next;
              });
            }}
          />
        ) : null}

        {pillPeople.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {pillPeople.map((person) => (
              <AdaptiveCircleChip
                key={person.key}
                label={person.name}
                compact
                isSelected={!includedPersonIds.has(`exclude:${person.id}`)}
                onPress={() => togglePerson(`exclude:${person.id}`)}
                accessibilityRole="button"
              />
            ))}
          </ScrollView>
        ) : null}

        {startingPoints.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.startingPointsRow}>
            {startingPoints.map((point) => (
              <Text
                key={point.circleId}
                accessibilityRole="button"
                style={styles.startingPointChip}
                onPress={() => setMessage(point.text)}
              >
                Start from {point.circleName}
              </Text>
            ))}
          </ScrollView>
        ) : null}

        {selectedCircleIds.size > 0 ? (
          <>
            {/* Simple, inline text entry — deliberately not the full docked-bar/
                AI-amend apparatus used elsewhere; the exact save/insert/compare
                interaction for editing a circle's template text is still being
                finalised and follows separately, per direct instruction. This
                is intentionally the plain placeholder version until then. */}
            <TextInput
              multiline
              value={message}
              onChangeText={setMessage}
              placeholder="Update message"
              placeholderTextColor={colors.textMuted}
              style={styles.textBox}
            />
            {!isSaved && message.trim() ? (
              <Text accessibilityRole="button" style={styles.linkText} onPress={() => void saveTemplate()}>
                Save as default
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </BottomSheetDrawer>
  );
}


function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scrollContent: {
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.xl
    },
    circleRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "flex-start",
      gap: theme.spacing.md
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
    pillRow: {
      flexDirection: "row",
      gap: theme.spacing.sm
    },
    startingPointsRow: {
      flexDirection: "row",
      gap: theme.spacing.sm
    },
    startingPointChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      color: colors.primary,
      fontSize: 13,
      fontWeight: "600"
    },
    textBox: {
      minHeight: 100,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: 16,
      textAlignVertical: "top"
    },
    linkText: {
      alignSelf: "flex-start",
      color: colors.link,
      fontSize: 13,
      fontWeight: "600"
    }
  });
}

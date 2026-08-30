import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { isHoldPlusActive, setHoldPlusActive } from "@/services/holdPlusService";
import { isMemoryEnabled, setMemoryEnabled } from "@/services/aiMemoryService";

const HOLD_PLUS_SECTIONS = [
  {
    title: "What Hold+ would add",
    body: "Unlimited AI-assisted drafting. AI personalisation that learns your writing style and can use saved messages as context. Richer Patterns, including seasonal trends, recurring timing, and longer-term summaries."
  },
  {
    title: "Fair by design",
    body: "One-tap cancellation and pausing, with no retention flow. Scholarship and regional pricing considered, not just standard pricing everywhere. No countdown timers, no urgency messaging — Hold exists to reduce burden, not add to it."
  }
];

// Fixed, illustrative copy — not a live/interactive preview.
const AMEND_EXAMPLE = {
  before: "I need some quiet time at the moment. This isn't about you, and you don't need to fix anything.",
  context: "My sister's visiting this weekend, so I might reply to her but not much else.",
  after:
    "I need some quiet time at the moment. This isn't about you, and you don't need to fix anything. My sister's visiting this weekend, so I might reply to her, but not much else right now."
};

const PRICING_ROWS = [
  { label: "First 3 months", value: "£4.50 one-time" },
  { label: "Then, monthly", value: "£3.49/month" },
  { label: "Then, yearly", value: "£19.99/year" }
];

/**
 * Separate, standalone one-time purchases — not Hold+ subscription tiers,
 * so kept in their own table rather than appended to PRICING_ROWS above
 * (conflating a subscription price ladder with unrelated one-off purchases
 * would read as one continuous pricing scheme when it isn't). Patterns
 * Report is free with any active Hold+ subscription, including during the
 * intro period — the AI credit pack is not a Hold+ perk at any tier. See
 * hold-book's 07-business/02-pricing-principles.md, 2026-08-20.
 */
const OTHER_PURCHASE_ROWS = [
  { label: "Patterns Report", value: "£2.50 — free with Hold+" },
  { label: "AI credit pack", value: "£2.99" }
];

export default function HoldPlusScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [devHoldPlus, setDevHoldPlus] = useState(false);
  const [memoryEnabled, setMemoryEnabledState] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void isHoldPlusActive().then(setDevHoldPlus);
      void isMemoryEnabled().then(setMemoryEnabledState);
    }, [])
  );

  const toggleMemoryEnabled = (enabled: boolean) => {
    setMemoryEnabledState(enabled);
    void setMemoryEnabled(enabled);
  };

  const toggleDevHoldPlus = (active: boolean) => {
    setDevHoldPlus(active);
    void setHoldPlusActive(active);
  };

  return (
    <Screen>
      <Text style={styles.intro}>
        A future option to support Hold's ongoing development and unlock some deeper tools —
        never anything essential to the core journey.
      </Text>

      <View style={styles.sections}>
        {HOLD_PLUS_SECTIONS.map((section, index) => (
          <View key={section.title} style={styles.sectionGroup}>
            <View style={styles.section}>
              <Text style={styles.title}>{section.title}</Text>
              <Text style={styles.body}>{section.body}</Text>
            </View>

            {index === 0 ? (
              <View style={styles.section}>
                <Text style={styles.title}>Amend with AI, for example</Text>
                <Text style={styles.body}>
                  A fixed example, not a live preview — Amend with AI lightly edits what's already
                  in the box rather than rewriting it from scratch.
                </Text>
                <View style={styles.exampleRow}>
                  <Text style={styles.exampleLabel}>Before</Text>
                  <Text style={styles.exampleText}>{AMEND_EXAMPLE.before}</Text>
                </View>
                <View style={styles.exampleRow}>
                  <Text style={styles.exampleLabel}>New context typed in</Text>
                  <Text style={styles.exampleText}>{AMEND_EXAMPLE.context}</Text>
                </View>
                <View style={styles.exampleRow}>
                  <Text style={styles.exampleLabel}>After</Text>
                  <Text style={styles.exampleText}>{AMEND_EXAMPLE.after}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ))}

        <View style={styles.section}>
          <View style={styles.memoryRow}>
            <View style={styles.memoryRowText}>
              <Text style={styles.title}>Remember helpful details</Text>
              <Text style={styles.body}>
                Off by default. When on, Amend with AI may quietly note a relevant detail you
                mention while drafting — never your message itself, never anything about how
                you're feeling — and gently offer it back later during Taking Time or Reconnect,
                with "Use it" or "Don't remember" at that calmer moment. Turning this off deletes
                anything already noted.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Remember helpful details for drafting and notifications"
              value={memoryEnabled}
              onValueChange={toggleMemoryEnabled}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Pricing</Text>
          <Text style={styles.body}>
            A one-time £4.50 covers your first 3 months. After that, it continues at whichever
            you choose — monthly or yearly.
          </Text>
          <View style={styles.pricingTable}>
            {PRICING_ROWS.map((row) => (
              <View key={row.label} style={styles.pricingRow}>
                <Text style={styles.pricingLabelCell}>{row.label}</Text>
                <Text style={styles.pricingValueCell}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Other purchases</Text>
          <Text style={styles.body}>
            Separate one-time purchases, available whether or not you have Hold+.
          </Text>
          <View style={styles.pricingTable}>
            {OTHER_PURCHASE_ROWS.map((row) => (
              <View key={row.label} style={styles.pricingRow}>
                <Text style={styles.pricingLabelCell}>{row.label}</Text>
                <Text style={styles.pricingValueCell}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <Text style={styles.closingNote}>Hold+ isn't open for purchase yet — this page describes what's planned.</Text>

      <View style={styles.devSection}>
        <Text style={styles.devLabel}>Dev/test only</Text>
        <View style={styles.devRow}>
          <View style={styles.devRowText}>
            <Text style={styles.devTitle}>Simulate Hold+ active</Text>
            <Text style={styles.devBody}>
              Lets you preview gated features on-device before real purchases exist. Not real
              purchase verification.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Simulate Hold+ active"
            value={devHoldPlus}
            onValueChange={toggleDevHoldPlus}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    intro: {
      color: colors.textMuted,
      fontSize: 17,
      lineHeight: 26
    },
    sections: {
      marginTop: theme.spacing.xl,
      gap: theme.spacing.md
    },
    sectionGroup: {
      gap: theme.spacing.md
    },
    section: {
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surface,
      gap: theme.spacing.sm
    },
    exampleRow: {
      gap: 2
    },
    exampleLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.3
    },
    exampleText: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22
    },
    memoryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md
    },
    memoryRowText: {
      flex: 1,
      gap: theme.spacing.sm
    },
    title: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600"
    },
    body: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 23
    },
    pricingTable: {
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden"
    },
    pricingRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    pricingLabelCell: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
      padding: theme.spacing.sm
    },
    pricingValueCell: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      padding: theme.spacing.sm
    },
    closingNote: {
      marginTop: theme.spacing.lg,
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20
    },
    devSection: {
      marginTop: theme.spacing.xl,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: "dashed",
      gap: theme.spacing.sm
    },
    devLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.5
    },
    devRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md
    },
    devRowText: {
      flex: 1,
      gap: 2
    },
    devTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600"
    },
    devBody: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18
    }
  });
}

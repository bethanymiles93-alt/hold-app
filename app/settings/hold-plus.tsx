import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { isHoldPlusActive, setHoldPlusActive } from "@/services/holdPlusService";

const HOLD_PLUS_SECTIONS = [
  {
    title: "What Hold+ would add",
    body: "Unlimited AI-assisted drafting. AI personalisation that learns your writing style and can use saved messages as context. Richer Patterns, including seasonal trends, recurring timing, and longer-term summaries. Optional encrypted sync, so your Circles, Library, History and Patterns are available on a second device."
  },
  {
    title: "Fair by design",
    body: "One-tap cancellation and pausing, with no retention flow. Scholarship and regional pricing considered, not just standard pricing everywhere. No countdown timers, no urgency messaging — Hold exists to reduce burden, not add to it."
  }
];

const PRICING_ROWS = [
  { label: "Annual", founding: "£17.99/year (≈ £1.50/month)", standard: "£29.99/year (≈ £2.50/month)" },
  { label: "Monthly", founding: "£1.99/month", standard: "£2.99/month" }
];

export default function HoldPlusScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [devHoldPlus, setDevHoldPlus] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void isHoldPlusActive().then(setDevHoldPlus);
    }, [])
  );

  const toggleDevHoldPlus = (active: boolean) => {
    setDevHoldPlus(active);
    void setHoldPlusActive(active);
  };

  return (
    <Screen>
      <Text style={styles.heading}>Hold+.</Text>
      <Text style={styles.intro}>
        A future option to support Hold's ongoing development and unlock some deeper tools —
        never anything essential to the core journey.
      </Text>

      <View style={styles.sections}>
        {HOLD_PLUS_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.title}>{section.title}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.title}>Founding Member pricing</Text>
          <Text style={styles.body}>
            Founding Members keep their annual price for as long as their subscription stays
            active — a reward for early supporters, not a limited-time discount that expires.
          </Text>
          <View style={styles.pricingTable}>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingHeaderCell} />
              <Text style={styles.pricingHeaderCell}>Founding Member</Text>
              <Text style={styles.pricingHeaderCell}>Standard, later</Text>
            </View>
            {PRICING_ROWS.map((row) => (
              <View key={row.label} style={styles.pricingRow}>
                <Text style={styles.pricingLabelCell}>{row.label}</Text>
                <Text style={styles.pricingValueCell}>{row.founding}</Text>
                <Text style={styles.pricingValueCell}>{row.standard}</Text>
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
    heading: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "600",
      marginBottom: theme.spacing.md
    },
    intro: {
      color: colors.textMuted,
      fontSize: 17,
      lineHeight: 26
    },
    sections: {
      marginTop: theme.spacing.xl,
      gap: theme.spacing.md
    },
    section: {
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surface,
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
    pricingHeaderCell: {
      flex: 1,
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
      padding: theme.spacing.sm
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

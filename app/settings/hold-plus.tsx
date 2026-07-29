import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { theme } from "@/constants/theme";

const HOLD_PLUS_SECTIONS = [
  {
    title: "What's free, always",
    body: "The full Going Quiet, Taking Time, Reconnect and Conversations journey. Unlimited Circles and contacts. Unlimited Quiet History and Library storage. Basic Patterns. A generous shared monthly AI-assisted drafting allowance. Every core accessibility and privacy control. Nothing essential is ever paywalled."
  },
  {
    title: "What Hold+ would add",
    body: "Unlimited AI-assisted drafting. AI personalisation that learns your writing style and can use saved messages as context. Richer Patterns, including seasonal trends, recurring timing, and longer-term summaries. Optional encrypted sync, so your Circles, Library, History and Patterns are available on a second device."
  },
  {
    title: "Fair by design",
    body: "A 7–14 day trial rather than a short, high-pressure one. A clear reminder before any trial converts. One-tap cancellation and pausing, with no retention flow. Scholarship and regional pricing considered, not just standard pricing everywhere. No countdown timers, no urgency messaging — Hold exists to reduce burden, not add to it."
  }
];

const PRICING_ROWS = [
  { label: "Annual", founding: "£17.99/year (≈ £1.50/month)", standard: "£29.99/year (≈ £2.50/month)" },
  { label: "Monthly", founding: "£1.99/month", standard: "£2.99/month" }
];

export default function HoldPlusScreen() {
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

        <View style={styles.separateNote}>
          <Text style={styles.separateNoteText}>
            Also available separately: a one-time formatted PDF report for your GP or therapist,
            no subscription needed. This isn't part of Hold+ — it's a standalone purchase
            available to everyone, free or not.
          </Text>
        </View>
      </View>

      <Text style={styles.closingNote}>Hold+ isn't open for purchase yet — this page describes what's planned.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "600",
    marginBottom: theme.spacing.md
  },
  intro: {
    color: theme.colors.textMuted,
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
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.sm
  },
  title: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "600"
  },
  body: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 23
  },
  pricingTable: {
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden"
  },
  pricingRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  pricingHeaderCell: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    padding: theme.spacing.sm
  },
  pricingLabelCell: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
    padding: theme.spacing.sm
  },
  pricingValueCell: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 13,
    padding: theme.spacing.sm
  },
  separateNote: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  separateNoteText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 21
  },
  closingNote: {
    marginTop: theme.spacing.lg,
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19
  }
});

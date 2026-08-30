import { useCallback, useMemo, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { SecondaryButton } from "@/components/SecondaryButton";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { isHoldPlusActive } from "@/services/holdPlusService";

// Apple's own subscription-management URL scheme — the only place a
// subscription can actually be changed or cancelled from (see below, "do
// not build custom in-app cancel/change-plan UI").
const APPLE_MANAGE_SUBSCRIPTIONS_URL = "itms-apps://apps.apple.com/account/subscriptions";

/**
 * "Manage Purchases" (2026-08-30) — distinct from the existing "Hold+" row,
 * which stays the informational/upsell entry point for non-subscribers.
 * This one is for anyone who's bought anything at all, and is always
 * present in the drawer for every user, free or paid, shown minimal/empty
 * rather than conditionally hidden — per direct instruction.
 *
 * Shell only, matching the confirmed scope: no cost-comparison messaging
 * ("you've spent enough on AI packs that Hold+ would cost less" is
 * explicitly blocked on real pricing numbers not yet worked out). No real
 * purchase-history data model exists yet either — `isHoldPlusActive`
 * (`holdPlusService.ts`) is still the same locally-persisted dev/test flag
 * `hold-plus.tsx` itself already uses, not real StoreKit entitlement or
 * transaction data, so both current-plan status and purchase history below
 * are built against whatever that flag/absence of real IAP tracking
 * actually allows today — every consumer already routes through this one
 * function so swapping in genuine entitlement/purchase data later is a
 * scoped change, not a rewrite. See docs/09-decision-log.md.
 */
export default function ManagePurchasesScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [holdPlusActive, setHoldPlusActiveState] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void isHoldPlusActive().then(setHoldPlusActiveState);
    }, [])
  );

  return (
    <Screen>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your plan</Text>
        {holdPlusActive ? (
          <>
            <Text style={styles.planName}>Hold+</Text>
            <Text style={styles.planDetail}>£3.49/month — no real renewal date yet (dev/test state, not a live subscription).</Text>
          </>
        ) : (
          <Text style={styles.planDetail}>You're on the free plan.</Text>
        )}
      </View>

      {holdPlusActive ? (
        <View style={styles.section}>
          <SecondaryButton
            label="Manage subscription"
            onPress={() => void Linking.openURL(APPLE_MANAGE_SUBSCRIPTIONS_URL)}
          />
          <Text style={styles.helperText}>
            Changing or cancelling your subscription happens through Apple, not here.
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Purchase history</Text>
        <Text style={styles.emptyText}>No purchases yet.</Text>
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: {
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xl
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600"
    },
    planName: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "700"
    },
    planDetail: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 21
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 21
    }
  });
}

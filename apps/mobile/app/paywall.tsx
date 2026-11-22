import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useEntitlements } from "@/components/entitlements";
import { useTranslations } from "@/components/i18n";
import { Button, Card, fontSize, theme } from "@/components/ui";

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useTranslations();
  const { isPremium, purchasePremium, restorePurchases } = useEntitlements();
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onPurchase() {
    setBusy("buy");
    setMessage(null);
    const result = await purchasePremium();
    setBusy(null);
    if (result === "ok") {
      router.back();
      return;
    }
    if (result === "error") setMessage(t.paywall.purchaseFailed);
  }

  async function onRestore() {
    setBusy("restore");
    setMessage(null);
    const result = await restorePurchases();
    setBusy(null);
    if (result === "ok") {
      setMessage(t.paywall.restoreOk);
      return;
    }
    setMessage(
      result === "empty" ? t.paywall.restoreFailed : t.paywall.purchaseFailed,
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.page,
        { paddingBottom: theme.space[5] + insets.bottom },
      ]}
    >
      <Text style={styles.subtitle}>{t.paywall.subtitle}</Text>

      <Card tone="raised" padding="lg">
        <View style={styles.features}>
          <Feature text={t.paywall.featureAi} />
          <Feature text={t.paywall.featureHistory} />
          <Feature text={t.paywall.featureChildren} />
        </View>
      </Card>

      {isPremium ? (
        <Card tone="muted" padding="md">
          <Text style={styles.active}>{t.paywall.active}</Text>
        </Card>
      ) : (
        <>
          <Button
            size="lg"
            fullWidth
            loading={busy === "buy"}
            onPress={onPurchase}
          >
            {t.paywall.cta}
          </Button>
          <Button
            size="md"
            fullWidth
            variant="ghost"
            loading={busy === "restore"}
            onPress={onRestore}
          >
            {busy === "restore" ? t.paywall.restoring : t.paywall.restore}
          </Button>
        </>
      )}

      <Button size="md" fullWidth variant="secondary" onPress={() => router.back()}>
        {t.paywall.later}
      </Button>

      {message ? (
        <Text style={styles.message} accessibilityRole="alert">
          {message}
        </Text>
      ) : null}
    </ScrollView>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.bullet} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.semantic.canvas },
  page: {
    paddingHorizontal: theme.space[5],
    paddingTop: theme.space[5],
    gap: theme.space[4],
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: theme.semantic.textSecondary,
  },
  features: { gap: theme.space[3] },
  featureRow: { flexDirection: "row", alignItems: "center", gap: theme.space[3] },
  bullet: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.color.primary[600],
  },
  featureText: {
    flex: 1,
    fontSize: fontSize.base,
    color: theme.semantic.textPrimary,
  },
  active: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: theme.color.primary[700],
  },
  message: {
    fontSize: fontSize.sm,
    color: theme.color.danger[700],
  },
});

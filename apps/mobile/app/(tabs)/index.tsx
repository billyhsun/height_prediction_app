import { useAuth } from "@clerk/clerk-expo";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PredictRequest } from "@notch/core";

import { useEntitlements } from "@/components/entitlements";
import { useTranslations } from "@/components/i18n";
import { PredictionForm } from "@/components/PredictionForm";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button, Card, fontSize, theme } from "@/components/ui";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function PredictScreen() {
  const insets = useSafeAreaInsets();
  const t = useTranslations();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { isPremium } = useEntitlements();

  const params = useLocalSearchParams();
  const initial: Partial<Record<keyof PredictRequest, string>> = {
    sex: first(params.sex),
    height_cm: first(params.height_cm),
    weight_kg: first(params.weight_kg),
    current_age_years: first(params.current_age_years),
    target_age_years: first(params.target_age_years),
    mother_height_cm: first(params.mother_height_cm),
    father_height_cm: first(params.father_height_cm),
    mother_weight_kg: first(params.mother_weight_kg),
    father_weight_kg: first(params.father_weight_kg),
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.page,
        {
          paddingTop: theme.space[4] + insets.top,
          paddingBottom: theme.space[5] + insets.bottom,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      <ScreenHeader
        title={t.form.title}
        subtitle={t.form.subtitle}
        showGuestBadge
        stickyBrand
      />

      {!isSignedIn ? (
        <Card tone="muted" padding="md">
          <Text style={styles.guestText}>
            {t.form.guestNoticeLead}{" "}
            <Link href="/sign-up" asChild>
              <Text style={styles.guestLink}>{t.form.guestNoticeSignUp}</Text>
            </Link>{" "}
            {t.form.guestNoticeTail}
          </Text>
        </Card>
      ) : null}

      {isSignedIn && !isPremium ? (
        <Card tone="muted" padding="md">
          <View style={styles.upgradeRow}>
            <Text style={styles.guestText}>{t.paywall.subtitle}</Text>
            <Button size="sm" onPress={() => router.push("/paywall")}>
              {t.paywall.upgrade}
            </Button>
          </View>
        </Card>
      ) : null}

      <PredictionForm initial={initial} initialChildId={first(params.child)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.semantic.canvas },
  page: {
    paddingHorizontal: theme.space[5],
    gap: theme.space[4],
  },
  guestText: {
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: theme.semantic.textSecondary,
  },
  guestLink: { fontWeight: "600", color: theme.color.primary[700] },
  upgradeRow: { gap: theme.space[3] },
});

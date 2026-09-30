import { useAuth } from "@clerk/clerk-expo";
import { Link, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PredictRequest } from "@notch/core";

import { useTranslations } from "@/components/i18n";
import { PredictionForm } from "@/components/PredictionForm";
import { ScreenHeader } from "@/components/ScreenHeader";
import { fontSize, theme } from "@/components/ui";

/** expo-router hands back `string | string[]`; a repeated key is not meaningful
 *  for any of these, so the first value wins. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function PredictScreen() {
  // With the native header hidden, nothing else keeps content clear of the notch
  // and the home indicator. Applied as content padding rather than a wrapping
  // SafeAreaView so the scrollable region still runs edge to edge.
  const insets = useSafeAreaInsets();
  const t = useTranslations();
  const { isSignedIn } = useAuth();

  // Populated when the results screen sends the user back to edit; empty on a
  // cold start, which leaves the form on its defaults.
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
          paddingTop: theme.space[5] + insets.top,
          paddingBottom: theme.space[5] + insets.bottom,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      // Lifts the content above the keyboard without a KeyboardAvoidingView
      // wrapper, which mismeasures inside a scroll view.
      automaticallyAdjustKeyboardInsets
    >
      <ScreenHeader title={t.form.title} subtitle={t.form.subtitle} showGuestBadge />

      {!isSignedIn ? (
        <View style={styles.guestNotice}>
          <Text style={styles.guestText}>
            {t.form.guestNoticeLead}{" "}
            <Link href="/sign-up" asChild>
              <Text style={styles.guestLink}>{t.form.guestNoticeSignUp}</Text>
            </Link>{" "}
            {t.form.guestNoticeTail}
          </Text>
        </View>
      ) : null}

      {/*
        Navigation lives here rather than in the header: two segmented controls
        and a sign-in link already fill a 393pt row, and a phone header has no
        space for three more destinations. A tab bar is the eventual answer.
      */}
      <View style={styles.nav}>
        <NavRow href="/birth" label={t.birth.title} />
        {isSignedIn ? (
          <>
            <NavRow href="/children" label={t.header.myChildren} />
            <NavRow href="/history" label={t.header.myHistory} />
            <NavRow href="/account" label={t.account.title} />
          </>
        ) : null}
      </View>

      <PredictionForm initial={initial} initialChildId={first(params.child)} />
    </ScrollView>
  );
}

function NavRow({ href, label }: { href: "/birth" | "/children" | "/history" | "/account"; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.crossLink, pressed && styles.pressed]}
      >
        <Text style={styles.crossLinkText}>{label}</Text>
        <Text style={styles.crossLinkChevron}>›</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.semantic.canvas },
  page: {
    // Vertical padding is set inline, combined with the safe-area insets.
    paddingHorizontal: theme.space[5],
    gap: theme.space[4],
  },
  guestNotice: { marginTop: -theme.space[2] },
  guestText: {
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: theme.semantic.textSecondary,
  },
  guestLink: { fontWeight: "600", color: theme.color.primary[700] },
  nav: { gap: theme.space[2] },
  crossLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.semantic.border,
    backgroundColor: theme.semantic.surface,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  pressed: { opacity: 0.85 },
  crossLinkText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: theme.semantic.textPrimary,
  },
  crossLinkChevron: { fontSize: fontSize.lg, color: theme.semantic.textMuted },
});

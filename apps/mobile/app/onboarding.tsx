import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslations } from "@/components/i18n";
import { ParentDefaultsForm } from "@/components/ParentDefaultsForm";
import { RequireAuth } from "@/components/RequireAuth";
import { fontSize, theme } from "@/components/ui";

export default function OnboardingScreen() {
  return (
    <RequireAuth>
      <Onboarding />
    </RequireAuth>
  );
}

/**
 * The optional step after sign-up.
 *
 * Framed as a head start rather than a requirement: the copy says why the
 * values are worth giving, and skipping is a peer of saving rather than hidden
 * away. Both land on the prediction form.
 */
function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useTranslations();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.page,
        { paddingTop: theme.space[5], paddingBottom: theme.space[5] + insets.bottom },
      ]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Text style={styles.subtitle}>{t.onboarding.subtitle}</Text>

      <ParentDefaultsForm
        submitLabel={t.onboarding.saveAndContinue}
        onSaved={() => router.replace("/")}
        secondaryAction={
          <Pressable
            onPress={() => router.replace("/")}
            accessibilityRole="button"
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
          >
            <Text style={styles.skipText}>{t.onboarding.skip}</Text>
          </Pressable>
        }
      />

      <Text style={styles.muted}>{t.onboarding.editLater}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.semantic.canvas },
  page: { paddingHorizontal: theme.space[5], gap: theme.space[4] },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: theme.semantic.textSecondary,
  },
  skip: { alignSelf: "center", paddingVertical: theme.space[2] },
  pressed: { opacity: 0.6 },
  skipText: { fontSize: fontSize.sm, color: theme.semantic.textSecondary },
  muted: { fontSize: fontSize.xs, color: theme.semantic.textMuted },
});

import { isClerkAPIResponseError } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslations } from "@/components/i18n";
import { Card, fontSize, theme } from "@/components/ui";

/**
 * Turns a Clerk failure into something worth showing.
 *
 * Clerk's `longMessage` is written for end users ("Password is incorrect") and
 * is already localised by Clerk itself, so it beats our generic fallback where
 * it exists. Anything else — a network error, an unexpected shape — falls back
 * to the caller's translated string rather than leaking an English internal
 * message into a Chinese UI. Same reasoning as core's `displayError`.
 */
export function authErrorMessage(error: unknown, fallback: string): string {
  if (isClerkAPIResponseError(error)) {
    const first = error.errors[0];
    return first?.longMessage ?? first?.message ?? fallback;
  }
  return fallback;
}

type AuthScreenProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  error?: string | null;
  /** The "no account yet / already have an account" line under the form. */
  footerPrompt: string;
  footerAction: string;
  footerHref: "/sign-in" | "/sign-up";
};

/**
 * The chrome shared by sign-in and sign-up.
 *
 * Both screens are pushed onto the stack rather than presented as sheets, so the
 * native header supplies the way back and the guest escape hatch below is about
 * intent rather than navigation: it says the app works without an account, which
 * is the thing a first-run user most needs to know and the thing an App Store
 * reviewer checks for under guideline 5.1.1(v).
 */
export function AuthScreen({
  title,
  subtitle,
  children,
  error,
  footerPrompt,
  footerAction,
  footerHref,
}: AuthScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useTranslations();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.page,
        { paddingBottom: theme.space[6] + insets.bottom },
      ]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.form}>{children}</View>

      {error ? (
        <Card tone="muted" padding="sm">
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        </Card>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {footerPrompt}{" "}
          {/* replace, not push: bouncing between the two screens would otherwise
              grow a stack the back button has to unwind one at a time. */}
          <Link href={footerHref} replace asChild>
            <Text style={styles.footerLink}>{footerAction}</Text>
          </Link>
        </Text>

        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          accessibilityRole="button"
          style={({ pressed }) => [styles.guest, pressed && styles.pressed]}
        >
          <Text style={styles.guestText}>{t.auth.continueAsGuest}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.semantic.canvas },
  page: {
    paddingHorizontal: theme.space[5],
    paddingTop: theme.space[5],
    gap: theme.space[5],
  },
  header: { gap: theme.space[2] },
  title: {
    fontSize: fontSize["3xl"],
    fontWeight: "700",
    color: theme.semantic.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: theme.semantic.textSecondary,
  },
  form: { gap: theme.space[4] },
  error: { fontSize: fontSize.sm, color: theme.color.danger[700] },
  footer: { alignItems: "center", gap: theme.space[4] },
  footerText: { fontSize: fontSize.sm, color: theme.semantic.textSecondary },
  footerLink: { fontWeight: "600", color: theme.color.primary[700] },
  guest: { paddingVertical: theme.space[2] },
  pressed: { opacity: 0.6 },
  guestText: { fontSize: fontSize.sm, color: theme.semantic.textMuted },
});

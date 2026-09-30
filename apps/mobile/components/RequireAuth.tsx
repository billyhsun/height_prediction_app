import { useAuth } from "@clerk/clerk-expo";
import { Link } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTranslations } from "@/components/i18n";
import { Button, Card, fontSize, theme } from "@/components/ui";

/**
 * Gate for the screens that need an account.
 *
 * The web does this in middleware, redirecting to /sign-in with the original
 * URL attached. There is no middleware here, and a redirect on mount would
 * fire during the moment Clerk is still resolving the session — bouncing a
 * signed-in user to sign-in on every cold start. So it waits for `isLoaded`
 * and then offers the route rather than forcing it, which also leaves the back
 * gesture doing what the user expects.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const t = useTranslations();

  if (!isLoaded) {
    return (
      <View style={styles.centre}>
        <Text style={styles.muted}>{t.common.loading}</Text>
      </View>
    );
  }

  if (!isSignedIn) {
    return (
      <View style={styles.centre}>
        <Card padding="lg">
          <View style={styles.stack}>
            <Text style={styles.title}>{t.auth.signInTitle}</Text>
            <Text style={styles.body}>{t.auth.signInSubtitle}</Text>
            <Link href="/sign-in" asChild>
              <Pressable>
                <Button size="lg" fullWidth>
                  {t.header.signIn}
                </Button>
              </Pressable>
            </Link>
          </View>
        </Card>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    justifyContent: "center",
    padding: theme.space[5],
    backgroundColor: theme.semantic.canvas,
  },
  stack: { gap: theme.space[3] },
  title: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: theme.semantic.textPrimary,
  },
  body: {
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: theme.semantic.textSecondary,
  },
  muted: {
    fontSize: fontSize.sm,
    textAlign: "center",
    color: theme.semantic.textSecondary,
  },
});

import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTranslations } from "@/components/i18n";
import { Button, Card, LoadingBlock, fontSize, theme } from "@/components/ui";

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
  const router = useRouter();
  const t = useTranslations();

  if (!isLoaded) {
    return <LoadingBlock fill rows={2} />;
  }

  if (!isSignedIn) {
    return (
      <View style={styles.centre}>
        <Card padding="lg">
          <View style={styles.stack}>
            <Text style={styles.title}>{t.auth.signInTitle}</Text>
            <Text style={styles.body}>{t.auth.signInSubtitle}</Text>
            {/* Own onPress: a Button nested in <Link asChild><Pressable> takes
                the touch itself, and the link never fires. */}
            <Button size="lg" fullWidth onPress={() => router.push("/sign-in")}>
              {t.header.signIn}
            </Button>
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
});

import { useAuth, useClerk } from "@clerk/clerk-expo";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useI18n } from "@/components/i18n";
import { GearIcon, SettingsSheet } from "@/components/SettingsSheet";
import { Badge, fontSize, theme } from "@/components/ui";

type ScreenHeaderProps = {
  /** Shown as the screen's own title, since the native header is hidden. */
  title: string;
  subtitle?: string;
  /** Marks a signed-out session on screens where that changes what happens to
   *  the data — the prediction form, not every screen. */
  showGuestBadge?: boolean;
};

/**
 * The equivalent of the web's sticky <Header>, minus the stickiness.
 *
 * The web can afford a persistent bar because a desktop viewport has the room.
 * At phone height a fixed 64px chrome costs a form field, so the same contents —
 * brand, settings, session — scroll with the page and each screen renders its
 * own. Language and units live behind the gear, mirroring the web header's
 * settings menu; as their own row they cost a form field too. Sign-out lives
 * here rather than behind Clerk's <UserButton>, which has no React Native
 * equivalent; the account screen will take it over when it lands.
 */
export function ScreenHeader({
  title,
  subtitle,
  showGuestBadge = false,
}: ScreenHeaderProps) {
  const { t } = useI18n();
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Text style={styles.brand}>{t.common.appName}</Text>
        <View style={styles.actions}>
          <Pressable
            onPress={() => setSettingsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t.header.settings}
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          >
            <GearIcon color={theme.color.primary[700]} />
          </Pressable>
          {isSignedIn ? (
            <Pressable
              onPress={() => signOut()}
              accessibilityRole="button"
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
            >
              <Text style={styles.linkText}>{t.auth.signOut}</Text>
            </Pressable>
          ) : (
            <Link href="/sign-in" asChild>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.link, pressed && styles.pressed]}
              >
                <Text style={styles.linkText}>{t.header.signIn}</Text>
              </Pressable>
            </Link>
          )}
        </View>
      </View>

      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {showGuestBadge && !isSignedIn ? (
          <Badge tone="warning">{t.header.guestMode}</Badge>
        ) : null}
      </View>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: theme.space[2] },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space[3],
  },
  brand: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: theme.color.primary[700],
  },
  actions: { flexDirection: "row", alignItems: "center", gap: theme.space[2] },
  link: { paddingVertical: theme.space[1], paddingHorizontal: theme.space[1] },
  pressed: { opacity: 0.6 },
  linkText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: theme.color.primary[700],
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.space[3],
  },
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
});

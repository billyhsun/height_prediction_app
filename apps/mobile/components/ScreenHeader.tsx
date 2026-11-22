import { useAuth, useClerk } from "@clerk/clerk-expo";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useI18n } from "@/components/i18n";
import { GearIcon, SettingsSheet } from "@/components/SettingsSheet";
import { Badge, fontSize, theme } from "@/components/ui";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  showGuestBadge?: boolean;
  /** Compact brand row that stays visually sticky at the top of the screen. */
  stickyBrand?: boolean;
};

/**
 * Brand + title block for tab screens (native header is hidden there).
 */
export function ScreenHeader({
  title,
  subtitle,
  showGuestBadge = false,
  stickyBrand = false,
}: ScreenHeaderProps) {
  const { t } = useI18n();
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <View style={[styles.header, stickyBrand && styles.sticky]}>
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
  sticky: {
    paddingBottom: theme.space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.semantic.border,
    marginBottom: theme.space[1],
  },
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
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    color: theme.semantic.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: theme.semantic.textSecondary,
  },
});

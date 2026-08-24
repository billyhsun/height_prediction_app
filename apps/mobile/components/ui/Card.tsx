import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { elevation, fontSize, theme } from "./theme";

type CardProps = {
  children: ReactNode;
  tone?: "default" | "raised" | "accent" | "muted";
  padding?: "sm" | "md" | "lg";
};

export function Card({ children, tone = "default", padding = "md" }: CardProps) {
  return (
    <View style={[styles.card, tones[tone], paddings[padding]]}>{children}</View>
  );
}

type SectionProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
};

/** A titled group of fields. Replaces the web's fieldset/legend, which has no
 *  React Native equivalent at all. */
export function Section({ title, description, children }: SectionProps) {
  return (
    <Card>
      <View style={styles.sectionInner}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {description ? (
            <Text style={styles.sectionDescription}>{description}</Text>
          ) : null}
        </View>
        {children}
      </View>
    </Card>
  );
}

type BadgeProps = {
  children: ReactNode;
  tone?: "neutral" | "primary" | "accent" | "warning" | "success";
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <View style={[styles.badge, badgeTones[tone]]}>
      <Text style={[styles.badgeText, badgeTextTones[tone]]}>{children}</Text>
    </View>
  );
}

type StatProps = {
  label: string;
  value: string;
  unit?: string;
  tone?: "default" | "accent";
};

export function Stat({ label, value, unit, tone = "default" }: StatProps) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statRow}>
        <Text
          style={[styles.statValue, tone === "accent" && styles.statValueAccent]}
        >
          {value}
        </Text>
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: theme.radius.lg, borderWidth: 1 },
  sectionInner: { gap: theme.space[4] },
  sectionHeader: { gap: theme.space[1] },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: theme.semantic.textPrimary,
  },
  sectionDescription: {
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: theme.semantic.textSecondary,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: theme.space[2] + 2,
    paddingVertical: 3,
  },
  badgeText: { fontSize: fontSize.xs, fontWeight: "500" },
  stat: { gap: theme.space[1] },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: "500",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: theme.semantic.textSecondary,
  },
  statRow: { flexDirection: "row", alignItems: "baseline", gap: theme.space[1] + 2 },
  statValue: {
    fontSize: fontSize["4xl"],
    fontWeight: "700",
    color: theme.semantic.textPrimary,
    // Keeps digits from shifting width as values change, matching the web's
    // tabular-nums.
    fontVariant: ["tabular-nums"],
  },
  statValueAccent: { color: theme.color.accent[700] },
  statUnit: {
    fontSize: fontSize.lg,
    fontWeight: "500",
    color: theme.semantic.textSecondary,
  },
});

const tones = StyleSheet.create({
  default: {
    backgroundColor: theme.semantic.surface,
    borderColor: theme.semantic.border,
  },
  raised: {
    backgroundColor: theme.semantic.surface,
    borderColor: theme.semantic.border,
    ...elevation.md,
  },
  accent: {
    backgroundColor: theme.color.accent[50],
    borderColor: theme.color.accent[200],
  },
  muted: {
    backgroundColor: theme.semantic.surfaceSunk,
    borderColor: theme.semantic.border,
  },
});

const paddings = StyleSheet.create({
  sm: { padding: theme.space[4] },
  md: { padding: theme.space[5] },
  lg: { padding: theme.space[6] },
});

const badgeTones = StyleSheet.create({
  neutral: { backgroundColor: theme.color.neutral[100] },
  primary: { backgroundColor: theme.color.primary[50] },
  accent: { backgroundColor: theme.color.accent[50] },
  warning: { backgroundColor: theme.color.warning[50] },
  success: { backgroundColor: theme.color.success[50] },
});

const badgeTextTones = StyleSheet.create({
  neutral: { color: theme.semantic.textSecondary },
  primary: { color: theme.color.primary[700] },
  accent: { color: theme.color.accent[700] },
  warning: { color: theme.color.warning[700] },
  success: { color: theme.color.success[700] },
});

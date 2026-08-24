import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import type { ReactNode } from "react";

import { elevation, fontSize, theme } from "./theme";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  disabled?: boolean;
  /** Shows a spinner and blocks presses. The web equivalent is handled by the
   *  caller swapping the label; native gets it built in because a spinner is
   *  the platform convention. */
  loading?: boolean;
  onPress?: () => void;
  children: ReactNode;
};

/**
 * Deliberately the same prop API as the web Button, so a screen written against
 * one reads identically against the other. That is what makes the nine screens
 * a translation rather than a redesign.
 */
export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  loading = false,
  onPress,
  children,
}: ButtonProps) {
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        sizes[size],
        variants[variant],
        fullWidth && styles.fullWidth,
        // No hover on touch, so pressed state carries the whole affordance.
        pressed && styles.pressed,
        inactive && styles.inactive,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === "primary" || variant === "danger"
              ? theme.semantic.textOnPrimary
              : theme.semantic.textPrimary
          }
        />
      ) : (
        <Text style={[styles.label, labels[variant], labelSizes[size]]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.md,
    gap: theme.space[2],
  },
  fullWidth: { alignSelf: "stretch" },
  pressed: { opacity: 0.85 },
  inactive: { opacity: 0.5 },
  label: { fontWeight: "600" },
});

const sizes = StyleSheet.create({
  sm: { height: theme.control.sm, paddingHorizontal: theme.space[3] },
  md: { height: theme.control.md, paddingHorizontal: theme.space[5] },
  lg: { height: theme.control.lg, paddingHorizontal: theme.space[6] },
});

const labelSizes = StyleSheet.create({
  sm: { fontSize: fontSize.sm },
  md: { fontSize: fontSize.sm },
  lg: { fontSize: fontSize.base },
});

const variants = StyleSheet.create({
  primary: { backgroundColor: theme.color.primary[600], ...elevation.sm },
  secondary: {
    backgroundColor: theme.semantic.surface,
    borderWidth: 1,
    borderColor: theme.semantic.border,
  },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: theme.color.danger[600], ...elevation.sm },
});

const labels = StyleSheet.create({
  primary: { color: theme.semantic.textOnPrimary },
  secondary: { color: theme.semantic.textPrimary },
  ghost: { color: theme.semantic.textSecondary },
  danger: { color: theme.semantic.textOnPrimary },
});

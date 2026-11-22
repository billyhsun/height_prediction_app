import { ActivityIndicator, StyleSheet, View } from "react-native";

import { theme } from "./theme";

type LoadingBlockProps = {
  /** Stretch to fill the parent (auth gates, full screens). */
  fill?: boolean;
  /** How many skeleton rows to show under the spinner. */
  rows?: number;
};

/**
 * Branded in-app loading state — replaces bare “Loading…” text.
 *
 * A spinner on the primary colour plus muted skeleton bars so list/form
 * screens still read as content arriving rather than an empty canvas.
 */
export function LoadingBlock({ fill = false, rows = 3 }: LoadingBlockProps) {
  return (
    <View
      style={[styles.wrap, fill && styles.fill]}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
    >
      <ActivityIndicator size="large" color={theme.color.primary[600]} />
      <View style={styles.skeletons}>
        {Array.from({ length: rows }, (_, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              i === 0 ? styles.wFull : i === 1 ? styles.wWide : styles.wMid,
              i === 0 && styles.barTall,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: theme.space[5],
    paddingVertical: theme.space[6],
  },
  fill: {
    flex: 1,
    paddingHorizontal: theme.space[5],
    backgroundColor: theme.semantic.canvas,
  },
  skeletons: {
    alignSelf: "stretch",
    gap: theme.space[3],
    paddingHorizontal: theme.space[2],
  },
  bar: {
    height: 12,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.semantic.surfaceSunk,
  },
  barTall: { height: 18 },
  wFull: { alignSelf: "stretch" },
  wWide: { width: "88%" },
  wMid: { width: "64%" },
});

import { Pressable, StyleSheet, Text, View } from "react-native";

import { fontSize, theme } from "./theme";

export type Option<T extends string> = { value: T; label: string };

type OptionGridProps<T extends string> = {
  options: Option<T>[];
  selected: readonly string[];
  onToggle: (value: T) => void;
  label: string;
};

/**
 * Multi-select as tappable cards. The web version wraps a real checkbox for
 * keyboard and screen-reader behaviour; there is no such element here, so the
 * checkbox role and checked state are declared explicitly and the tick is drawn.
 *
 * Single column rather than the web's two: at phone width, two columns of
 * ethnicity labels wrap badly, and several of these labels are long.
 */
export function OptionGrid<T extends string>({
  options,
  selected,
  onToggle,
  label,
}: OptionGridProps<T>) {
  return (
    <View accessibilityLabel={label} style={styles.grid}>
      {options.map((option) => {
        const checked = selected.includes(option.value);
        return (
          <Pressable
            key={option.value}
            onPress={() => onToggle(option.value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            style={({ pressed }) => [
              styles.row,
              checked && styles.rowChecked,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.box, checked && styles.boxChecked]}>
              {checked ? <Text style={styles.tick}>✓</Text> : null}
            </View>
            <Text style={checked ? styles.labelChecked : styles.label}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: theme.space[2] },
  row: {
    minHeight: theme.control.md,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space[3],
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.semantic.border,
    backgroundColor: theme.semantic.surface,
  },
  rowChecked: {
    borderColor: theme.color.primary[500],
    backgroundColor: theme.color.primary[50],
  },
  pressed: { opacity: 0.85 },
  box: {
    width: 20,
    height: 20,
    borderRadius: theme.radius.sm - 2,
    borderWidth: 1.5,
    borderColor: theme.semantic.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: {
    borderColor: theme.color.primary[600],
    backgroundColor: theme.color.primary[600],
  },
  tick: { fontSize: 13, lineHeight: 16, color: theme.semantic.textOnPrimary },
  label: { flex: 1, fontSize: fontSize.sm, color: theme.semantic.textSecondary },
  labelChecked: { flex: 1, fontSize: fontSize.sm, color: theme.color.primary[800] },
});

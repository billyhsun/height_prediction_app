import { Pressable, StyleSheet, Text, View } from "react-native";

import { elevation, fontSize, theme } from "./theme";

export type SegmentOption<T extends string | number> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string | number> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
};

/**
 * Same API as the web version. This is the primitive that most justifies being a
 * primitive rather than a row of Buttons: on iOS the segmented control is a
 * distinct platform widget, not a differently-styled button group.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[styles.track, size === "sm" && styles.trackSm]}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.item,
              active && styles.itemActive,
              pressed && !active && styles.pressed,
            ]}
          >
            <Text style={active ? styles.labelActive : styles.label}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space[1],
    height: theme.control.md,
    padding: theme.space[1],
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.semantic.border,
    backgroundColor: theme.semantic.surfaceSunk,
  },
  trackSm: { height: 34 },
  item: {
    flex: 1,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
  },
  itemActive: { backgroundColor: theme.color.primary[600], ...elevation.sm },
  pressed: { opacity: 0.7 },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: theme.semantic.textSecondary,
  },
  labelActive: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: theme.semantic.textOnPrimary,
  },
});

import { useId, useState } from "react";
import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { TextInputProps } from "react-native";

import { elevation, fontSize, theme } from "./theme";

type FieldProps = {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** Same render-prop shape as the web Field. `id` has no meaning on native, but
   *  keeping the signature identical means screen code does not fork. */
  children: (props: { id: string; describedBy?: string }) => ReactNode;
};

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children({ id })}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

type InputProps = Omit<TextInputProps, "style"> & {
  /** Web passes min/max/step on number inputs. They have no native equivalent,
   *  so they are accepted and ignored rather than forcing callers to strip them. */
  min?: number;
  max?: number;
  step?: number;
};

export function Input({ min, max, step, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      placeholderTextColor={theme.semantic.textMuted}
      style={[styles.control, focused && styles.controlFocused]}
    />
  );
}

export type SelectOption = { value: string; label: string };

type SelectProps = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
};

/**
 * There is no native `<select>`. Rather than a wheel picker inline — which eats
 * vertical space and reads as a form control from 2010 — this presents the
 * current value as a row that opens a sheet of choices.
 *
 * The prop shape differs from the web on purpose: the web takes `<option>`
 * children because that is what a DOM select needs, whereas passing data is the
 * natural form here. This is the one primitive where the two APIs diverge, and
 * the screens have to account for it.
 */
export function Select({
  value,
  options,
  onChange,
  placeholder,
  accessibilityLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.control,
          styles.selectRow,
          pressed && styles.pressed,
        ]}
      >
        <Text style={selected ? styles.selectValue : styles.selectPlaceholder}>
          {selected?.label ?? placeholder ?? ""}
        </Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView>
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.sheetRow,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={active ? styles.sheetRowActive : styles.sheetRowText}>
                      {option.label}
                    </Text>
                    {active ? <Text style={styles.tick}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: { gap: theme.space[1] + 2 },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: theme.semantic.textPrimary,
  },
  hint: { fontSize: fontSize.xs, lineHeight: 18, color: theme.semantic.textSecondary },
  error: {
    fontSize: fontSize.xs,
    fontWeight: "500",
    color: theme.color.danger[600],
  },
  control: {
    height: theme.control.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.semantic.border,
    backgroundColor: theme.semantic.surface,
    paddingHorizontal: theme.space[3],
    fontSize: fontSize.sm,
    color: theme.semantic.textPrimary,
  },
  controlFocused: { borderColor: theme.color.primary[600] },
  pressed: { opacity: 0.85 },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectValue: { fontSize: fontSize.sm, color: theme.semantic.textPrimary },
  selectPlaceholder: { fontSize: fontSize.sm, color: theme.semantic.textMuted },
  chevron: { fontSize: fontSize.base, color: theme.semantic.textMuted },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(24,32,30,0.4)",
  },
  sheet: {
    maxHeight: "60%",
    backgroundColor: theme.semantic.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingVertical: theme.space[2],
    ...elevation.md,
  },
  sheetRow: {
    minHeight: theme.control.lg,
    paddingHorizontal: theme.space[5],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetRowText: { fontSize: fontSize.base, color: theme.semantic.textPrimary },
  sheetRowActive: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: theme.color.primary[700],
  },
  tick: { fontSize: fontSize.base, color: theme.color.primary[600] },
});

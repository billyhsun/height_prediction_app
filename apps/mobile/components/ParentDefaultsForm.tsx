import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";

import {
  EMPTY_PARENT_DEFAULTS,
  PARENT_LIMITS,
  displayError,
  fetchParentDefaults,
  formatHeight,
  formatWeight,
  isValidParentHeight,
  isValidParentWeight,
  saveParentDefaults,
  type ParentDefaults,
} from "@notch/core";

import { useTranslations } from "@/components/i18n";
import { useUnits } from "@/components/units";
import { Button, HeightField, WeightField, fontSize, theme } from "@/components/ui";

type FormState = {
  motherHeightCm: string;
  fatherHeightCm: string;
  motherWeightKg: string;
  fatherWeightKg: string;
};

const EMPTY_FORM: FormState = {
  motherHeightCm: "",
  fatherHeightCm: "",
  motherWeightKg: "",
  fatherWeightKg: "",
};

const toForm = (d: ParentDefaults): FormState => ({
  motherHeightCm: d.motherHeightCm?.toString() ?? "",
  fatherHeightCm: d.fatherHeightCm?.toString() ?? "",
  motherWeightKg: d.motherWeightKg?.toString() ?? "",
  fatherWeightKg: d.fatherWeightKg?.toString() ?? "",
});

type Props = {
  /** Rendered beside Save — the skip control during onboarding, nothing on the
   *  account screen. Mirrors the web component's prop. */
  secondaryAction?: ReactNode;
  onSaved?: (defaults: ParentDefaults) => void;
  submitLabel?: string;
};

/**
 * Editor for the account's parent measurements, shared by onboarding and the
 * account screen — the same split as the web.
 *
 * Every field is independently optional, so there is no "complete the form"
 * state to enforce. What is validated is only whether a value that *was*
 * entered is plausible, which catches the mistake that actually happens: a
 * height typed in metres, or a weight in pounds.
 */
export function ParentDefaultsForm({
  secondaryAction,
  onSaved,
  submitLabel,
}: Props) {
  const t = useTranslations();
  const { units } = useUnits();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchParentDefaults()
      .then((d) => setForm(toForm(d)))
      .catch(() => setForm(toForm(EMPTY_PARENT_DEFAULTS)))
      .finally(() => setLoading(false));
  }, []);

  const update = (key: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  async function handleSave() {
    setError(null);

    for (const key of ["motherHeightCm", "fatherHeightCm"] as const) {
      const raw = form[key];
      if (raw !== "" && !isValidParentHeight(Number(raw))) {
        setError(
          t.parents.heightOutOfRange(
            formatHeight(PARENT_LIMITS.heightCm.min, units, t),
            formatHeight(PARENT_LIMITS.heightCm.max, units, t),
          ),
        );
        return;
      }
    }
    for (const key of ["motherWeightKg", "fatherWeightKg"] as const) {
      const raw = form[key];
      if (raw !== "" && !isValidParentWeight(Number(raw))) {
        setError(
          t.parents.weightOutOfRange(
            formatWeight(PARENT_LIMITS.weightKg.min, units, t),
            formatWeight(PARENT_LIMITS.weightKg.max, units, t),
          ),
        );
        return;
      }
    }

    setSaving(true);
    try {
      // Blank clears the stored value, so every field is sent rather than only
      // the filled ones — otherwise a value could never be removed.
      const defaults = await saveParentDefaults({
        motherHeightCm: form.motherHeightCm ? Number(form.motherHeightCm) : null,
        fatherHeightCm: form.fatherHeightCm ? Number(form.fatherHeightCm) : null,
        motherWeightKg: form.motherWeightKg ? Number(form.motherWeightKg) : null,
        fatherWeightKg: form.fatherWeightKg ? Number(form.fatherWeightKg) : null,
      });
      setSaved(true);
      onSaved?.(defaults);
    } catch (err) {
      setError(displayError(err, t.parents.failedToSave));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Text style={styles.muted}>{t.common.loading}</Text>;
  }

  return (
    <View style={styles.form}>
      <HeightField
        valueCm={form.motherHeightCm}
        onChangeCm={update("motherHeightCm")}
        units={units}
        t={t}
        metricLabel={t.units.mothersHeightLabel}
        groupLabel={t.units.mothersHeightGroupLabel}
        placeholder={t.parents.optionalPlaceholder}
      />
      <HeightField
        valueCm={form.fatherHeightCm}
        onChangeCm={update("fatherHeightCm")}
        units={units}
        t={t}
        metricLabel={t.units.fathersHeightLabel}
        groupLabel={t.units.fathersHeightGroupLabel}
        placeholder={t.parents.optionalPlaceholder}
      />
      <WeightField
        valueKg={form.motherWeightKg}
        onChangeKg={update("motherWeightKg")}
        units={units}
        t={t}
        label={t.units.mothersWeightLabel}
        placeholder={t.parents.optionalPlaceholder}
      />
      <WeightField
        valueKg={form.fatherWeightKg}
        onChangeKg={update("fatherWeightKg")}
        units={units}
        t={t}
        label={t.units.fathersWeightLabel}
        placeholder={t.parents.optionalPlaceholder}
      />

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {saved && !error ? <Text style={styles.saved}>{t.parents.saved}</Text> : null}

      <View style={styles.actions}>
        <Button size="lg" fullWidth loading={saving} onPress={handleSave}>
          {saving ? t.parents.saving : submitLabel ?? t.parents.save}
        </Button>
        {secondaryAction}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.space[4] },
  actions: { gap: theme.space[3] },
  muted: { fontSize: fontSize.sm, color: theme.semantic.textSecondary },
  error: { fontSize: fontSize.sm, color: theme.color.danger[700] },
  saved: { fontSize: fontSize.sm, color: theme.color.success[700] },
});

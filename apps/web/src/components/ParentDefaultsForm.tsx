"use client";

import { useEffect, useState } from "react";

import {
  EMPTY_PARENT_DEFAULTS,
  fetchParentDefaults,
  isValidParentHeight,
  isValidParentWeight,
  PARENT_LIMITS,
  saveParentDefaults,
  displayError,
  formatHeight,
  formatWeight,
  type ParentDefaults,
} from "@notch/core";
import { useTranslations } from "@/lib/i18n/context";
import { useUnits } from "@/lib/units/context";
import { Button, HeightField, WeightField } from "@/components/ui";

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

function toForm(defaults: ParentDefaults): FormState {
  return {
    motherHeightCm: defaults.motherHeightCm?.toString() ?? "",
    fatherHeightCm: defaults.fatherHeightCm?.toString() ?? "",
    motherWeightKg: defaults.motherWeightKg?.toString() ?? "",
    fatherWeightKg: defaults.fatherWeightKg?.toString() ?? "",
  };
}

type ParentDefaultsFormProps = {
  /** Rendered next to Save — the skip link during onboarding, nothing on the
   *  account page. */
  secondaryAction?: React.ReactNode;
  onSaved?: (defaults: ParentDefaults) => void;
  submitLabel?: string;
};

/**
 * Editor for the account's parent measurements, shared by the onboarding step
 * and the account page.
 *
 * Every field is independently optional, so there is no "complete the form"
 * state to enforce and no field is ever required. What is validated is only
 * whether a value that *was* entered is plausible, which catches the mistake
 * that actually happens: a height typed in metres, or a weight in pounds.
 */
export function ParentDefaultsForm({
  secondaryAction,
  onSaved,
  submitLabel,
}: ParentDefaultsFormProps) {
  const t = useTranslations();
  const { units } = useUnits();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchParentDefaults()
      .then((defaults) => setForm(toForm(defaults)))
      .catch(() => setForm(EMPTY_FORM))
      .finally(() => setLoading(false));
  }, []);

  function update(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const heights = ["motherHeightCm", "fatherHeightCm"] as const;
    const weights = ["motherWeightKg", "fatherWeightKg"] as const;

    for (const key of heights) {
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
    for (const key of weights) {
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
      // the filled ones — otherwise a user could never remove a value.
      const defaults = await saveParentDefaults({
        motherHeightCm: form.motherHeightCm ? Number(form.motherHeightCm) : null,
        fatherHeightCm: form.fatherHeightCm ? Number(form.fatherHeightCm) : null,
        motherWeightKg: form.motherWeightKg ? Number(form.motherWeightKg) : null,
        fatherWeightKg: form.fatherWeightKg ? Number(form.fatherWeightKg) : null,
      });
      setForm(toForm(defaults));
      setSaved(true);
      onSaved?.(defaults);
    } catch (err) {
      setError(displayError(err, t.parents.failedToSave));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">{t.common.loading}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <HeightField
          valueCm={form.motherHeightCm}
          onChangeCm={(cm) => update("motherHeightCm", cm)}
          units={units}
          t={t}
          metricLabel={t.units.mothersHeightLabel}
          groupLabel={t.units.mothersHeightGroupLabel}
          placeholder={t.parents.optionalPlaceholder}
        />
        <HeightField
          valueCm={form.fatherHeightCm}
          onChangeCm={(cm) => update("fatherHeightCm", cm)}
          units={units}
          t={t}
          metricLabel={t.units.fathersHeightLabel}
          groupLabel={t.units.fathersHeightGroupLabel}
          placeholder={t.parents.optionalPlaceholder}
        />
        <WeightField
          valueKg={form.motherWeightKg}
          onChangeKg={(kg) => update("motherWeightKg", kg)}
          units={units}
          t={t}
          label={t.units.mothersWeightLabel}
          placeholder={t.parents.optionalPlaceholder}
        />
        <WeightField
          valueKg={form.fatherWeightKg}
          onChangeKg={(kg) => update("fatherWeightKg", kg)}
          units={units}
          t={t}
          label={t.units.fathersWeightLabel}
          placeholder={t.parents.optionalPlaceholder}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      {saved && !error && (
        <p role="status" className="text-sm font-medium text-primary-700">
          {t.parents.saved}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? t.parents.saving : (submitLabel ?? t.parents.save)}
        </Button>
        {secondaryAction}
      </div>
    </form>
  );
}

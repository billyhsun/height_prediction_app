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
  type ParentDefaults,
} from "@notch/core";
import { useTranslations } from "@/lib/i18n/context";
import { Button, Field, Input } from "@/components/ui";

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
            PARENT_LIMITS.heightCm.min,
            PARENT_LIMITS.heightCm.max,
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
            PARENT_LIMITS.weightKg.min,
            PARENT_LIMITS.weightKg.max,
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
        <Field label={t.parents.mothersHeightCm}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              step="0.1"
              min={PARENT_LIMITS.heightCm.min}
              max={PARENT_LIMITS.heightCm.max}
              placeholder={t.parents.optionalPlaceholder}
              value={form.motherHeightCm}
              onChange={(e) => update("motherHeightCm", e.target.value)}
            />
          )}
        </Field>
        <Field label={t.parents.fathersHeightCm}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              step="0.1"
              min={PARENT_LIMITS.heightCm.min}
              max={PARENT_LIMITS.heightCm.max}
              placeholder={t.parents.optionalPlaceholder}
              value={form.fatherHeightCm}
              onChange={(e) => update("fatherHeightCm", e.target.value)}
            />
          )}
        </Field>
        <Field label={t.parents.mothersWeightKg}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              step="0.1"
              min={PARENT_LIMITS.weightKg.min}
              max={PARENT_LIMITS.weightKg.max}
              placeholder={t.parents.optionalPlaceholder}
              value={form.motherWeightKg}
              onChange={(e) => update("motherWeightKg", e.target.value)}
            />
          )}
        </Field>
        <Field label={t.parents.fathersWeightKg}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              step="0.1"
              min={PARENT_LIMITS.weightKg.min}
              max={PARENT_LIMITS.weightKg.max}
              placeholder={t.parents.optionalPlaceholder}
              value={form.fatherWeightKg}
              onChange={(e) => update("fatherWeightKg", e.target.value)}
            />
          )}
        </Field>
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

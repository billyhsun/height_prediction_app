"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  createChild,
  fetchChild,
  updateChild,
  type ChildInput,
} from "@/lib/children";
import {
  ETHNICITY_VALUES,
  type EthnicityValue,
} from "@/lib/ethnicities";
import { useTranslations } from "@/lib/i18n/context";
import { displayError } from "@/lib/request-error";

type ChildFormProps = {
  childId?: string;
};

const EMPTY: ChildInput = {
  displayName: "",
  sex: 1,
  dateOfBirth: "",
  motherHeightCm: null,
  fatherHeightCm: null,
  ethnicities: [],
};

export function ChildForm({ childId }: ChildFormProps) {
  const router = useRouter();
  const t = useTranslations();
  const isEdit = Boolean(childId);

  const [form, setForm] = useState<ChildInput>(EMPTY);
  const [motherHeight, setMotherHeight] = useState("");
  const [fatherHeight, setFatherHeight] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!childId) return;

    fetchChild(childId)
      .then((child) => {
        setForm({
          displayName: child.displayName,
          sex: child.sex,
          dateOfBirth: child.dateOfBirth,
          motherHeightCm: child.motherHeightCm,
          fatherHeightCm: child.fatherHeightCm,
          ethnicities: child.ethnicities,
        });
        setMotherHeight(
          child.motherHeightCm != null ? String(child.motherHeightCm) : "",
        );
        setFatherHeight(
          child.fatherHeightCm != null ? String(child.fatherHeightCm) : "",
        );
      })
      .catch((err) => setError(displayError(err, t.childForm.failedToLoad)))
      .finally(() => setLoading(false));
    // Refetching on locale change would discard in-progress edits; t is only
    // used for a fallback message here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  function toggleEthnicity(value: EthnicityValue) {
    setForm((prev) => {
      const current = prev.ethnicities ?? [];
      return {
        ...prev,
        ethnicities: current.includes(value)
          ? current.filter((entry) => entry !== value)
          : [...current, value],
      };
    });
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const motherHeightCm = motherHeight ? Number(motherHeight) : null;
    const fatherHeightCm = fatherHeight ? Number(fatherHeight) : null;

    if (
      (motherHeightCm && !fatherHeightCm) ||
      (!motherHeightCm && fatherHeightCm)
    ) {
      setError(t.childForm.bothParentHeightsRequired);
      setSaving(false);
      return;
    }

    const input: ChildInput = {
      ...form,
      motherHeightCm,
      fatherHeightCm,
    };

    try {
      if (isEdit && childId) {
        await updateChild(childId, input);
      } else {
        await createChild(input);
      }
      router.push("/children");
    } catch (err) {
      setError(displayError(err, t.childForm.failedToSave));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-text-secondary">{t.common.loading}</p>;
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-text-primary">
          {isEdit ? t.childForm.editTitle : t.childForm.addTitle}
        </h1>
        <p className="text-sm text-text-secondary">{t.childForm.subtitle}</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset className="space-y-4 rounded-lg border border-border bg-surface p-5">
          <legend className="px-1 text-sm font-medium text-text-primary">
            {t.childForm.profileLegend}
          </legend>

          <label className="block space-y-1">
            <span className="text-sm text-text-secondary">{t.childForm.name}</span>
            <input
              type="text"
              required
              value={form.displayName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, displayName: e.target.value }))
              }
              placeholder={t.childForm.namePlaceholder}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </label>

          <div className="space-y-2">
            <span className="text-sm text-text-secondary">{t.form.sex}</span>
            <div className="flex gap-2">
              {[
                { value: 1, label: t.common.male },
                { value: 2, label: t.common.female },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, sex: option.value }))
                  }
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                    form.sex === option.value
                      ? "border-primary-600 bg-primary-50 text-primary-800"
                      : "border-border bg-surface text-text-primary hover:bg-neutral-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-sm text-text-secondary">
              {t.childForm.dateOfBirth}
            </span>
            <input
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={form.dateOfBirth}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))
              }
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </label>

          <div className="space-y-2">
            <span className="text-sm text-text-secondary">
              {t.childForm.ethnicityLabel}
            </span>
            <p className="text-xs text-text-muted">
              {t.childForm.ethnicityHelp}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ETHNICITY_VALUES.map((value) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-text-primary hover:bg-neutral-50"
                >
                  <input
                    type="checkbox"
                    checked={form.ethnicities?.includes(value) ?? false}
                    onChange={() => toggleEthnicity(value)}
                    className="rounded border-border-strong"
                  />
                  {t.ethnicity[value]}
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-border bg-surface p-5">
          <legend className="px-1 text-sm font-medium text-text-primary">
            {t.childForm.parentHeightsLegend}
          </legend>
          <p className="text-xs text-text-muted">
            {t.childForm.parentHeightsHelp}
          </p>

          <label className="block space-y-1">
            <span className="text-sm text-text-secondary">
              {t.childForm.mothersHeightCm}
            </span>
            <input
              type="number"
              min={120}
              max={220}
              step={0.1}
              value={motherHeight}
              onChange={(e) => setMotherHeight(e.target.value)}
              placeholder={t.common.egPlaceholder("165")}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-text-secondary">
              {t.childForm.fathersHeightCm}
            </span>
            <input
              type="number"
              min={120}
              max={220}
              step={0.1}
              value={fatherHeight}
              onChange={(e) => setFatherHeight(e.target.value)}
              placeholder={t.common.egPlaceholder("178")}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </label>
        </fieldset>

        {error && (
          <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {saving
              ? t.childForm.saving
              : isEdit
                ? t.childForm.saveChanges
                : t.childForm.addChild}
          </button>
          <Link
            href="/children"
            className="rounded-md border border-border px-4 py-2 text-sm text-text-primary hover:bg-neutral-50"
          >
            {t.common.cancel}
          </Link>
        </div>
      </form>
    </div>
  );
}

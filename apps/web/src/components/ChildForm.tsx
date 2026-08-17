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

type ChildFormProps = {
  childId?: string;
};

const EMPTY: ChildInput = {
  displayName: "",
  sex: 1,
  dateOfBirth: "",
  motherHeightCm: null,
  fatherHeightCm: null,
};

export function ChildForm({ childId }: ChildFormProps) {
  const router = useRouter();
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
        });
        setMotherHeight(
          child.motherHeightCm != null ? String(child.motherHeightCm) : "",
        );
        setFatherHeight(
          child.fatherHeightCm != null ? String(child.fatherHeightCm) : "",
        );
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load child"),
      )
      .finally(() => setLoading(false));
  }, [childId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const motherHeightCm = motherHeight ? Number(motherHeight) : null;
    const fatherHeightCm = fatherHeight ? Number(fatherHeight) : null;

    if (
      (motherHeightCm && !fatherHeightCm) ||
      (!motherHeightCm && fatherHeightCm)
    ) {
      setError("Please enter both parent heights, or leave both blank.");
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
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading…</p>;
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">
          {isEdit ? "Edit child" : "Add child"}
        </h1>
        <p className="text-sm text-slate-600">
          Birth date and sex are used to auto-fill the prediction form.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <legend className="px-1 text-sm font-medium text-slate-700">
            Profile
          </legend>

          <label className="block space-y-1">
            <span className="text-sm text-slate-600">Name</span>
            <input
              type="text"
              required
              value={form.displayName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, displayName: e.target.value }))
              }
              placeholder="e.g. Alex"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="space-y-2">
            <span className="text-sm text-slate-600">Sex</span>
            <div className="flex gap-2">
              {[
                { value: 1, label: "Male" },
                { value: 2, label: "Female" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, sex: option.value }))
                  }
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                    form.sex === option.value
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-sm text-slate-600">Date of birth</span>
            <input
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={form.dateOfBirth}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <legend className="px-1 text-sm font-medium text-slate-700">
            Parent heights (optional)
          </legend>
          <p className="text-xs text-slate-500">
            Saved on the profile and auto-filled for LLM predictions.
          </p>

          <label className="block space-y-1">
            <span className="text-sm text-slate-600">Mother&apos;s height (cm)</span>
            <input
              type="number"
              min={120}
              max={220}
              step={0.1}
              value={motherHeight}
              onChange={(e) => setMotherHeight(e.target.value)}
              placeholder="e.g. 165"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-slate-600">Father&apos;s height (cm)</span>
            <input
              type="number"
              min={120}
              max={220}
              step={0.1}
              value={fatherHeight}
              onChange={(e) => setFatherHeight(e.target.value)}
              placeholder="e.g. 178"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </fieldset>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add child"}
          </button>
          <Link
            href="/children"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

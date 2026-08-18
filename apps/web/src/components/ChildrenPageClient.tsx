"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ageYearsFromDateOfBirth, formatDateOfBirth } from "@/lib/age";
import {
  deleteChild,
  fetchChildren,
  type ChildProfile,
} from "@/lib/children";
import { formatEthnicities } from "@/lib/ethnicities";
import { sexLabel } from "@/lib/prediction-session";

export function ChildrenPageClient() {
  const router = useRouter();
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchChildren()
      .then(setChildren)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load children"),
      )
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this child profile? Saved predictions will be kept.")) {
      return;
    }
    try {
      await deleteChild(id);
      setChildren((prev) => prev.filter((child) => child.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete child");
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading children…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">My children</h1>
        <p className="text-sm text-slate-600">
          Manage child profiles. Selecting a profile on the prediction form
          auto-fills sex and age from their birth date.
        </p>
      </header>

      <Link
        href="/children/new"
        className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Add child
      </Link>

      {children.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-600">No child profiles yet.</p>
          <p className="mt-2 text-xs text-slate-500">
            Add a profile to track multiple children and auto-fill the prediction
            form.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {children.map((child) => {
            const age = ageYearsFromDateOfBirth(child.dateOfBirth);
            return (
              <li
                key={child.id}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {child.displayName}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {sexLabel(child.sex)} · born{" "}
                      {formatDateOfBirth(child.dateOfBirth)} · age {age}
                    </p>
                    {(child.motherHeightCm || child.fatherHeightCm) && (
                      <p className="mt-1 text-xs text-slate-500">
                        Parents:{" "}
                        {child.motherHeightCm
                          ? `mother ${child.motherHeightCm} cm`
                          : ""}
                        {child.motherHeightCm && child.fatherHeightCm
                          ? ", "
                          : ""}
                        {child.fatherHeightCm
                          ? `father ${child.fatherHeightCm} cm`
                          : ""}
                      </p>
                    )}
                    {child.ethnicities.length > 0 && (
                      <p className="mt-1 text-xs text-slate-500">
                        Ethnicity: {formatEthnicities(child.ethnicities)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/?child=${child.id}`)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      Predict
                    </button>
                    <Link
                      href={`/children/${child.id}/edit`}
                      className="text-xs text-slate-600 hover:text-slate-900"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(child.id)}
                      className="text-xs text-slate-500 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

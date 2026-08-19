"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";

import { deleteAccount } from "@/lib/account";
import { useTranslations } from "@/lib/i18n/context";
import { displayError } from "@/lib/request-error";

export function AccountPageClient() {
  const t = useTranslations();
  const { signOut } = useClerk();
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed =
    confirmation.trim().toUpperCase() === t.account.confirmWord.toUpperCase();

  async function handleDelete() {
    if (!confirmed) return;
    setDeleting(true);
    setError(null);

    try {
      await deleteAccount();
      // The Clerk user no longer exists, so the local session has to be cleared
      // too — otherwise the app keeps rendering as if signed in until the stale
      // token is rejected.
      await signOut({ redirectUrl: "/" });
    } catch (err) {
      setError(displayError(err, t.account.failed));
      setDeleting(false);
    }
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-text-primary">
          {t.account.title}
        </h1>
        <p className="text-sm text-text-secondary">{t.account.subtitle}</p>
      </header>

      <section className="space-y-4 rounded-lg border border-danger-600/20 bg-surface p-5">
        <h2 className="text-sm font-medium text-danger-700">
          {t.account.dangerHeading}
        </h2>
        <p className="text-sm text-text-secondary">{t.account.dangerBody}</p>

        <label className="block space-y-1">
          <span className="text-sm text-text-secondary">
            {t.account.confirmPrompt(t.account.confirmWord)}
          </span>
          <input
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={t.account.confirmPlaceholder}
            autoComplete="off"
            disabled={deleting}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </label>

        {error && (
          <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleDelete}
          disabled={!confirmed || deleting}
          className="rounded-md bg-danger-600 px-4 py-2 text-sm font-medium text-white hover:bg-danger-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleting ? t.account.deleting : t.account.deleteButton}
        </button>
      </section>
    </div>
  );
}

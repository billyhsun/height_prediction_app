import type { Metadata } from "next";

import { DeleteAccountPageClient } from "@/components/DeleteAccountPageClient";

export const metadata: Metadata = {
  title: "Delete your account — Heightmaxxing AI",
  description:
    "How to delete your Heightmaxxing AI account and data, in the app, on the web, or by email, and exactly what is deleted.",
};

export default function DeleteAccountPage() {
  return (
    <div className="px-4 py-10">
      <main className="mx-auto flex justify-center">
        <DeleteAccountPageClient />
      </main>
    </div>
  );
}

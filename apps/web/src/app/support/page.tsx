import type { Metadata } from "next";

import { SupportPageClient } from "@/components/SupportPageClient";

export const metadata: Metadata = {
  title: "Support — Heightmaxxing AI",
  description:
    "Help with Heightmaxxing AI: how predictions work, accounts and sign-in, deleting your data, and how to contact us.",
};

export default function SupportPage() {
  return (
    <div className="px-4 py-10">
      <main className="mx-auto flex justify-center">
        <SupportPageClient />
      </main>
    </div>
  );
}

import { LegalPage } from "@/components/LegalPage";

export default function PrivacyPage() {
  return (
    <div className="px-4 py-10">
      <main className="mx-auto flex justify-center">
        <LegalPage document="privacy" />
      </main>
    </div>
  );
}

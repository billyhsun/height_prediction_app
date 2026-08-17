import { Suspense } from "react";
import type { Metadata } from "next";
import { ResultsPageClient } from "@/components/ResultsPageClient";

export const metadata: Metadata = {
  title: "Results | Child Height Predictor",
  description: "Prediction results for height, weight, and BMI",
};

export default function ResultsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-600">Loading results…</p>}>
      <ResultsPageClient />
    </Suspense>
  );
}

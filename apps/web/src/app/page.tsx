import { Suspense } from "react";
import { PredictionForm } from "@/components/PredictionForm";

export default function Home() {
  return (
    <div className="min-h-full bg-slate-100 py-10 px-4">
      <main className="mx-auto flex justify-center">
        <Suspense>
          <PredictionForm />
        </Suspense>
      </main>
    </div>
  );
}

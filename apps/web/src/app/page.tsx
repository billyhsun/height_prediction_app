import { Suspense } from "react";
import { PredictionForm } from "@/components/PredictionForm";

export default function Home() {
  return (
    <div className="px-4 py-10">
      <main className="mx-auto flex justify-center">
        <Suspense>
          <PredictionForm />
        </Suspense>
      </main>
    </div>
  );
}

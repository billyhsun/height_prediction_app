import { ChildForm } from "@/components/ChildForm";
import { RequireAuth } from "@/components/RequireAuth";

export default function NewChildScreen() {
  return (
    <RequireAuth>
      <ChildForm />
    </RequireAuth>
  );
}

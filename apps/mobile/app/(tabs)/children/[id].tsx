import { useLocalSearchParams } from "expo-router";

import { ChildForm } from "@/components/ChildForm";
import { RequireAuth } from "@/components/RequireAuth";

export default function EditChildScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <RequireAuth>
      <ChildForm childId={Array.isArray(id) ? id[0] : id} />
    </RequireAuth>
  );
}

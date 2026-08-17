export type ChildProfile = {
  id: string;
  displayName: string;
  sex: number;
  dateOfBirth: string;
  motherHeightCm: number | null;
  fatherHeightCm: number | null;
  ethnicities: string[];
  createdAt: string;
  updatedAt: string;
};

export type ChildInput = {
  displayName: string;
  sex: number;
  dateOfBirth: string;
  motherHeightCm?: number | null;
  fatherHeightCm?: number | null;
  ethnicities?: string[];
};

export async function fetchChildren(): Promise<ChildProfile[]> {
  const res = await fetch("/api/user/children");
  if (res.status === 401) return [];
  if (!res.ok) throw new Error("Failed to load children");
  return res.json();
}

export async function fetchChild(id: string): Promise<ChildProfile> {
  const res = await fetch(`/api/user/children/${id}`);
  if (!res.ok) throw new Error("Failed to load child");
  return res.json();
}

export async function createChild(input: ChildInput): Promise<ChildProfile> {
  const res = await fetch("/api/user/children", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to create child");
  }
  return res.json();
}

export async function updateChild(
  id: string,
  input: Partial<ChildInput>,
): Promise<ChildProfile> {
  const res = await fetch(`/api/user/children/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to update child");
  }
  return res.json();
}

export async function deleteChild(id: string): Promise<void> {
  const res = await fetch(`/api/user/children/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete child");
}

import { GenericRequestError } from "@/lib/request-error";

/**
 * Permanently deletes the signed-in user's account and all of their data.
 * Irreversible — callers must confirm with the user first.
 */
export async function deleteAccount(): Promise<void> {
  const res = await fetch("/api/user/account", { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // The route distinguishes "nothing was removed" from "data gone, sign-in
    // remains", so its message is worth showing verbatim.
    if (err.error) throw new Error(err.error);
    throw new GenericRequestError("DELETE /account failed", res.status);
  }
}

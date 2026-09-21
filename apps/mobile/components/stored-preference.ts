import { useCallback, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

/**
 * A small device-local preference, remembered across launches.
 *
 * Stored in the keychain rather than a cookie — the web's mechanism — because
 * it is the only key-value store already on the dependency list. Neither the UI
 * language nor the unit system is a secret, and SecureStore is heavier than
 * either needs, but that beats pulling in AsyncStorage for two enum values.
 *
 * The stored value is read asynchronously after mount, so the first frame shows
 * the default and corrects itself a tick later. Worth the flash: the
 * alternative is blocking the whole app behind a keychain read. Writes are
 * fire-and-forget — persistence is incidental, and its failure must not stop
 * the preference changing for this session.
 */
export function useStoredPreference<T extends string>(
  key: string,
  isValid: (value: unknown) => value is T,
  fallback: T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    let cancelled = false;
    SecureStore.getItemAsync(key)
      .then((stored) => {
        if (!cancelled && isValid(stored)) setValue(stored);
      })
      // An unreadable preference is not worth surfacing; the default stands.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // `isValid` is a module-level guard in every caller, so it is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      SecureStore.setItemAsync(key, next).catch(() => {});
    },
    [key],
  );

  return [value, set];
}

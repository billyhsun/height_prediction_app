import { useAuth } from "@clerk/clerk-expo";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";

/** Free-tier caps when the user is not Premium. */
export const FREE_HISTORY_LIMIT = 5;
export const FREE_CHILD_LIMIT = 1;

const PREMIUM_ENTITLEMENT = "premium";

type EntitlementsValue = {
  /** True once RevenueCat (or the offline fallback) has resolved. */
  ready: boolean;
  isPremium: boolean;
  /** Offerings / packages available to purchase, when configured. */
  packageIdentifier: string | null;
  purchasePremium: () => Promise<"ok" | "cancelled" | "error">;
  restorePurchases: () => Promise<"ok" | "empty" | "error">;
  refresh: () => Promise<void>;
};

const EntitlementsContext = createContext<EntitlementsValue | null>(null);

type PurchasesApi = {
  configure: (opts: { apiKey: string; appUserID?: string }) => void;
  logIn: (appUserID: string) => Promise<unknown>;
  getCustomerInfo: () => Promise<{
    entitlements: { active: Record<string, unknown> };
  }>;
  getOfferings: () => Promise<{
    current: {
      availablePackages: { identifier: string }[];
      lifetime?: { identifier: string } | null;
    } | null;
  }>;
  purchasePackage: (
    pkg: unknown,
  ) => Promise<{
    customerInfo: { entitlements: { active: Record<string, unknown> } };
  }>;
  restorePurchases: () => Promise<{
    entitlements: { active: Record<string, unknown> };
  }>;
};

function loadPurchases(): PurchasesApi | null {
  try {
    // Native module — absent in Expo Go / web previews.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-purchases") as
      | PurchasesApi
      | { default: PurchasesApi };
    return "configure" in mod ? mod : mod.default;
  } catch {
    return null;
  }
}

function apiKeyForPlatform(): string | undefined {
  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  }
  if (Platform.OS === "android") {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  }
  return undefined;
}

/**
 * Premium entitlements via RevenueCat.
 *
 * Without API keys (or without the native module), everyone stays on the free
 * tier unless EXPO_PUBLIC_DEV_PREMIUM=true for local UX testing.
 */
export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const { userId, isLoaded } = useAuth();
  const [ready, setReady] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [packageIdentifier, setPackageIdentifier] = useState<string | null>(
    null,
  );

  const refresh = useCallback(async () => {
    if (process.env.EXPO_PUBLIC_DEV_PREMIUM === "true") {
      setIsPremium(true);
      setReady(true);
      return;
    }

    const Purchases = loadPurchases();
    const apiKey = apiKeyForPlatform();
    if (!Purchases || !apiKey) {
      setIsPremium(false);
      setPackageIdentifier(null);
      setReady(true);
      return;
    }

    try {
      const info = await Purchases.getCustomerInfo();
      setIsPremium(
        Boolean(info.entitlements.active[PREMIUM_ENTITLEMENT]),
      );
      const offerings = await Purchases.getOfferings();
      const pkg =
        offerings.current?.availablePackages[0] ??
        offerings.current?.lifetime ??
        null;
      setPackageIdentifier(pkg?.identifier ?? null);
    } catch {
      setIsPremium(false);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    let cancelled = false;

    async function configure() {
      if (process.env.EXPO_PUBLIC_DEV_PREMIUM === "true") {
        if (!cancelled) {
          setIsPremium(true);
          setReady(true);
        }
        return;
      }

      const Purchases = loadPurchases();
      const apiKey = apiKeyForPlatform();
      if (!Purchases || !apiKey) {
        if (!cancelled) {
          setIsPremium(false);
          setReady(true);
        }
        return;
      }

      try {
        Purchases.configure({
          apiKey,
          appUserID: userId ?? undefined,
        });
        if (userId) {
          await Purchases.logIn(userId);
        }
        if (!cancelled) await refresh();
      } catch {
        if (!cancelled) {
          setIsPremium(false);
          setReady(true);
        }
      }
    }

    configure();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, userId, refresh]);

  const purchasePremium = useCallback(async () => {
    const Purchases = loadPurchases();
    if (!Purchases) return "error";
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.availablePackages[0];
      if (!pkg) return "error";
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const active = Boolean(
        customerInfo.entitlements.active[PREMIUM_ENTITLEMENT],
      );
      setIsPremium(active);
      return active ? "ok" : "error";
    } catch (err: unknown) {
      const userCancelled =
        typeof err === "object" &&
        err !== null &&
        "userCancelled" in err &&
        Boolean((err as { userCancelled?: boolean }).userCancelled);
      return userCancelled ? "cancelled" : "error";
    }
  }, []);

  const restorePurchases = useCallback(async () => {
    const Purchases = loadPurchases();
    if (!Purchases) return "error";
    try {
      const info = await Purchases.restorePurchases();
      const active = Boolean(info.entitlements.active[PREMIUM_ENTITLEMENT]);
      setIsPremium(active);
      return active ? "ok" : "empty";
    } catch {
      return "error";
    }
  }, []);

  const value = useMemo<EntitlementsValue>(
    () => ({
      ready,
      isPremium,
      packageIdentifier,
      purchasePremium,
      restorePurchases,
      refresh,
    }),
    [
      ready,
      isPremium,
      packageIdentifier,
      purchasePremium,
      restorePurchases,
      refresh,
    ],
  );

  return (
    <EntitlementsContext.Provider value={value}>
      {children}
    </EntitlementsContext.Provider>
  );
}

export function useEntitlements(): EntitlementsValue {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) {
    throw new Error("useEntitlements must be used within EntitlementsProvider");
  }
  return ctx;
}

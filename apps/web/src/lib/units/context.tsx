"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import {
  DEFAULT_UNIT_SYSTEM,
  UNITS_COOKIE,
  UNITS_COOKIE_MAX_AGE,
  type UnitSystem,
} from "@notch/core";

type UnitsValue = {
  units: UnitSystem;
  setUnits: (units: UnitSystem) => void;
};

const UnitsContext = createContext<UnitsValue | null>(null);

/**
 * Holds the metric/imperial preference in React state so switching re-renders
 * instantly, and mirrors it into a cookie so the server picks the same value on
 * the next request.
 *
 * `initialUnits` comes from that cookie, read in the root layout. Passing it in
 * rather than reading it here keeps the first client render identical to the
 * server render, which avoids a hydration mismatch — the same reasoning as
 * LocaleProvider.
 *
 * Unlike the locale, this needs no `router.refresh()`: no server component
 * renders a measurement, and Clerk's own UI has nothing to say about units.
 */
export function UnitsProvider({
  initialUnits,
  children,
}: {
  initialUnits: UnitSystem;
  children: React.ReactNode;
}) {
  const [units, setUnitsState] = useState<UnitSystem>(initialUnits);

  const setUnits = useCallback((next: UnitSystem) => {
    setUnitsState(next);
    document.cookie = `${UNITS_COOKIE}=${next}; path=/; max-age=${UNITS_COOKIE_MAX_AGE}; samesite=lax`;
  }, []);

  const value = useMemo(() => ({ units, setUnits }), [units, setUnits]);

  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits(): UnitsValue {
  const context = useContext(UnitsContext);
  if (!context) {
    throw new Error("useUnits must be used inside a UnitsProvider");
  }
  return context;
}

export { DEFAULT_UNIT_SYSTEM };

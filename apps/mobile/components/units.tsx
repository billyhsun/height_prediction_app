import { createContext, useContext, useMemo } from "react";

import {
  DEFAULT_UNIT_SYSTEM,
  isUnitSystem,
  type UnitSystem,
} from "@notch/core";

import { useStoredPreference } from "@/components/stored-preference";

type UnitsValue = {
  units: UnitSystem;
  setUnits: (units: UnitSystem) => void;
};

const UnitsContext = createContext<UnitsValue | null>(null);

const UNITS_KEY = "notch.units";

/**
 * Holds the metric/imperial preference for the whole app.
 *
 * Deliberately separate from the signed-in account: it describes the reader,
 * not the data, and switching it must never be mistaken for editing a
 * measurement. Everything underneath stays in centimetres and kilograms — see
 * units.ts in core.
 */
export function UnitsProvider({ children }: { children: React.ReactNode }) {
  const [units, setUnits] = useStoredPreference<UnitSystem>(
    UNITS_KEY,
    isUnitSystem,
    DEFAULT_UNIT_SYSTEM,
  );

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

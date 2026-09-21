"use client";

import { UNIT_SYSTEMS } from "@notch/core";
import { SegmentedControl } from "@/components/ui";
import { useTranslations } from "@/lib/i18n/context";
import { useUnits } from "@/lib/units/context";

/**
 * Spelled out as "Metric"/"Imperial" rather than the "cm"/"ft" the phone header
 * uses. The desktop header has the room, and the words also cover weight, which
 * an abbreviation naming only a length unit does not.
 */
export function UnitsToggle() {
  const { units, setUnits } = useUnits();
  const t = useTranslations();

  return (
    <div className="w-[10.5rem]">
      <SegmentedControl
        size="sm"
        label={t.units.settingLabel}
        value={units}
        onChange={setUnits}
        options={UNIT_SYSTEMS.map((option) => ({
          value: option,
          label: option === "metric" ? t.units.metric : t.units.imperial,
        }))}
      />
    </div>
  );
}

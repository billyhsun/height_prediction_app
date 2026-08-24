/**
 * React Native implementations of the shared design-system primitives.
 *
 * The prop APIs deliberately mirror apps/web/src/components/ui, so a screen
 * written against one translates to the other rather than being redesigned. Both
 * read their values from the same token module in @notch/core.
 *
 * One API differs on purpose: Select takes an options array instead of <option>
 * children, because there is no DOM select to feed.
 */
export { Button, type ButtonVariant, type ButtonSize } from "./Button";
export { Field, Input, Select, type SelectOption } from "./Field";
export { SegmentedControl, type SegmentOption } from "./SegmentedControl";
export { OptionGrid, type Option } from "./OptionGrid";
export { Card, Section, Badge, Stat } from "./Card";
export { GrowthChart, type GrowthChartLabels } from "./GrowthChart";
export { theme, fontSize, elevation } from "./theme";

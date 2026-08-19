/**
 * Design-system primitives.
 *
 * Screens should compose these rather than writing raw Tailwind, because these
 * are the components React Native will reimplement against the same tokens.
 * Every screen expressed in terms of this API ports without being redesigned.
 */
export { Button, type ButtonVariant, type ButtonSize } from "./Button";
export { Field, Input, Select } from "./Field";
export { SegmentedControl, type SegmentOption } from "./SegmentedControl";
export { OptionGrid, type Option } from "./OptionGrid";
export { Card, Section, Badge, Stat } from "./Card";
export { GrowthChart, type GrowthChartLabels } from "./GrowthChart";

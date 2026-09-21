/**
 * Chart geometry — pure functions, no DOM and no React.
 *
 * Kept separate from the rendering component so React Native reuses this file
 * unchanged. Only the drawing layer differs between platforms, and even that is
 * close: `react-native-svg` exposes the same element names (Svg, Path, Circle,
 * Line, Text) as inline SVG, which is why the chart is hand-drawn rather than
 * built on Recharts — Recharts has no React Native equivalent at all.
 */

export type ChartPoint = {
  ageYears: number;
  heightCm: number;
};

export type ChartGeometry = {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
};

export type Scales = {
  x: (ageYears: number) => number;
  y: (heightCm: number) => number;
  xTicks: number[];
  yTicks: number[];
  plot: { left: number; right: number; top: number; bottom: number };
};

/** Rounds a domain outward to pleasant step boundaries. */
function niceDomain(
  min: number,
  max: number,
  step: number,
): [number, number] {
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  // Guard against a zero-height domain when every value is identical.
  return lo === hi ? [lo - step, hi + step] : [lo, hi];
}

function ticks(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) {
    out.push(Number(v.toFixed(4)));
  }
  return out;
}

/**
 * Builds scales covering every supplied point.
 *
 * The y domain is padded to a 5 cm boundary rather than fitted tightly, because
 * a tight fit exaggerates small differences — and with predicted heights that
 * cluster within a few centimetres, a tight axis would misleadingly imply a
 * dramatic spread.
 */
export function buildScales(
  points: ChartPoint[],
  geometry: ChartGeometry,
): Scales {
  const { width, height, padding } = geometry;
  const plot = {
    left: padding.left,
    right: width - padding.right,
    top: padding.top,
    bottom: height - padding.bottom,
  };

  const ages = points.map((p) => p.ageYears);
  const heights = points.map((p) => p.heightCm);

  const [ageMin, ageMax] = niceDomain(
    Math.min(...ages),
    Math.max(...ages),
    1,
  );
  const [hMin, hMax] = niceDomain(
    Math.min(...heights) - 2,
    Math.max(...heights) + 2,
    5,
  );

  const spanX = ageMax - ageMin || 1;
  const spanY = hMax - hMin || 1;

  const ageStep = spanX > 12 ? 4 : spanX > 6 ? 2 : 1;
  const heightStep = spanY > 60 ? 20 : spanY > 30 ? 10 : 5;

  return {
    x: (age) => plot.left + ((age - ageMin) / spanX) * (plot.right - plot.left),
    y: (cm) => plot.bottom - ((cm - hMin) / spanY) * (plot.bottom - plot.top),
    xTicks: ticks(ageMin, ageMax, ageStep),
    yTicks: ticks(hMin, hMax, heightStep),
    plot,
  };
}

/** An SVG path through the points, in order. */
export function linePath(points: ChartPoint[], scales: Scales): string {
  return points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${scales.x(p.ageYears).toFixed(2)} ${scales
          .y(p.heightCm)
          .toFixed(2)}`,
    )
    .join(" ");
}

/**
 * A closed path spanning two curves, for shading the space between them.
 *
 * The upper edge is drawn forward and the lower returned, so the fill is the
 * region between. Used for the prediction interval, whose two edges are the
 * same growth curve anchored to different endpoints — which is why the band
 * pinches to nothing at the measurement and opens only towards the target age.
 * That shape is the honest one: the model reports an interval at the horizon
 * it was asked about, not a calibrated width at every intermediate age.
 */
export function bandPath(
  upper: ChartPoint[],
  lower: ChartPoint[],
  scales: Scales,
): string {
  if (upper.length === 0 || lower.length === 0) return "";

  const at = (p: ChartPoint) =>
    `${scales.x(p.ageYears).toFixed(2)} ${scales.y(p.heightCm).toFixed(2)}`;

  const forward = upper.map((p, i) => `${i === 0 ? "M" : "L"} ${at(p)}`);
  const back = [...lower].reverse().map((p) => `L ${at(p)}`);
  return [...forward, ...back, "Z"].join(" ");
}

/**
 * Collapses observed points to one per age, keeping the most recent.
 *
 * Several predictions are often run for the same child at the same age; plotting
 * each would stack duplicate dots and make the line double back on itself.
 */
export function dedupeByAge(points: ChartPoint[]): ChartPoint[] {
  const byAge = new Map<number, ChartPoint>();
  for (const point of points) {
    byAge.set(Number(point.ageYears.toFixed(2)), point);
  }
  return [...byAge.values()].sort((a, b) => a.ageYears - b.ageYears);
}

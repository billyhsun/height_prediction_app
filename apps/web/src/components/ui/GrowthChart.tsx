"use client";

import {
  bandPath,
  buildScales,
  dedupeByAge,
  linePath,
  type ChartPoint,
} from "@notch/core";
import { growthProjection } from "@notch/core";

export type GrowthChartLabels = {
  title: string;
  observed: string;
  predicted: string;
  llmPredicted: string;
  ageAxis: string;
  heightAxis: string;
  /** Legend text for the shaded interval. Omitted when no model supplies one. */
  range?: string;
};

type GrowthChartProps = {
  /** Measured heights, in any order. Deduped and sorted internally. */
  observed: ChartPoint[];
  predicted: ChartPoint;
  llmPredicted?: ChartPoint | null;
  /** The model's calibrated interval at the target age, in the same unit as
   *  every other height here. Absent for models that do not report one. */
  predictedRange?: { low: number; high: number } | null;
  /** 1 = male, 2 = female. Selects the reference growth shape, since the
   *  pubertal spurt arrives earlier for girls. */
  sex: number;
  labels: GrowthChartLabels;
};

const VIEW = { width: 560, height: 260 };
const PADDING = { top: 16, right: 20, bottom: 24, left: 42 };

/**
 * Height against age: measured points, and where the models project the child
 * will land.
 *
 * Hand-drawn SVG rather than a charting library. `react-native-svg` mirrors
 * these element names, so the mobile port reimplements the same structure
 * instead of hunting for a Recharts equivalent that does not exist. The scale
 * maths lives in lib/design/chart.ts and is shared verbatim.
 *
 * Rendered with a viewBox and no fixed width so it scales to any container,
 * which is what makes it work unchanged on a phone.
 */
export function GrowthChart({
  observed,
  predicted,
  llmPredicted,
  predictedRange,
  sex,
  labels,
}: GrowthChartProps) {
  const points = dedupeByAge(observed);
  const edges: ChartPoint[] = predictedRange
    ? [
        { ageYears: predicted.ageYears, heightCm: predictedRange.low },
        { ageYears: predicted.ageYears, heightCm: predictedRange.high },
      ]
    : [];
  // The band's extremes join the domain, or the shading clips at the axis.
  const all = [
    ...points,
    predicted,
    ...(llmPredicted ? [llmPredicted] : []),
    ...edges,
  ];
  const scales = buildScales(all, { ...VIEW, padding: PADDING });

  const last = points[points.length - 1];
  const observedPath = points.length > 1 ? linePath(points, scales) : null;

  // Follows a typical growth shape between the measurement and the prediction
  // rather than a straight line. Anchored at both ends, so it cannot imply a
  // height the model did not predict. Falls back to a direct segment when the
  // reference offers no shape (both ages past the growth plateau).
  const projection = growthProjection(last, predicted, sex);
  const projectionPath = projection.length
    ? linePath(projection, scales)
    : linePath([last, predicted], scales);

  // Both edges of the interval follow the same curve as the central estimate,
  // anchored to the interval's ends instead of the point prediction.
  const curveTo = (target: ChartPoint) => {
    const curve = growthProjection(last, target, sex);
    return curve.length ? curve : [last, target];
  };
  const rangeArea = predictedRange
    ? bandPath(curveTo(edges[1]), curveTo(edges[0]), scales)
    : null;

  const llmProjection = llmPredicted
    ? growthProjection(last, llmPredicted, sex)
    : [];
  const llmProjectionPath = llmPredicted
    ? linePath(llmProjection.length ? llmProjection : [last, llmPredicted], scales)
    : null;

  return (
    <figure className="m-0 flex flex-col gap-3">
      <figcaption className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold tracking-wide text-text-secondary uppercase">
          {labels.title}
        </span>
        <span className="text-xs text-text-muted">
          {labels.heightAxis} · {labels.ageAxis}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`${labels.title}. ${labels.heightAxis} / ${labels.ageAxis}.`}
      >
        {/* Drawn before everything so every line and marker sits on top of it. */}
        {rangeArea && (
          <path d={rangeArea} fill="var(--color-primary-500)" fillOpacity={0.12} />
        )}

        {/* Horizontal gridlines, drawn first so marks sit above them. */}
        {scales.yTicks.map((cm) => (
          <g key={`y-${cm}`}>
            <line
              x1={scales.plot.left}
              x2={scales.plot.right}
              y1={scales.y(cm)}
              y2={scales.y(cm)}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
            <text
              x={scales.plot.left - 8}
              y={scales.y(cm)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill="var(--color-text-muted)"
            >
              {cm}
            </text>
          </g>
        ))}

        {scales.xTicks.map((age) => (
          <text
            key={`x-${age}`}
            x={scales.x(age)}
            y={VIEW.height - 14}
            textAnchor="middle"
            fontSize={10}
            fill="var(--color-text-muted)"
          >
            {age}
          </text>
        ))}

        {/* Projection: measurement to the model's target, following a typical
            growth shape. Dashed so it reads as an estimate, not recorded data. */}
        <path
          d={projectionPath}
          fill="none"
          stroke="var(--color-primary-500)"
          strokeWidth={2}
          strokeDasharray="5 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {llmProjectionPath && (
          <path
            d={llmProjectionPath}
            fill="none"
            stroke="var(--color-accent-500)"
            strokeWidth={2}
            strokeDasharray="2 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {observedPath && (
          <path
            d={observedPath}
            fill="none"
            stroke="var(--color-primary-700)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {points.map((p) => (
          <circle
            key={`o-${p.ageYears}`}
            cx={scales.x(p.ageYears)}
            cy={scales.y(p.heightCm)}
            r={4}
            fill="var(--color-primary-700)"
          />
        ))}

        {/* Predictions get a ring rather than a filled dot, so measured and
            estimated points are distinguishable without relying on colour. */}
        <circle
          cx={scales.x(predicted.ageYears)}
          cy={scales.y(predicted.heightCm)}
          r={6}
          fill="var(--color-surface)"
          stroke="var(--color-primary-600)"
          strokeWidth={3}
        />

        {llmPredicted && (
          <circle
            cx={scales.x(llmPredicted.ageYears)}
            cy={scales.y(llmPredicted.heightCm)}
            r={6}
            fill="var(--color-surface)"
            stroke="var(--color-accent-600)"
            strokeWidth={3}
          />
        )}
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <LegendItem color="var(--color-primary-700)" label={labels.observed} />
        <LegendItem
          color="var(--color-primary-600)"
          label={labels.predicted}
          ring
        />
        {llmPredicted && (
          <LegendItem
            color="var(--color-accent-600)"
            label={labels.llmPredicted}
            ring
          />
        )}
        {rangeArea && labels.range && (
          <span className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span
              aria-hidden="true"
              className="h-2.5 w-4 rounded-[2px]"
              style={{ background: "var(--color-primary-500)", opacity: 0.25 }}
            />
            {labels.range}
          </span>
        )}
      </div>
    </figure>
  );
}

function LegendItem({
  color,
  label,
  ring = false,
}: {
  color: string;
  label: string;
  ring?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-text-secondary">
      <span
        aria-hidden="true"
        className="size-2.5 rounded-full"
        style={
          ring
            ? { border: `2.5px solid ${color}`, background: "var(--color-surface)" }
            : { background: color }
        }
      />
      {label}
    </span>
  );
}

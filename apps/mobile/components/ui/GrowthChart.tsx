import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";

import {
  buildScales,
  dedupeByAge,
  growthProjection,
  linePath,
  type ChartPoint,
} from "@notch/core";

import { fontSize, theme } from "./theme";

export type GrowthChartLabels = {
  title: string;
  observed: string;
  predicted: string;
  llmPredicted: string;
  ageAxis: string;
  heightAxis: string;
};

type GrowthChartProps = {
  observed: ChartPoint[];
  predicted: ChartPoint;
  llmPredicted?: ChartPoint | null;
  sex: number;
  labels: GrowthChartLabels;
};

const HEIGHT = 260;
const PADDING = { top: 16, right: 20, bottom: 24, left: 42 };

/**
 * The same chart as the web's, and deliberately so — the geometry, the scale
 * padding, the dedupe and the growth-curve projection all come from
 * @notch/core, unchanged. Only the drawing layer differs, and barely: this is
 * why the chart was hand-drawn in SVG rather than built on Recharts, which has
 * no React Native equivalent.
 *
 * The web sizes itself with a viewBox and no fixed width. React Native has no
 * intrinsic sizing, so the width is measured onLayout and the scales rebuilt
 * from it — which also means the chart adapts to rotation.
 */
export function GrowthChart({
  observed,
  predicted,
  llmPredicted,
  sex,
  labels,
}: GrowthChartProps) {
  const [width, setWidth] = useState(0);

  const points = dedupeByAge(observed);
  const all = [...points, predicted, ...(llmPredicted ? [llmPredicted] : [])];

  // Nothing sensible to draw before the first layout pass.
  const ready = width > 0 && all.length > 0;
  const scales = ready
    ? buildScales(all, { width, height: HEIGHT, padding: PADDING })
    : null;

  const last = points[points.length - 1];

  return (
    <View style={styles.figure}>
      <View style={styles.caption}>
        <Text style={styles.title}>{labels.title}</Text>
        <Text style={styles.units}>
          {labels.heightAxis} · {labels.ageAxis}
        </Text>
      </View>

      <View
        style={styles.plot}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {scales && last ? (
          <Svg width={width} height={HEIGHT}>
            {scales.yTicks.map((cm) => (
              <G key={`y-${cm}`}>
                <Line
                  x1={scales.plot.left}
                  x2={scales.plot.right}
                  y1={scales.y(cm)}
                  y2={scales.y(cm)}
                  stroke={theme.semantic.border}
                  strokeWidth={1}
                />
                <SvgText
                  x={scales.plot.left - 8}
                  y={scales.y(cm) + 3}
                  textAnchor="end"
                  fontSize={10}
                  fill={theme.semantic.textMuted}
                >
                  {String(cm)}
                </SvgText>
              </G>
            ))}

            {scales.xTicks.map((age) => (
              <SvgText
                key={`x-${age}`}
                x={scales.x(age)}
                y={HEIGHT - 8}
                textAnchor="middle"
                fontSize={10}
                fill={theme.semantic.textMuted}
              >
                {String(age)}
              </SvgText>
            ))}

            {/* Growth-shaped projection, anchored at both ends — identical maths
                to the web, so the two platforms cannot disagree about the curve. */}
            <Path
              d={linePath(
                projectionOr(last, predicted, sex),
                scales,
              )}
              fill="none"
              stroke={theme.color.primary[500]}
              strokeWidth={2}
              strokeDasharray="5,4"
              strokeLinecap="round"
            />

            {llmPredicted ? (
              <Path
                d={linePath(projectionOr(last, llmPredicted, sex), scales)}
                fill="none"
                stroke={theme.color.accent[500]}
                strokeWidth={2}
                strokeDasharray="2,4"
                strokeLinecap="round"
              />
            ) : null}

            {points.length > 1 ? (
              <Path
                d={linePath(points, scales)}
                fill="none"
                stroke={theme.color.primary[700]}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}

            {points.map((point) => (
              <Circle
                key={`o-${point.ageYears}`}
                cx={scales.x(point.ageYears)}
                cy={scales.y(point.heightCm)}
                r={4}
                fill={theme.color.primary[700]}
              />
            ))}

            {/* Rings for predictions, filled dots for measurements: the
                distinction survives greyscale and colourblindness. */}
            <Circle
              cx={scales.x(predicted.ageYears)}
              cy={scales.y(predicted.heightCm)}
              r={6}
              fill={theme.semantic.surface}
              stroke={theme.color.primary[600]}
              strokeWidth={3}
            />

            {llmPredicted ? (
              <Circle
                cx={scales.x(llmPredicted.ageYears)}
                cy={scales.y(llmPredicted.heightCm)}
                r={6}
                fill={theme.semantic.surface}
                stroke={theme.color.accent[600]}
                strokeWidth={3}
              />
            ) : null}
          </Svg>
        ) : null}
      </View>

      <View style={styles.legend}>
        <LegendItem color={theme.color.primary[700]} label={labels.observed} />
        <LegendItem color={theme.color.primary[600]} label={labels.predicted} ring />
        {llmPredicted ? (
          <LegendItem
            color={theme.color.accent[600]}
            label={labels.llmPredicted}
            ring
          />
        ) : null}
      </View>
    </View>
  );
}

/** Falls back to a straight segment when the reference curve offers no shape. */
function projectionOr(from: ChartPoint, to: ChartPoint, sex: number): ChartPoint[] {
  const curve = growthProjection(from, to, sex);
  return curve.length ? curve : [from, to];
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
    <View style={styles.legendItem}>
      <View
        style={[
          styles.swatch,
          ring
            ? { borderColor: color, borderWidth: 2.5, backgroundColor: theme.semantic.surface }
            : { backgroundColor: color },
        ]}
      />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  figure: { gap: theme.space[3] },
  caption: { gap: 2 },
  title: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: theme.semantic.textSecondary,
  },
  units: { fontSize: fontSize.xs, color: theme.semantic.textMuted },
  plot: { height: HEIGHT, width: "100%" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: theme.space[4] },
  legendItem: { flexDirection: "row", alignItems: "center", gap: theme.space[1] + 2 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: fontSize.xs, color: theme.semantic.textSecondary },
});

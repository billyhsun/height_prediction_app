import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_SHORT_LABELS,
  calculateBmi,
  getDictionary,
  predict,
  tokens,
  type Locale,
  type PredictResponse,
} from "@notch/core";

/**
 * Scaffold screen — not the shipping UI.
 *
 * Its job is to prove the four things the port depends on actually work on
 * device, so that failures surface now rather than after nine screens have been
 * written against them:
 *
 *   1. @notch/core resolves through Metro in a workspace
 *   2. the design tokens drive React Native styles from the same source as the
 *      web app's CSS
 *   3. the locale dictionaries render, including Chinese glyphs
 *   4. a real prediction round-trips via apiFetch against the deployed API
 */
export default function ScaffoldScreen() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const t = getDictionary(locale);

  // A fixed, in-domain child: age 5 is well inside the model's supported range.
  const inputs = {
    sex: 1,
    height_cm: 110,
    weight_kg: 20,
    current_age_years: 5,
    target_age_years: 18,
  };

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await predict(inputs));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.brand}>{t.common.appName}</Text>
      <Text style={styles.heading}>{t.form.title}</Text>
      <Text style={styles.body}>{t.form.subtitle}</Text>

      {/* Same two locales as the web app, from the same dictionaries. */}
      <View style={styles.segment}>
        {LOCALES.map((option) => {
          const active = option === locale;
          return (
            <Pressable
              key={option}
              onPress={() => setLocale(option)}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
            >
              <Text style={active ? styles.segmentTextActive : styles.segmentText}>
                {LOCALE_SHORT_LABELS[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t.results.inputsUsed}</Text>
        <Text style={styles.body}>
          {t.results.basedOn(
            inputs.current_age_years,
            t.common.sexNoun(inputs.sex),
            inputs.height_cm,
            inputs.weight_kg,
          )}
        </Text>
        <Text style={styles.body}>
          {t.form.bmi}: {calculateBmi(inputs.weight_kg, inputs.height_cm).toFixed(1)}
        </Text>
      </View>

      <Pressable
        onPress={run}
        disabled={loading}
        style={[styles.button, loading && styles.buttonDisabled]}
      >
        {loading ? (
          <ActivityIndicator color={tokens.semantic.textOnPrimary} />
        ) : (
          <Text style={styles.buttonText}>{t.form.submit}</Text>
        )}
      </Pressable>

      {result && (
        <View style={styles.card}>
          <Text style={styles.label}>{t.results.predictedHeight}</Text>
          <Text style={styles.stat}>{result.pred_height_cm.toFixed(1)} cm</Text>
          <Text style={styles.caption}>
            {t.results.modelLabel(result.model_version)}
          </Text>
        </View>
      )}

      {error && (
        <View style={[styles.card, styles.cardError]}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.caption}>
            Set EXPO_PUBLIC_API_BASE_URL in .env if this is a network error.
          </Text>
        </View>
      )}

      <Text style={styles.caption}>{t.common.disclaimer}</Text>
    </ScrollView>
  );
}

// Styles read from the same token module that generates the web app's CSS
// custom properties, so the two platforms cannot drift apart on colour, spacing
// or radius. Numeric values are needed here, hence parseInt on the px tokens.
const px = (value: string) => Number.parseInt(value, 10);

const styles = StyleSheet.create({
  page: {
    padding: px(tokens.space[5]),
    gap: px(tokens.space[4]),
    backgroundColor: tokens.semantic.canvas,
  },
  brand: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: tokens.color.primary[700],
  },
  heading: { fontSize: 28, fontWeight: "700", color: tokens.semantic.textPrimary },
  body: { fontSize: 15, lineHeight: 22, color: tokens.semantic.textSecondary },
  label: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tokens.semantic.textSecondary,
  },
  stat: { fontSize: 40, fontWeight: "700", color: tokens.semantic.textPrimary },
  caption: { fontSize: 12, color: tokens.semantic.textMuted },
  card: {
    backgroundColor: tokens.semantic.surface,
    borderColor: tokens.semantic.border,
    borderWidth: 1,
    borderRadius: px(tokens.radius.lg),
    padding: px(tokens.space[5]),
    gap: px(tokens.space[2]),
  },
  cardError: {
    backgroundColor: tokens.color.danger[50],
    borderColor: tokens.color.danger[600],
  },
  errorText: { fontSize: 14, color: tokens.color.danger[700] },
  segment: {
    flexDirection: "row",
    gap: px(tokens.space[1]),
    padding: px(tokens.space[1]),
    borderRadius: px(tokens.radius.md),
    borderWidth: 1,
    borderColor: tokens.semantic.border,
    backgroundColor: tokens.semantic.surfaceSunk,
    alignSelf: "flex-start",
  },
  segmentItem: {
    paddingHorizontal: px(tokens.space[4]),
    paddingVertical: px(tokens.space[2]),
    borderRadius: px(tokens.radius.sm),
  },
  segmentItemActive: { backgroundColor: tokens.color.primary[600] },
  segmentText: { fontSize: 14, fontWeight: "500", color: tokens.semantic.textSecondary },
  segmentTextActive: {
    fontSize: 14,
    fontWeight: "500",
    color: tokens.semantic.textOnPrimary,
  },
  button: {
    height: px(tokens.controlHeight.lg),
    borderRadius: px(tokens.radius.md),
    backgroundColor: tokens.color.primary[600],
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: tokens.semantic.textOnPrimary,
  },
});

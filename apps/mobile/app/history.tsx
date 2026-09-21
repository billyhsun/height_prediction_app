import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  apiFetch,
  displayError,
  fetchPredictionHistory,
  formatHeight,
  type SavedPredictionSummary,
} from "@notch/core";

import { useI18n } from "@/components/i18n";
import { RequireAuth } from "@/components/RequireAuth";
import { useUnits } from "@/components/units";
import { Button, Card, fontSize, theme } from "@/components/ui";

export default function HistoryScreen() {
  return (
    <RequireAuth>
      <History />
    </RequireAuth>
  );
}

function History() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { locale, t } = useI18n();
  const { units } = useUnits();
  const [predictions, setPredictions] = useState<SavedPredictionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchPredictionHistory()
        .then((rows) => !cancelled && setPredictions(rows))
        .catch((err) => !cancelled && setError(displayError(err, t.history.failedToLoad)))
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  function confirmDelete(id: string) {
    Alert.alert("", t.children.confirmDelete, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete,
        style: "destructive",
        onPress: async () => {
          // No core client for this one — the web calls the route directly too.
          const res = await apiFetch(`/api/user/predictions/${id}`, {
            method: "DELETE",
          });
          if (!res.ok) return;
          setPredictions((prev) => prev.filter((p) => p.id !== id));
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.page,
        { paddingTop: theme.space[5], paddingBottom: theme.space[5] + insets.bottom },
      ]}
    >
      <Text style={styles.subtitle}>{t.history.subtitle}</Text>

      {loading ? <Text style={styles.muted}>{t.history.loading}</Text> : null}

      {error ? (
        <Card tone="muted" padding="sm">
          <Text style={styles.error}>{error}</Text>
        </Card>
      ) : null}

      {!loading && !error && predictions.length === 0 ? (
        <Card padding="lg">
          <View style={styles.rowGap}>
            <Text style={styles.body}>{t.history.empty}</Text>
            <Button size="sm" variant="secondary" onPress={() => router.replace("/")}>
              {t.history.runPrediction}
            </Button>
          </View>
        </Card>
      ) : null}

      {predictions.map((p) => (
        <Card key={p.id} padding="md">
          <View style={styles.rowGap}>
            <Text style={styles.body}>
              {p.childName ? `${p.childName} · ` : ""}
              {p.sex === 1 ? t.common.male : t.common.female}
              {" · "}
              {t.history.ageTransition(p.currentAgeYears, p.targetAgeYears)}
            </Text>
            <View style={styles.valueRow}>
              <Text style={styles.value}>{formatHeight(p.predHeightCm, units, t)}</Text>
              {p.llmPredHeightCm != null ? (
                <Text style={styles.llm}>
                  {t.history.llmValue(formatHeight(p.llmPredHeightCm, units, t))}
                </Text>
              ) : null}
            </View>
            <Text style={styles.muted}>
              {new Date(p.createdAt).toLocaleString(locale)}
            </Text>
            <View style={styles.actions}>
              <Button
                size="sm"
                onPress={() =>
                  router.push({ pathname: "/results", params: { saved: p.id } })
                }
              >
                {t.common.view}
              </Button>
              <Button size="sm" variant="ghost" onPress={() => confirmDelete(p.id)}>
                {t.common.delete}
              </Button>
            </View>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.semantic.canvas },
  page: { paddingHorizontal: theme.space[5], gap: theme.space[4] },
  rowGap: { gap: theme.space[1] + 2 },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: theme.semantic.textSecondary,
  },
  body: { fontSize: fontSize.sm, color: theme.semantic.textSecondary },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: theme.space[2] },
  value: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: theme.semantic.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  llm: { fontSize: fontSize.sm, color: theme.color.accent[700] },
  muted: { fontSize: fontSize.xs, color: theme.semantic.textMuted },
  error: { fontSize: fontSize.sm, color: theme.color.danger[700] },
  actions: { flexDirection: "row", gap: theme.space[2], marginTop: theme.space[2] },
});

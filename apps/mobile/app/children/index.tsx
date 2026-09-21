import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ageBreakdownFromDateOfBirth,
  deleteChild,
  displayError,
  fetchChildren,
  formatDateOfBirth,
  formatEthnicities,
  formatHeight,
  type ChildProfile,
} from "@notch/core";

import { useI18n } from "@/components/i18n";
import { RequireAuth } from "@/components/RequireAuth";
import { useUnits } from "@/components/units";
import { Button, Card, fontSize, theme } from "@/components/ui";

export default function ChildrenScreen() {
  return (
    <RequireAuth>
      <ChildrenList />
    </RequireAuth>
  );
}

function ChildrenList() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { locale, t } = useI18n();
  const { units } = useUnits();
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refetched on focus rather than on mount: adding or editing a child pushes
  // back here, and a list that still showed the old data would look broken.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchChildren()
        .then((rows) => !cancelled && setChildren(rows))
        .catch((err) => !cancelled && setError(displayError(err, t.children.failedToLoad)))
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
      // t is read only for a fallback message.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  function confirmDelete(child: ChildProfile) {
    // Alert, not `confirm()`: there is no window dialog here, and a blocking
    // one would freeze the JS thread.
    Alert.alert(child.displayName, t.children.confirmDelete, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete,
        style: "destructive",
        onPress: async () => {
          try {
            await deleteChild(child.id);
            setChildren((prev) => prev.filter((c) => c.id !== child.id));
          } catch (err) {
            setError(displayError(err, t.children.failedToDelete));
          }
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
      <Text style={styles.subtitle}>{t.children.subtitle}</Text>

      <Link href="/children/new" asChild>
        <Pressable>
          <Button size="lg" fullWidth>
            {t.children.addChild}
          </Button>
        </Pressable>
      </Link>

      {loading ? <Text style={styles.muted}>{t.common.loading}</Text> : null}

      {error ? (
        <Card tone="muted" padding="sm">
          <Text style={styles.error}>{error}</Text>
        </Card>
      ) : null}

      {!loading && !error && children.length === 0 ? (
        <Card padding="lg">
          <Text style={styles.body}>{t.children.empty}</Text>
          <Text style={styles.muted}>{t.children.emptyHelp}</Text>
        </Card>
      ) : null}

      {children.map((child) => {
        const age = ageBreakdownFromDateOfBirth(child.dateOfBirth);
        return (
          <Card key={child.id} padding="md">
            <View style={styles.rowGap}>
              <Text style={styles.name}>{child.displayName}</Text>
              <Text style={styles.body}>
                {child.sex === 1 ? t.common.male : t.common.female}
                {" · "}
                {t.children.bornAndAge(
                  formatDateOfBirth(child.dateOfBirth, locale),
                  t.common.ageYearsMonths(age.years, age.months),
                )}
              </Text>

              {child.motherHeightCm || child.fatherHeightCm ? (
                <Text style={styles.muted}>
                  {t.children.parentsLabel}{" "}
                  {child.motherHeightCm
                    ? t.children.motherHeight(formatHeight(child.motherHeightCm, units, t))
                    : ""}
                  {child.motherHeightCm && child.fatherHeightCm
                    ? t.common.listSeparator
                    : ""}
                  {child.fatherHeightCm
                    ? t.children.fatherHeight(formatHeight(child.fatherHeightCm, units, t))
                    : ""}
                </Text>
              ) : null}

              {child.ethnicities.length > 0 ? (
                <Text style={styles.muted}>
                  {t.children.ethnicityLabel(
                    formatEthnicities(child.ethnicities, t.ethnicity, t.common.listSeparator),
                  )}
                </Text>
              ) : null}

              <View style={styles.actions}>
                <Button
                  size="sm"
                  onPress={() =>
                    router.push({ pathname: "/", params: { child: child.id } })
                  }
                >
                  {t.children.predict}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => router.push(`/children/${child.id}`)}
                >
                  {t.common.edit}
                </Button>
                <Button size="sm" variant="ghost" onPress={() => confirmDelete(child)}>
                  {t.common.delete}
                </Button>
              </View>
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.semantic.canvas },
  page: { paddingHorizontal: theme.space[5], gap: theme.space[4] },
  rowGap: { gap: theme.space[1] + 2 },
  name: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: theme.semantic.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: theme.semantic.textSecondary,
  },
  body: { fontSize: fontSize.sm, color: theme.semantic.textSecondary },
  muted: { fontSize: fontSize.xs, color: theme.semantic.textMuted },
  error: { fontSize: fontSize.sm, color: theme.color.danger[700] },
  actions: {
    flexDirection: "row",
    gap: theme.space[2],
    marginTop: theme.space[2],
  },
});

import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ETHNICITY_VALUES,
  PARENT_LIMITS,
  createChild,
  displayError,
  fetchChild,
  fetchParentDefaults,
  formatHeight,
  isValidParentHeight,
  updateChild,
  type ChildInput,
  type EthnicityValue,
  type ParentDefaults,
} from "@notch/core";

import { useTranslations } from "@/components/i18n";
import { useUnits } from "@/components/units";
import {
  Button,
  Card,
  DateOfBirthField,
  Field,
  HeightField,
  Input,
  OptionGrid,
  SegmentedControl,
  Section,
  defaultDob,
  dobFromIso,
  dobToIso,
  fontSize,
  theme,
  type DobParts,
} from "@/components/ui";

/** A child profile outlives the model's 15-year ceiling, so the year list here
 *  reaches further back than the prediction form's. */
const PROFILE_YEARS_BACK = 20;

type Props = { childId?: string };

/**
 * Create or edit a child profile — the mobile counterpart of the web's
 * ChildForm, which serves /children/new and /children/[id]/edit the same way.
 */
export function ChildForm({ childId }: Props) {
  const isEdit = Boolean(childId);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useTranslations();
  const { units } = useUnits();

  const [displayName, setDisplayName] = useState("");
  const [sex, setSex] = useState(1);
  const [dob, setDob] = useState<DobParts>(() => defaultDob(5));
  const [ethnicities, setEthnicities] = useState<string[]>([]);
  const [motherHeight, setMotherHeight] = useState("");
  const [fatherHeight, setFatherHeight] = useState("");
  const [parentDefaults, setParentDefaults] = useState<ParentDefaults | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchParentDefaults().then(setParentDefaults).catch(() => {});
  }, []);

  useEffect(() => {
    if (!childId) return;
    fetchChild(childId)
      .then((child) => {
        setDisplayName(child.displayName);
        setSex(child.sex);
        setDob(dobFromIso(child.dateOfBirth));
        setEthnicities(child.ethnicities);
        setMotherHeight(child.motherHeightCm?.toString() ?? "");
        setFatherHeight(child.fatherHeightCm?.toString() ?? "");
      })
      .catch((err) => setError(displayError(err, t.childForm.failedToLoad)))
      .finally(() => setLoading(false));
    // t is read only for a fallback message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  async function handleSave() {
    setError(null);

    if (!displayName.trim()) {
      setError(t.childForm.nameRequired);
      return;
    }

    const motherHeightCm = motherHeight ? Number(motherHeight) : null;
    const fatherHeightCm = fatherHeight ? Number(fatherHeight) : null;

    // The LLM needs a mid-parental height, which one parent cannot give.
    if ((motherHeightCm && !fatherHeightCm) || (!motherHeightCm && fatherHeightCm)) {
      setError(t.childForm.bothParentHeightsRequired);
      return;
    }
    for (const value of [motherHeightCm, fatherHeightCm]) {
      if (value != null && !isValidParentHeight(value)) {
        setError(
          t.parents.heightOutOfRange(
            formatHeight(PARENT_LIMITS.heightCm.min, units, t),
            formatHeight(PARENT_LIMITS.heightCm.max, units, t),
          ),
        );
        return;
      }
    }

    const input: ChildInput = {
      displayName: displayName.trim(),
      sex,
      dateOfBirth: dobToIso(dob),
      motherHeightCm,
      fatherHeightCm,
      ethnicities,
    };

    setSaving(true);
    try {
      if (isEdit && childId) await updateChild(childId, input);
      else await createChild(input);
      router.replace("/children");
    } catch (err) {
      setError(displayError(err, t.childForm.failedToSave));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centre}>
        <Text style={styles.muted}>{t.common.loading}</Text>
      </View>
    );
  }

  const parentPlaceholder = (accountValue: number | null | undefined, metric: string) =>
    accountValue != null
      ? t.childForm.accountDefaultPlaceholder(formatHeight(accountValue, units, t))
      : t.common.egPlaceholder(units === "imperial" ? "5" : metric);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.page,
        { paddingTop: theme.space[5], paddingBottom: theme.space[5] + insets.bottom },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      <Text style={styles.subtitle}>{t.childForm.subtitle}</Text>

      <Section title={t.childForm.profileLegend}>
        <Field label={t.childForm.name}>
          {() => (
            <Input
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t.childForm.namePlaceholder}
              autoCapitalize="words"
            />
          )}
        </Field>

        <View style={styles.stack}>
          <Text style={styles.fieldLabel}>{t.form.sex}</Text>
          <SegmentedControl
            label={t.form.sex}
            value={sex}
            onChange={setSex}
            options={[
              { value: 1, label: t.common.male },
              { value: 2, label: t.common.female },
            ]}
          />
        </View>

        <DateOfBirthField
          value={dob}
          onChange={setDob}
          label={t.childForm.dateOfBirth}
          yearsBack={PROFILE_YEARS_BACK}
        />
      </Section>

      <Section
        title={t.childForm.parentHeightsLegend}
        description={
          parentDefaults?.motherHeightCm != null
            ? t.childForm.parentHeightsOverrideHelp
            : t.childForm.parentHeightsHelp
        }
      >
        <HeightField
          valueCm={motherHeight}
          onChangeCm={setMotherHeight}
          units={units}
          t={t}
          metricLabel={t.units.mothersHeightLabel}
          groupLabel={t.units.mothersHeightGroupLabel}
          placeholder={parentPlaceholder(parentDefaults?.motherHeightCm, "165")}
        />
        <HeightField
          valueCm={fatherHeight}
          onChangeCm={setFatherHeight}
          units={units}
          t={t}
          metricLabel={t.units.fathersHeightLabel}
          groupLabel={t.units.fathersHeightGroupLabel}
          placeholder={parentPlaceholder(parentDefaults?.fatherHeightCm, "178")}
        />
      </Section>

      <Section title={t.childForm.ethnicityLabel} description={t.childForm.ethnicityHelp}>
        <OptionGrid
          label={t.childForm.ethnicityLabel}
          options={ETHNICITY_VALUES.map((value) => ({ value, label: t.ethnicity[value] }))}
          selected={ethnicities}
          onToggle={(value: EthnicityValue) =>
            setEthnicities((prev) =>
              prev.includes(value)
                ? prev.filter((entry) => entry !== value)
                : [...prev, value],
            )
          }
        />
      </Section>

      {error ? (
        <Card tone="muted" padding="sm">
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        </Card>
      ) : null}

      <Button size="lg" fullWidth loading={saving} onPress={handleSave}>
        {saving
          ? t.childForm.saving
          : isEdit
            ? t.childForm.saveChanges
            : t.childForm.addChild}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.semantic.canvas },
  page: { paddingHorizontal: theme.space[5], gap: theme.space[4] },
  centre: { flex: 1, justifyContent: "center", padding: theme.space[5] },
  stack: { gap: theme.space[1] + 2 },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: theme.semantic.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: theme.semantic.textSecondary,
  },
  muted: { fontSize: fontSize.sm, color: theme.semantic.textSecondary },
  error: { fontSize: fontSize.sm, color: theme.color.danger[700] },
});

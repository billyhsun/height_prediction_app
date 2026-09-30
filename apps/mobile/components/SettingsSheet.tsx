import { openBrowserAsync } from "expo-web-browser";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { LOCALES, LOCALE_SHORT_LABELS, UNIT_SYSTEMS, apiUrl } from "@notch/core";

import { useI18n } from "@/components/i18n";
import { useUnits } from "@/components/units";
import { Button, SegmentedControl, fontSize, theme } from "@/components/ui";

type SettingsSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * The counterpart of the web header's gear menu: language and units in one
 * place instead of a row of segmented controls on every screen. On a phone
 * that row cost more than desk-top clutter — it pushed a form field below the
 * fold — and like the web menu, this is where the next setting lands.
 *
 * Selecting an option keeps the sheet open: changing the language repaints the
 * sheet's own labels, which is the feedback that shows the switch took effect.
 */
export function SettingsSheet({ visible, onClose }: SettingsSheetProps) {
  const { locale, setLocale, t } = useI18n();
  const { units, setUnits } = useUnits();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        accessibilityLabel={t.header.settingsDone}
        onPress={onClose}
      >
        {/* Its own Pressable so taps inside do not fall through to the
            backdrop and dismiss the sheet mid-adjustment. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{t.header.settings}</Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t.header.languageLabel}</Text>
            <SegmentedControl
              size="sm"
              label={t.header.languageLabel}
              value={locale}
              onChange={setLocale}
              options={LOCALES.map((option) => ({
                value: option,
                label: LOCALE_SHORT_LABELS[option],
              }))}
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t.units.settingLabel}</Text>
            <SegmentedControl
              size="sm"
              label={t.units.settingLabel}
              value={units}
              onChange={setUnits}
              options={UNIT_SYSTEMS.map((option) => ({
                value: option,
                // Spelled out, unlike the old header row's "cm"/"ft" — the
                // sheet has the width, and the words also cover weight.
                label: option === "metric" ? t.units.metric : t.units.imperial,
              }))}
            />
          </View>

          {/* The legal pages live on the web app; apiUrl points there in a
              release build. In the sheet rather than the account screen so a
              signed-out reviewer (or parent) can always reach them. */}
          <View style={styles.legalRow}>
            <Pressable
              accessibilityRole="link"
              onPress={() => openBrowserAsync(apiUrl("/privacy"))}
            >
              <Text style={styles.legalLink}>{t.footer.privacy}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => openBrowserAsync(apiUrl("/terms"))}
            >
              <Text style={styles.legalLink}>{t.footer.terms}</Text>
            </Pressable>
          </View>

          <Button variant="secondary" size="lg" fullWidth onPress={onClose}>
            {t.header.settingsDone}
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Feather's "settings" gear (MIT), the same mark as the web header's. */
export function GearIcon({ size = 18, color }: { size?: number; color?: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? theme.semantic.textSecondary}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx={12} cy={12} r={3} />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(24, 32, 30, 0.45)",
    justifyContent: "center",
    padding: theme.space[5],
  },
  sheet: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.semantic.surface,
    padding: theme.space[5],
    gap: theme.space[5],
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: theme.semantic.textPrimary,
  },
  row: { gap: theme.space[1] + 2 },
  rowLabel: { fontSize: fontSize.xs, color: theme.semantic.textSecondary },
  legalRow: { flexDirection: "row", gap: theme.space[5] },
  legalLink: {
    fontSize: fontSize.xs,
    fontWeight: "500",
    color: theme.color.primary[700],
    textDecorationLine: "underline",
  },
});

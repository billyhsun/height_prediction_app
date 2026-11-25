import { tokens } from "@notch/core";
import { Tabs } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AdsBanner } from "@/components/AdsBanner";
import { useTranslations } from "@/components/i18n";
import { fontSize, theme } from "@/components/ui";

/** Matches the Children stack header so History / Account look the same. */
const tabHeaderOptions = {
  headerShown: true,
  headerShadowVisible: false,
  headerStyle: { backgroundColor: tokens.semantic.surface },
  headerTitleStyle: { color: tokens.semantic.textPrimary },
  headerTintColor: tokens.color.primary[700],
} as const;

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={[styles.icon, focused && styles.iconFocused]}>
      <Text style={[styles.iconGlyph, focused && styles.iconGlyphFocused]}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Custom tab bar so the AdMob banner can sit above the tabs without importing
 * `@react-navigation/bottom-tabs` (blocked by expo-router on SDK 56+).
 */
function TabBarWithAds({
  state,
  descriptors,
  navigation,
}: {
  state: { routes: { key: string; name: string }[]; index: number };
  descriptors: Record<
    string,
    {
      options: {
        title?: string;
        tabBarLabel?: string;
        tabBarIcon?: (props: {
          focused: boolean;
          color: string;
          size: number;
        }) => React.ReactNode;
        tabBarAccessibilityLabel?: string;
      };
    }
  >;
  navigation: { navigate: (name: string) => void };
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingBottom: insets.bottom, backgroundColor: theme.semantic.surface }}>
      <AdsBanner />
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused
            ? theme.color.primary[700]
            : theme.semantic.textMuted;
          const label = options.tabBarLabel ?? options.title ?? route.name;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={() => navigation.navigate(route.name)}
              style={styles.tab}
            >
              {options.tabBarIcon?.({ focused, color, size: 22 })}
              <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const t = useTranslations();

  return (
    <Tabs
      tabBar={(props) => <TabBarWithAds {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.primary[700],
        tabBarInactiveTintColor: theme.semantic.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.predict,
          tabBarIcon: ({ focused }) => <TabIcon label="◎" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="birth"
        options={{
          title: t.tabs.birth,
          tabBarIcon: ({ focused }) => <TabIcon label="✦" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="children"
        options={{
          title: t.tabs.children,
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon label="☰" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          ...tabHeaderOptions,
          title: t.history.title,
          tabBarLabel: t.tabs.history,
          tabBarIcon: ({ focused }) => <TabIcon label="◷" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          ...tabHeaderOptions,
          title: t.account.title,
          tabBarLabel: t.tabs.account,
          tabBarIcon: ({ focused }) => <TabIcon label="☺" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.semantic.border,
    backgroundColor: theme.semantic.surface,
    paddingTop: theme.space[1],
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: theme.space[1],
  },
  tabLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  iconFocused: { backgroundColor: theme.color.primary[100] },
  iconGlyph: {
    fontSize: 14,
    color: theme.semantic.textMuted,
  },
  iconGlyphFocused: { color: theme.color.primary[700] },
});

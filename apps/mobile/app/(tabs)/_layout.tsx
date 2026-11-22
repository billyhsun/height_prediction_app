import { BottomTabBar } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { AdsBanner } from "@/components/AdsBanner";
import { useTranslations } from "@/components/i18n";
import { fontSize, theme } from "@/components/ui";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={[styles.icon, focused && styles.iconFocused]}>
      <Text style={[styles.iconGlyph, focused && styles.iconGlyphFocused]}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const t = useTranslations();

  return (
    <Tabs
      // expo-router and @react-navigation/bottom-tabs descriptor types drift;
      // the runtime props are compatible.
      tabBar={(props) => (
        <View>
          <AdsBanner />
          <BottomTabBar
            {...(props as unknown as React.ComponentProps<typeof BottomTabBar>)}
          />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.primary[700],
        tabBarInactiveTintColor: theme.semantic.textMuted,
        tabBarStyle: {
          backgroundColor: theme.semantic.surface,
          borderTopColor: theme.semantic.border,
        },
        tabBarLabelStyle: {
          fontSize: fontSize.xs,
          fontWeight: "600",
        },
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
          title: t.tabs.history,
          tabBarIcon: ({ focused }) => <TabIcon label="◷" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t.tabs.account,
          tabBarIcon: ({ focused }) => <TabIcon label="☺" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
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

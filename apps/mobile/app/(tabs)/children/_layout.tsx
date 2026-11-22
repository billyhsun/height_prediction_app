import { Stack } from "expo-router";

import { useTranslations } from "@/components/i18n";
import { tokens } from "@notch/core";

export default function ChildrenStackLayout() {
  const t = useTranslations();

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: tokens.semantic.surface },
        headerTitleStyle: { color: tokens.semantic.textPrimary },
        headerTintColor: tokens.color.primary[700],
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: tokens.semantic.canvas },
      }}
    >
      <Stack.Screen name="index" options={{ title: t.children.title }} />
      <Stack.Screen name="new" options={{ title: t.childForm.addTitle }} />
      <Stack.Screen name="[id]" options={{ title: t.childForm.editTitle }} />
    </Stack>
  );
}

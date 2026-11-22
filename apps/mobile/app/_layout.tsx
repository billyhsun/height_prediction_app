import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { configureApiBaseUrl, configureApiHeaders, tokens } from "@notch/core";

import { EntitlementsProvider } from "@/components/entitlements";
import { LocaleProvider, useTranslations } from "@/components/i18n";
import { UnitsProvider } from "@/components/units";

SplashScreen.preventAutoHideAsync().catch(() => {});

const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Non-fatal
    }
  },
};

const DEV_API_PORT = 3000;

function resolveApiBaseUrl(): string | undefined {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured) return configured;
  if (!__DEV__) return undefined;

  const hostUri =
    Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(":")[0];
  return host ? `http://${host}:${DEV_API_PORT}` : undefined;
}

function ApiBridge({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  useEffect(() => {
    const baseUrl = resolveApiBaseUrl();
    if (baseUrl) configureApiBaseUrl(baseUrl);

    configureApiHeaders(async (): Promise<Record<string, string>> => {
      const token = await getToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    });
  }, [getToken]);

  return <>{children}</>;
}

function SplashGate({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoaded]);

  return <>{children}</>;
}

function AppStack() {
  const t = useTranslations();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: tokens.semantic.surface },
        headerTitleStyle: { color: tokens.semantic.textPrimary },
        headerTintColor: tokens.color.primary[700],
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: tokens.semantic.canvas },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="results"
        options={{
          headerShown: true,
          title: t.metadata.resultsTitle.split("|")[0].trim(),
          animation: "fade_from_bottom",
        }}
      />
      <Stack.Screen
        name="paywall"
        options={{
          headerShown: true,
          title: t.paywall.title,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="sign-in"
        options={{ headerShown: true, title: t.header.signIn }}
      />
      <Stack.Screen
        name="sign-up"
        options={{ headerShown: true, title: t.header.signUp }}
      />
      <Stack.Screen
        name="onboarding"
        options={{ headerShown: true, title: t.onboarding.title }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error(
      "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set — copy .env.example to .env",
    );
  }

  return (
    <SafeAreaProvider>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <SplashGate>
          <LocaleProvider>
            <UnitsProvider>
              <EntitlementsProvider>
                <ApiBridge>
                  <StatusBar style="dark" />
                  <AppStack />
                </ApiBridge>
              </EntitlementsProvider>
            </UnitsProvider>
          </LocaleProvider>
        </SplashGate>
      </ClerkProvider>
    </SafeAreaProvider>
  );
}

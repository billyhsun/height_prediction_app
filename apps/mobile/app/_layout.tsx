import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { configureApiBaseUrl, configureApiHeaders, tokens } from "@notch/core";

import { LocaleProvider, useTranslations } from "@/components/i18n";

/**
 * Clerk needs somewhere durable to keep the session. On the web that is a
 * cookie; here it is the iOS keychain via expo-secure-store, so a user stays
 * signed in across launches without the token sitting in plain storage.
 */
const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      // A corrupt keychain entry should log the user out, not crash the app.
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Non-fatal: the session simply won't survive a restart.
    }
  },
};

/** Port the web app's dev server listens on. */
const DEV_API_PORT = 3000;

/**
 * Where to reach the API.
 *
 * An explicit EXPO_PUBLIC_API_BASE_URL always wins — that is how a release build
 * points at the deployed app. Failing that, in development, the host is taken
 * from the Expo dev server the app was loaded from: a physical device cannot
 * resolve "localhost" (that would be the phone itself), and hardcoding the Mac's
 * LAN address means editing .env every time the network hands out a new one.
 * Whatever host served the JS can also serve the API.
 */
function resolveApiBaseUrl(): string | undefined {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured) return configured;
  if (!__DEV__) return undefined;

  // e.g. "10.0.0.126:8081" — shape differs across Expo versions, so try both.
  const hostUri =
    Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(":")[0];
  return host ? `http://${host}:${DEV_API_PORT}` : undefined;
}

/**
 * Points @notch/core at the deployed web app and teaches it how to authenticate.
 *
 * This is the whole of the native-vs-web difference in the shared layer. The web
 * configures neither: its requests are same-origin and carry a session cookie.
 * Native has no origin and no cookie jar, so it supplies a base URL and a bearer
 * token instead — and every API client in core then works unchanged.
 */
function ApiBridge({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  useEffect(() => {
    const baseUrl = resolveApiBaseUrl();
    if (baseUrl) configureApiBaseUrl(baseUrl);

    // Resolved per request rather than once, so a refreshed token is picked up
    // without reconfiguring.
    configureApiHeaders(async (): Promise<Record<string, string>> => {
      const token = await getToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    });
  }, [getToken]);

  return <>{children}</>;
}

/**
 * The navigator, split out because it reads translated titles and so has to sit
 * inside LocaleProvider.
 *
 * Headers stay off by default: every screen already opens with its own brand and
 * title block, so a native header would repeat it — and with nothing set,
 * expo-router falls back to the route's filename, which is how "index" ended up
 * on screen. The two auth routes opt in, because a pushed screen with no header
 * has no visible way back.
 */
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
        contentStyle: { backgroundColor: tokens.semantic.canvas },
      }}
    >
      <Stack.Screen
        name="sign-in"
        options={{ headerShown: true, title: t.header.signIn }}
      />
      <Stack.Screen
        name="sign-up"
        options={{ headerShown: true, title: t.header.signUp }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    // Failing loudly here beats a blank screen and an opaque Clerk error later.
    throw new Error(
      "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set — copy .env.example to .env",
    );
  }

  return (
    <SafeAreaProvider>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <LocaleProvider>
          <ApiBridge>
            <StatusBar style="dark" />
            <AppStack />
          </ApiBridge>
        </LocaleProvider>
      </ClerkProvider>
    </SafeAreaProvider>
  );
}

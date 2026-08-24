import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { configureApiBaseUrl, configureApiHeaders, tokens } from "@notch/core";

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
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
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

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    // Failing loudly here beats a blank screen and an opaque Clerk error later.
    throw new Error(
      "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set — copy .env.example to .env",
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ApiBridge>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: tokens.semantic.surface },
            headerTitleStyle: { color: tokens.semantic.textPrimary },
            contentStyle: { backgroundColor: tokens.semantic.canvas },
          }}
        />
      </ApiBridge>
    </ClerkProvider>
  );
}

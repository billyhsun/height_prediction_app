import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useState } from "react";

import { AuthScreen, authErrorMessage } from "@/components/AuthScreen";
import { useTranslations } from "@/components/i18n";
import { Button, Field, Input } from "@/components/ui";

/**
 * Email-and-password sign-in, built by hand on Clerk's hooks.
 *
 * The web renders Clerk's `<SignIn>` component, which does not exist for React
 * Native — @clerk/clerk-expo ships hooks and control components only. So the
 * flow is spelled out here: create an attempt, and if Clerk says it is complete,
 * make the returned session active.
 *
 * Anything Clerk answers other than "complete" means a step this screen does not
 * implement — a second factor, a forced password reset, an SSO handoff. Rather
 * than silently doing nothing, it says so and points at the web app, which has
 * the full component. Those flows are the next piece of auth work.
 */
export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const t = useTranslations();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!isLoaded || submitting) return;

    if (!email.trim() || !password) {
      setError(t.auth.missingCredentials);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const attempt = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        // Back to whatever was underneath — normally the prediction form, with
        // anything already typed into it still there. The form re-renders signed
        // in and picks up the account's children and parent defaults.
        if (router.canGoBack()) router.back();
        else router.replace("/");
        return;
      }

      setError(t.auth.unsupportedStep);
    } catch (err) {
      setError(authErrorMessage(err, t.auth.signInFailed));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreen
      title={t.auth.signInTitle}
      subtitle={t.auth.signInSubtitle}
      error={error}
      footerPrompt={t.auth.noAccountPrompt}
      footerAction={t.auth.noAccountAction}
      footerHref="/sign-up"
    >
      <Field label={t.auth.emailLabel}>
        {() => (
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder={t.auth.emailPlaceholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />
        )}
      </Field>

      <Field label={t.auth.passwordLabel}>
        {() => (
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder={t.auth.passwordPlaceholder}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
        )}
      </Field>

      <Button
        size="lg"
        fullWidth
        loading={submitting}
        disabled={!isLoaded}
        onPress={handleSubmit}
      >
        {t.auth.signInAction}
      </Button>
    </AuthScreen>
  );
}

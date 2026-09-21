import { useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { AuthScreen, authErrorMessage } from "@/components/AuthScreen";
import { useTranslations } from "@/components/i18n";
import { Button, Field, Input, fontSize, theme } from "@/components/ui";

/**
 * Registration, in two steps on one screen.
 *
 * Clerk verifies the email address before the account exists, so `create` is
 * followed by a six-digit code rather than by a session. Both steps live here
 * instead of on separate routes because the second is meaningless without the
 * first: a verification route reachable on its own would just be a dead end
 * after an app restart.
 *
 * The web sends a new account to /onboarding to collect parent heights. That
 * screen has no native equivalent yet, so registration lands back on the form —
 * where those fields can still be typed in directly.
 */
export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const t = useTranslations();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * A new account lands on the optional parent-details step, as on the web —
   * where <SignUp forceRedirectUrl="/onboarding"> does the same. Replace, not
   * push, so the back gesture cannot return into a completed sign-up.
   */
  function leave() {
    router.replace("/onboarding");
  }

  async function handleCreate() {
    if (!isLoaded || submitting) return;

    if (!email.trim() || !password) {
      setError(t.auth.missingCredentials);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err) {
      setError(authErrorMessage(err, t.auth.signUpFailed));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify() {
    if (!isLoaded || submitting) return;

    if (!code.trim()) {
      setError(t.auth.missingCode);
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const attempt = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });

      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        leave();
        return;
      }

      // "missing_requirements" here means Clerk wants a field this screen does
      // not collect — a username, a phone number — which is an instance
      // configuration the native flow has not been built for.
      setError(t.auth.unsupportedStep);
    } catch (err) {
      setError(authErrorMessage(err, t.auth.verifyFailed));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!isLoaded || submitting) return;

    setError(null);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setNotice(t.auth.resent);
    } catch (err) {
      setError(authErrorMessage(err, t.auth.signUpFailed));
    }
  }

  if (pendingVerification) {
    return (
      <AuthScreen
        title={t.auth.verifyTitle}
        subtitle={t.auth.verifySubtitle(email.trim())}
        error={error}
        footerPrompt={t.auth.haveAccountPrompt}
        footerAction={t.auth.haveAccountAction}
        footerHref="/sign-in"
      >
        <Field label={t.auth.codeLabel} hint={notice ?? undefined}>
          {() => (
            <Input
              value={code}
              onChangeText={setCode}
              placeholder={t.auth.codePlaceholder}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              returnKeyType="go"
              onSubmitEditing={handleVerify}
            />
          )}
        </Field>

        <Button size="lg" fullWidth loading={submitting} onPress={handleVerify}>
          {t.auth.verifyAction}
        </Button>

        <Pressable
          onPress={handleResend}
          accessibilityRole="button"
          style={({ pressed }) => [styles.resend, pressed && styles.pressed]}
        >
          <Text style={styles.resendText}>{t.auth.resend}</Text>
        </Pressable>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title={t.auth.signUpTitle}
      subtitle={t.auth.signUpSubtitle}
      error={error}
      footerPrompt={t.auth.haveAccountPrompt}
      footerAction={t.auth.haveAccountAction}
      footerHref="/sign-in"
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
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleCreate}
          />
        )}
      </Field>

      <Button
        size="lg"
        fullWidth
        loading={submitting}
        disabled={!isLoaded}
        onPress={handleCreate}
      >
        {t.auth.signUpAction}
      </Button>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  resend: { alignSelf: "center", paddingVertical: theme.space[2] },
  pressed: { opacity: 0.6 },
  resendText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: theme.color.primary[700],
  },
});

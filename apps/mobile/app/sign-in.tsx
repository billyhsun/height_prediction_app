import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { AuthScreen, authErrorMessage } from "@/components/AuthScreen";
import { useTranslations } from "@/components/i18n";
import { Button, Field, Input, fontSize, theme } from "@/components/ui";

/**
 * Sign-in, built by hand on Clerk's hooks.
 *
 * The web renders Clerk's `<SignIn>` component, which does not exist for React
 * Native — @clerk/clerk-expo ships hooks and control components only.
 *
 * The factor is chosen by the instance, not by this screen. An earlier version
 * assumed a password and could never sign anyone in: this Clerk instance has
 * `password.used_for_first_factor = false` and verifies `email_address` with an
 * emailed code, so every attempt came back `needs_first_factor` and hit the
 * "unsupported step" branch below. So the email is submitted first, Clerk is
 * asked what it supports, and the matching second screen is shown — password
 * where a password is accepted, a six-digit code where it is not. That works
 * against either configuration rather than betting on one.
 */
export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const t = useTranslations();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  /** Which second step the instance asked for, once it has been asked. */
  const [factor, setFactor] = useState<"password" | "email_code" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function finish() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  /** Step one: hand Clerk the email and see what it will accept. */
  async function identify() {
    if (!isLoaded || submitting) return;
    if (!email.trim()) {
      setError(t.auth.missingCredentials);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const attempt = await signIn.create({ identifier: email.trim() });

      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        finish();
        return;
      }

      const supported = attempt.supportedFirstFactors ?? [];
      const emailCode = supported.find((f) => f.strategy === "email_code");

      if (supported.some((f) => f.strategy === "password")) {
        setFactor("password");
      } else if (emailCode) {
        await signIn.prepareFirstFactor({
          strategy: "email_code",
          // The address Clerk matched, which is not necessarily the only one
          // on the account.
          emailAddressId: emailCode.emailAddressId,
        });
        setFactor("email_code");
      } else {
        // Something this screen does not implement — SSO, a passkey, a forced
        // password reset. Say so rather than failing silently.
        setError(t.auth.unsupportedStep);
      }
    } catch (err) {
      setError(authErrorMessage(err, t.auth.signInFailed));
    } finally {
      setSubmitting(false);
    }
  }

  /** Step two: whichever factor the instance named. */
  async function attempt() {
    if (!isLoaded || submitting || !factor) return;

    const secret = factor === "password" ? password : code.trim();
    if (!secret) {
      setError(
        factor === "password" ? t.auth.missingCredentials : t.auth.missingCode,
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result =
        factor === "password"
          ? await signIn.attemptFirstFactor({ strategy: "password", password })
          : await signIn.attemptFirstFactor({ strategy: "email_code", code: secret });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        // Back to whatever was underneath — normally the prediction form, with
        // anything already typed into it still there.
        finish();
        return;
      }

      setError(t.auth.unsupportedStep);
    } catch (err) {
      setError(
        authErrorMessage(
          err,
          factor === "password" ? t.auth.signInFailed : t.auth.verifyFailed,
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreen
      title={t.auth.signInTitle}
      subtitle={
        factor === "email_code"
          ? t.auth.verifySubtitle(email.trim())
          : t.auth.signInSubtitle
      }
      error={error}
      footerPrompt={t.auth.noAccountPrompt}
      footerAction={t.auth.noAccountAction}
      footerHref="/sign-up"
    >
      {factor === null ? (
        <>
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
                returnKeyType="go"
                onSubmitEditing={identify}
              />
            )}
          </Field>
          <Button
            size="lg"
            fullWidth
            loading={submitting}
            disabled={!isLoaded}
            onPress={identify}
          >
            {t.auth.signInAction}
          </Button>
        </>
      ) : factor === "password" ? (
        <>
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
                onSubmitEditing={attempt}
              />
            )}
          </Field>
          <Button size="lg" fullWidth loading={submitting} onPress={attempt}>
            {t.auth.signInAction}
          </Button>
        </>
      ) : (
        <>
          <Field label={t.auth.codeLabel}>
            {() => (
              <Input
                value={code}
                onChangeText={setCode}
                placeholder={t.auth.codePlaceholder}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                returnKeyType="go"
                onSubmitEditing={attempt}
              />
            )}
          </Field>
          <Button size="lg" fullWidth loading={submitting} onPress={attempt}>
            {t.auth.verifyAction}
          </Button>
          <Pressable
            onPress={() => {
              setFactor(null);
              setCode("");
              setError(null);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Text style={styles.backText}>{t.auth.emailLabel}</Text>
          </Pressable>
        </>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: "center", paddingVertical: theme.space[2] },
  pressed: { opacity: 0.6 },
  backText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: theme.color.primary[700],
  },
});

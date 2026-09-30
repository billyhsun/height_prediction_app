import { isClerkAPIResponseError, useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { apiUrl } from "@notch/core";

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
 * Two things this screen cannot do natively, both discovered by running it
 * against the real Clerk instance rather than by reading the code:
 *
 * The instance requires a first and last name, so those are collected here —
 * `signUp.create` rejects the attempt outright without them.
 *
 * And it has bot protection on. @clerk/clerk-expo ships no CAPTCHA widget, and
 * `SignUpCreateParams` has no field to carry a token, so there is nothing the
 * app can render to satisfy the check: native registration simply cannot
 * complete while the setting is on. Rather than dead-end, the screen detects
 * that specific failure and hands off to the browser, where Clerk's own
 * component renders the widget. Signing *in* is unaffected and stays native.
 *
 * The hand-off is deliberately reactive rather than unconditional — turn bot
 * protection off in the Clerk dashboard and the fully native flow starts
 * working again with no code change.
 */
export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const t = useTranslations();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  /** Set when Clerk rejects the attempt for a check the app cannot render. */
  const [captchaBlocked, setCaptchaBlocked] = useState(false);
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
    if (!firstName.trim() || !lastName.trim()) {
      setError(t.auth.namesRequired);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
        // Required by this instance; `create` fails without them.
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err) {
      if (isCaptchaFailure(err)) {
        setCaptchaBlocked(true);
        setError(null);
      } else {
        setError(authErrorMessage(err, t.auth.signUpFailed));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function openBrowserSignUp() {
    try {
      // The deployed web app, which renders Clerk's own <SignUp> and with it
      // the CAPTCHA widget this runtime cannot draw.
      await WebBrowser.openBrowserAsync(apiUrl("/sign-up"));
    } catch {
      setError(t.auth.browserOpenFailed);
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

  if (captchaBlocked) {
    return (
      <AuthScreen
        title={t.auth.captchaBlockedTitle}
        subtitle={t.auth.captchaBlockedBody}
        error={error}
        footerPrompt={t.auth.haveAccountPrompt}
        footerAction={t.auth.haveAccountAction}
        footerHref="/sign-in"
      >
        <View style={styles.stack}>
          <Button size="lg" fullWidth onPress={openBrowserSignUp}>
            {t.auth.continueInBrowser}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            fullWidth
            onPress={() => router.replace("/sign-in")}
          >
            {t.auth.returnToSignIn}
          </Button>
        </View>
      </AuthScreen>
    );
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
      <Field label={t.auth.firstNameLabel}>
        {() => (
          <Input
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
            returnKeyType="next"
          />
        )}
      </Field>

      <Field label={t.auth.lastNameLabel}>
        {() => (
          <Input
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            autoComplete="family-name"
            textContentType="familyName"
            returnKeyType="next"
          />
        )}
      </Field>

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

/**
 * True for the one failure the browser hand-off exists for.
 *
 * Matched on the code where Clerk gives one and on the message otherwise,
 * because the widget-failed case arrives as prose rather than a typed code.
 */
function isCaptchaFailure(error: unknown): boolean {
  if (!isClerkAPIResponseError(error)) return false;
  return error.errors.some((e) =>
    /captcha/i.test(`${e.code ?? ""} ${e.message ?? ""} ${e.longMessage ?? ""}`),
  );
}

const styles = StyleSheet.create({
  stack: { gap: theme.space[3] },
  resend: { alignSelf: "center", paddingVertical: theme.space[2] },
  pressed: { opacity: 0.6 },
  resendText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: theme.color.primary[700],
  },
});

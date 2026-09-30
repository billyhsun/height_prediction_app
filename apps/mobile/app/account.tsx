import { useClerk } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { deleteAccount, displayError } from "@notch/core";

import { useTranslations } from "@/components/i18n";
import { ParentDefaultsForm } from "@/components/ParentDefaultsForm";
import { RequireAuth } from "@/components/RequireAuth";
import { Button, Card, Field, Input, Section, fontSize, theme } from "@/components/ui";

export default function AccountScreen() {
  return (
    <RequireAuth>
      <Account />
    </RequireAuth>
  );
}

/**
 * Account settings, and deletion.
 *
 * Deletion has to be reachable in the app itself — App Store guideline 5.1.1(v)
 * requires it of any app that creates an account — which is why this screen
 * exists on mobile at all rather than deferring to the web.
 */
function Account() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useTranslations();
  const { signOut } = useClerk();

  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed =
    confirmation.trim().toUpperCase() === t.account.confirmWord.toUpperCase();

  async function handleDelete() {
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      // The Clerk user is gone, so the local session has to go too — otherwise
      // the app keeps rendering as signed in until the stale token is rejected.
      await signOut();
      router.replace("/");
    } catch (err) {
      setError(displayError(err, t.account.failed));
      setDeleting(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.page,
        { paddingTop: theme.space[5], paddingBottom: theme.space[5] + insets.bottom },
      ]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Text style={styles.subtitle}>{t.account.subtitle}</Text>

      {/* Collected at sign-up, but that step is skippable and people remeasure
          or change their mind. Above the danger zone, so the destructive
          control stays last. */}
      <Section title={t.parents.legend} description={t.parents.accountHelp}>
        <ParentDefaultsForm />
      </Section>

      <Card tone="muted" padding="lg">
        <View style={styles.danger}>
          <Text style={styles.dangerHeading}>{t.account.dangerHeading}</Text>
          <Text style={styles.body}>{t.account.dangerBody}</Text>

          <Field label={t.account.confirmPrompt(t.account.confirmWord)}>
            {() => (
              <Input
                value={confirmation}
                onChangeText={setConfirmation}
                placeholder={t.account.confirmPlaceholder}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!deleting}
              />
            )}
          </Field>

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button
            variant="danger"
            size="lg"
            fullWidth
            disabled={!confirmed}
            loading={deleting}
            onPress={handleDelete}
          >
            {deleting ? t.account.deleting : t.account.deleteButton}
          </Button>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.semantic.canvas },
  page: { paddingHorizontal: theme.space[5], gap: theme.space[4] },
  danger: { gap: theme.space[4] },
  dangerHeading: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: theme.color.danger[700],
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: theme.semantic.textSecondary,
  },
  body: { fontSize: fontSize.sm, lineHeight: 21, color: theme.semantic.textSecondary },
  error: { fontSize: fontSize.sm, color: theme.color.danger[700] },
});

import { StyleSheet, Text, View } from "react-native";

import { Button } from "./Button";
import { Card } from "./Card";
import { fontSize, theme } from "./theme";

type EmptyStateProps = {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Structured empty / guest nudge — replaces one-off muted Card copy. */
export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <Card padding="lg">
      <View style={styles.stack}>
        <View style={styles.mark} accessibilityElementsHidden />
        <Text style={styles.title}>{title}</Text>
        {body ? <Text style={styles.body}>{body}</Text> : null}
        {actionLabel && onAction ? (
          <Button size="sm" variant="secondary" onPress={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: { gap: theme.space[3], alignItems: "flex-start" },
  mark: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.primary[100],
    borderWidth: 2,
    borderColor: theme.color.primary[300],
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: theme.semantic.textPrimary,
  },
  body: {
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: theme.semantic.textSecondary,
  },
});

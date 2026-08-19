import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  /** `raised` for content that should read as a result rather than an input. */
  tone?: "default" | "raised" | "accent" | "muted";
  padding?: "sm" | "md" | "lg";
};

const TONES: Record<NonNullable<CardProps["tone"]>, string> = {
  default: "bg-surface border border-border",
  raised: "bg-surface border border-border shadow-md",
  accent: "bg-accent-50 border border-accent-200",
  muted: "bg-surface-sunk border border-border",
};

const PADDING: Record<NonNullable<CardProps["padding"]>, string> = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function Card({
  children,
  tone = "default",
  padding = "md",
}: CardProps) {
  return (
    <div className={`rounded-lg ${TONES[tone]} ${PADDING[padding]}`}>
      {children}
    </div>
  );
}

type SectionProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
};

/**
 * A titled group of fields. Replaces the `<fieldset>`/`<legend>` pairs the
 * forms used, which browsers style inconsistently and which have no React
 * Native equivalent.
 */
export function Section({ title, description, children }: SectionProps) {
  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold tracking-tight text-text-primary">
            {title}
          </h2>
          {description && (
            <p className="text-xs leading-relaxed text-text-secondary">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </Card>
  );
}

type BadgeProps = {
  children: ReactNode;
  tone?: "neutral" | "primary" | "accent" | "warning" | "success";
};

const BADGE_TONES: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-neutral-100 text-text-secondary",
  primary: "bg-primary-50 text-primary-700",
  accent: "bg-accent-50 text-accent-700",
  warning: "bg-warning-50 text-warning-700",
  success: "bg-success-50 text-success-700",
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

type StatProps = {
  label: string;
  value: string;
  unit?: string;
  tone?: "default" | "accent";
};

/**
 * A single prominent number. The results screen is mostly this, and giving it a
 * primitive keeps the ML and LLM figures typographically identical so they can
 * be compared honestly.
 */
export function Stat({ label, value, unit, tone = "default" }: StatProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium tracking-wide text-text-secondary uppercase">
        {label}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span
          className={`text-4xl font-bold tracking-tight tabular-nums ${
            tone === "accent" ? "text-accent-700" : "text-text-primary"
          }`}
        >
          {value}
        </span>
        {unit && (
          <span className="text-lg font-medium text-text-secondary">{unit}</span>
        )}
      </span>
    </div>
  );
}

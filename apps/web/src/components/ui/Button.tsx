import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;

/**
 * The prop API is the portable part. React Native cannot use Tailwind classes,
 * but it can implement `<Button variant="primary" size="md">` against the same
 * tokens — so screens written in terms of this component map across unchanged,
 * and the port costs one file per primitive rather than one per screen.
 *
 * `className` is deliberately omitted: an escape hatch here would leak web-only
 * styling into screens and quietly break that property.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-600 text-neutral-0 hover:bg-primary-700 active:bg-primary-800 shadow-sm",
  secondary:
    "bg-surface text-text-primary border border-border hover:bg-neutral-50 active:bg-neutral-100",
  ghost: "bg-transparent text-text-secondary hover:bg-neutral-100 hover:text-text-primary",
  danger: "bg-danger-600 text-neutral-0 hover:bg-danger-700 shadow-sm",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-[var(--control-sm)] px-3 text-sm",
  md: "h-[var(--control-md)] px-5 text-sm",
  lg: "h-[var(--control-lg)] px-6 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-md font-medium",
        "transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? "w-full" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

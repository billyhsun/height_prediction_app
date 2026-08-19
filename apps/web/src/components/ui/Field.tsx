import { useId } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

const CONTROL_BASE = [
  "w-full rounded-md border border-border bg-surface",
  "h-[var(--control-md)] px-3 text-sm text-text-primary",
  "placeholder:text-text-muted",
  "transition-colors duration-150",
  "hover:border-border-strong",
  "disabled:cursor-not-allowed disabled:bg-surface-sunk disabled:opacity-60",
].join(" ");

type FieldProps = {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: (props: { id: string; describedBy?: string }) => ReactNode;
};

/**
 * Pairs a label, optional hint and error with a control, wiring `htmlFor` and
 * `aria-describedby` so every form in the app is accessible by construction
 * rather than by remembering.
 *
 * The render-prop shape exists so the control receives the generated id without
 * the caller having to invent one.
 */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-xs leading-relaxed text-text-secondary">
          {hint}
        </p>
      )}
      {children({ id, describedBy })}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className">;

export function Input(props: InputProps) {
  return <input {...props} className={CONTROL_BASE} />;
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "className">;

export function Select(props: SelectProps) {
  return (
    <select
      {...props}
      className={`${CONTROL_BASE} cursor-pointer appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10`}
      style={{
        // Inline so the arrow inherits the token colour rather than hardcoding
        // a hex that would drift from the palette.
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%2371807c' stroke-width='1.5'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")",
      }}
    />
  );
}

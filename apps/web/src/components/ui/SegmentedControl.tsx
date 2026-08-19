"use client";

export type SegmentOption<T extends string | number> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string | number> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
};

/**
 * Two-or-three way choice rendered as one control rather than separate buttons.
 *
 * Used for sex selection and the language toggle. On mobile this maps to the
 * platform segmented control, which is why it exists as its own primitive
 * instead of a row of Buttons — the native equivalent is a different widget,
 * not a differently-styled button.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: SegmentedControlProps<T>) {
  const height = size === "sm" ? "h-8" : "h-[var(--control-md)]";

  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex w-full items-center gap-1 rounded-md border border-border bg-surface-sunk p-1 ${height}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={[
              "flex h-full flex-1 items-center justify-center rounded-sm px-3",
              "text-sm font-medium transition-colors duration-150",
              active
                ? "bg-primary-600 text-neutral-0 shadow-sm"
                : "text-text-secondary hover:bg-surface hover:text-text-primary",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

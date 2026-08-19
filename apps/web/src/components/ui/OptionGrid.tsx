"use client";

export type Option<T extends string> = {
  value: T;
  label: string;
};

type OptionGridProps<T extends string> = {
  options: Option<T>[];
  selected: readonly string[];
  onToggle: (value: T) => void;
  label: string;
};

/**
 * Multi-select rendered as tappable cards rather than bare checkboxes.
 *
 * Each card is a full-height target, which matters far more on a phone than a
 * 13px checkbox does. Uses a real checkbox underneath so keyboard and screen
 * reader behaviour is the browser's, not a reimplementation.
 */
export function OptionGrid<T extends string>({
  options,
  selected,
  onToggle,
  label,
}: OptionGridProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
      {options.map((option) => {
        const checked = selected.includes(option.value);
        return (
          <label
            key={option.value}
            className={[
              "flex min-h-[var(--control-md)] cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2",
              "text-sm transition-colors duration-150",
              checked
                ? "border-primary-500 bg-primary-50 text-primary-800"
                : "border-border bg-surface text-text-secondary hover:border-border-strong hover:bg-neutral-50",
            ].join(" ")}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(option.value)}
              className="size-4 shrink-0 accent-primary-600"
            />
            <span className="leading-snug">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

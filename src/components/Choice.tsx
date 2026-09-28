import type { ReactNode } from "react";

export type ChoiceOption<T> = {
  value: T;
  text: ReactNode;
  /** Accessible name, when the visible text is not enough. */
  label?: string;
};

/** A row of text toggles with an underline on the pressed one (like Triads / Sevenths). */
export function Choice<T extends string | number | boolean>({
  name,
  options,
  value,
  onChange,
  showName = true,
  note,
  className,
}: {
  name: string;
  options: ChoiceOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  /** Show the group's name before the options. */
  showName?: boolean;
  /** A short remark after the options. */
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`choice${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={name}
    >
      {showName && (
        <span className="choice-name" aria-hidden="true">
          {name}
        </span>
      )}
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          aria-label={o.label}
          onClick={() => {
            onChange(o.value);
          }}
        >
          {o.text}
        </button>
      ))}
      {note && <span className="choice-note">{note}</span>}
    </div>
  );
}

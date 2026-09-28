import type { ReactNode } from "react";

export type ChoiceOption<T> = {
  value: T;
  text: ReactNode;
  /** Accessible name, when the visible text is not enough. */
  label?: string;
};

/**
 * A row of text toggles with an underline on the pressed one (like the chord
 * type toggle). Stacked, the group's name sits above the options as a small
 * plain label and the options wrap onto the next line when they run out of room.
 */
export function Choice<T extends string | number | boolean>({
  name,
  options,
  value,
  onChange,
  showName = true,
  stacked = false,
  note,
  className,
}: {
  name: string;
  options: ChoiceOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  /** Show the group's name before (or above) the options. */
  showName?: boolean;
  stacked?: boolean;
  /** A short remark after the options. */
  note?: ReactNode;
  className?: string;
}) {
  const buttons = options.map((o) => (
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
  ));
  const classes = `choice${stacked ? " stacked" : ""}${className ? ` ${className}` : ""}`;
  if (stacked)
    return (
      <div className={classes} role="group" aria-label={name}>
        {showName && (
          <span className="choice-label" aria-hidden="true">
            {name}
          </span>
        )}
        <div className="choice-options">
          {buttons}
          {note && <span className="choice-note">{note}</span>}
        </div>
      </div>
    );
  return (
    <div className={classes} role="group" aria-label={name}>
      {showName && (
        <span className="choice-name" aria-hidden="true">
          {name}
        </span>
      )}
      {buttons}
      {note && <span className="choice-note">{note}</span>}
    </div>
  );
}

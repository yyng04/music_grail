import { useEffect, useRef, useState } from "react";
import { columns } from "../../relations/index.ts";
import { useAppStore } from "../../state/index.ts";
import { relativeMinor, type Target } from "../../theory/index.ts";
import { Spelled } from "../Spelled.tsx";
import { spokenName, targetName } from "../spelling.ts";

/**
 * Picks the compare key where there is no circle to click (the fretboard):
 * the 12 major or minor keys in circle-of-fifths order, spelled as the circle
 * spells them.
 */
export function KeyPicker() {
  const selection = useAppStore((s) => s.selection);
  const columnSpellings = useAppStore((s) => s.columnSpellings);
  const setCompare = useAppStore((s) => s.setCompare);
  const armCompare = useAppStore((s) => s.armCompare);
  const { primary, compare } = selection;
  const [minor, setMinor] = useState(
    primary.kind === "minor" || primary.kind === "harmonic-minor",
  );
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);

  const keys: Target[] = columns(selection, columnSpellings).map((c) =>
    minor ? relativeMinor(c.major) : { tonic: c.major, kind: "major" },
  );
  const same = (a: Target, b?: Target) =>
    b !== undefined && a.tonic === b.tonic && a.kind === b.kind;

  return (
    <section className="key-picker" aria-label="Pick a key to compare with">
      <div className="picker-head">
        <p>
          Compare <Spelled text={targetName(primary)} /> with
        </p>
        <div className="size" role="group" aria-label="Key type">
          <button
            type="button"
            aria-pressed={!minor}
            onClick={() => {
              setMinor(false);
            }}
          >
            Major
          </button>
          <button
            type="button"
            aria-pressed={minor}
            onClick={() => {
              setMinor(true);
            }}
          >
            Minor
          </button>
        </div>
      </div>
      <div className="picker-grid">
        {keys.map((k, i) => (
          <button
            key={k.tonic}
            ref={i === 0 ? first : undefined}
            type="button"
            disabled={same(k, primary)}
            aria-pressed={same(k, compare)}
            aria-label={spokenName(targetName(k))}
            onClick={() => {
              setCompare(k);
            }}
          >
            <Spelled text={minor ? `${k.tonic}m` : k.tonic} />
          </button>
        ))}
      </div>
      <div className="picker-foot">
        <button
          type="button"
          onClick={() => {
            armCompare(false);
          }}
        >
          Cancel
        </button>
        <span>Esc also cancels</span>
      </div>
    </section>
  );
}

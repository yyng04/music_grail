import { Spelled } from "../../components/Spelled.tsx";
import { chordLabel, spokenChord } from "../../components/spelling.ts";
import { diatonicChords } from "../../relations/index.ts";
import { useAppStore } from "../../state/index.ts";

/**
 * The key's chords as a row of text buttons, numeral above name, under a small
 * "Chord" label. The pressed one is the focus chord's degree; pressing it
 * again clears the focus, as in the chord list on the circle.
 */
export function ChordChips({
  sevenths,
  degree,
  onPick,
}: {
  sevenths: boolean;
  /** 1 to 7 for the focus chord's degree, or undefined with no focus chord. */
  degree: number | undefined;
  onPick: (symbol: string | undefined) => void;
}) {
  const primary = useAppStore((s) => s.selection.primary);
  return (
    <div className="choice stacked" role="group" aria-label="Chord">
      <span className="choice-label" aria-hidden="true">
        Chord
      </span>
      <div className="chips">
        {diatonicChords(primary, { sevenths }).map((c) => (
          <button
            key={c.symbol}
            type="button"
            aria-pressed={c.degree === degree}
            onClick={() => {
              onPick(c.degree === degree ? undefined : c.symbol);
            }}
          >
            <span className="chip-numeral">
              <Spelled text={c.numeral} />
            </span>{" "}
            <span className="chip-name">
              <Spelled text={chordLabel(c.symbol)} />
            </span>
            <span className="sr-only">, {spokenChord(c.symbol)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

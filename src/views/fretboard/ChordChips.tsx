import { Spelled } from "../../components/Spelled.tsx";
import { chordLabel, spokenChord } from "../../components/spelling.ts";
import { diatonicChords } from "../../relations/index.ts";
import { useAppStore } from "../../state/index.ts";

/**
 * The key's chords as a row of text buttons, numeral above name, so any chord
 * can be shown without leaving the board. No borders: the pressed one turns
 * bright, like the chord list.
 */
export function ChordChips({
  sevenths,
  value,
  onPick,
}: {
  sevenths: boolean;
  value: string | undefined;
  onPick: (symbol: string) => void;
}) {
  const primary = useAppStore((s) => s.selection.primary);
  return (
    <div className="chips" role="group" aria-label="Chord">
      {diatonicChords(primary, { sevenths }).map((c) => (
        <button
          key={c.symbol}
          type="button"
          aria-pressed={c.symbol === value}
          onClick={() => {
            onPick(c.symbol);
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
  );
}

import { compareSummary, diatonicChords } from "../../relations/index.ts";
import { useAppStore } from "../../state/index.ts";
import { Spelled } from "../Spelled.tsx";
import { chordLabel } from "../spelling.ts";

/** The key's chords, numbered by their Roman numerals; the focus chord turns bright (§5.1). */
export function ChordList() {
  const { primary, compare } = useAppStore((s) => s.selection);
  const sevenths = useAppStore((s) => s.sevenths);
  const setSevenths = useAppStore((s) => s.setSevenths);
  const setFocusChord = useAppStore((s) => s.setFocusChord);
  const chords = diatonicChords(primary, { sevenths });
  const shared = new Set(
    compare ? compareSummary(primary, compare, sevenths).sharedChords : [],
  );

  // Switching size keeps the focus on the same degree (Gm7 ↔ Gm).
  const resize = (next: boolean) => {
    if (next === sevenths) return;
    const degree = chords.findIndex((c) => c.symbol === primary.chord);
    setSevenths(next);
    if (degree >= 0)
      setFocusChord(
        "primary",
        diatonicChords(primary, { sevenths: next })[degree]?.symbol,
      );
  };

  return (
    <section aria-label="Chords">
      <div className="chord-head">
        <h2>Chords</h2>
        <div className="size" role="group" aria-label="Chord size">
          <button
            type="button"
            aria-pressed={!sevenths}
            onClick={() => {
              resize(false);
            }}
          >
            Triads
          </button>
          <button
            type="button"
            aria-pressed={sevenths}
            onClick={() => {
              resize(true);
            }}
          >
            Sevenths
          </button>
        </div>
      </div>
      <ol className="chords">
        {chords.map((c) => (
          <li key={c.symbol}>
            <button
              type="button"
              aria-pressed={primary.chord === c.symbol}
              onClick={() => {
                setFocusChord(
                  "primary",
                  primary.chord === c.symbol ? undefined : c.symbol,
                );
              }}
            >
              <span className="numeral">
                <Spelled text={c.numeral} />
              </span>
              <span>
                <Spelled text={chordLabel(c.symbol)} />
              </span>
              {compare && shared.has(c.symbol) && (
                <span className="also">
                  also in <Spelled text={compare.tonic} />
                </span>
              )}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

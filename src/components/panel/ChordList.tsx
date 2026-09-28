import { compareSummary, diatonicChords } from "../../relations/index.ts";
import { chordPart, play, unlockAudio } from "../../audio/index.ts";
import { useAppStore } from "../../state/index.ts";
import { Spelled } from "../Spelled.tsx";
import { chordLabel, spokenChord } from "../spelling.ts";

/** The key's chords, numbered by their Roman numerals; the focus chord turns bright. */
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
    if (next !== sevenths) setSevenths(next);
  };

  return (
    <section aria-label="Chords">
      <div className="chord-head">
        <h2>Chords</h2>
        <div className="size" role="group" aria-label="Chord type">
          <button
            type="button"
            aria-pressed={!sevenths}
            onClick={() => {
              resize(false);
            }}
          >
            3-note chords
          </button>
          <button
            type="button"
            aria-pressed={sevenths}
            onClick={() => {
              resize(true);
            }}
          >
            7th chords
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
                unlockAudio();
                setFocusChord(
                  "primary",
                  primary.chord === c.symbol ? undefined : c.symbol,
                );
                if (primary.chord !== c.symbol)
                  play("guitar", [chordPart(c.symbol)]);
              }}
            >
              <span className="numeral">
                <Spelled text={c.numeral} />
              </span>{" "}
              <span>
                <Spelled text={chordLabel(c.symbol)} />
              </span>
              <span className="sr-only">, {spokenChord(c.symbol)}</span>
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

import { compareSummary } from "../../relations/index.ts";
import { useAppStore } from "../../state/index.ts";
import { Spelled } from "../Spelled.tsx";
import { chordLabel, targetName } from "../spelling.ts";
import { KeyPicker } from "./KeyPicker.tsx";

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, word: string) =>
  `${WORDS[n] ?? String(n)} ${word}${n === 1 ? "" : "s"}`;

/** The Compare control, and once a compare is set, the card that says what changes (§3). */
export function CompareBlock() {
  const { primary, compare } = useAppStore((s) => s.selection);
  const sevenths = useAppStore((s) => s.sevenths);
  const armed = useAppStore((s) => s.compareArmed);
  const armCompare = useAppStore((s) => s.armCompare);
  const clearCompare = useAppStore((s) => s.clearCompare);
  const view = useAppStore((s) => s.view);

  // The circle is the key picker on its own view; elsewhere a grid of keys stands in.
  if (armed && view !== "circle") return <KeyPicker />;

  if (!compare)
    return (
      <button
        type="button"
        className="compare-open"
        aria-pressed={armed}
        onClick={() => {
          armCompare(!armed);
        }}
      >
        {armed ? (
          <span>
            Choose a key on the circle
            <small>
              Tap or click any key. Shift-click does the same at any time. Esc
              cancels.
            </small>
          </span>
        ) : (
          <span>
            Compare with another key
            <small>
              See which notes and chords change when music moves from{" "}
              <Spelled text={targetName(primary)} /> to another key.
            </small>
          </span>
        )}
        <span className="arrow" aria-hidden="true">
          {armed ? "×" : "→"}
        </span>
      </button>
    );

  const summary = compareSummary(primary, compare, sevenths);
  const changes = summary.changed;
  const change = changes.length
    ? `${cap(plural(changes.length, "note"))} change${changes.length === 1 ? "s" : ""} when music moves between these keys: ${changes
        .map((c) => `${c.from} becomes ${c.to}`)
        .join(
          ", ",
        )}${changes.every((c) => c.halfStep) ? (changes.length === 1 ? ", a half step" : ", each a half step") : ""}.`
    : summary.respelled
      ? `No pitch changes: all seven notes are the same pitches, ${String(summary.respelled)} spelled differently.`
      : "No notes change.";
  const shared = summary.sharedChords.map(chordLabel);
  const share = `They share ${plural(summary.sharedNotes, "note")} and ${plural(shared.length, sevenths ? "seventh chord" : "chord")}${
    shared.length ? `: ${shared.join(", ")}` : ""
  }.`;

  return (
    <section className="card" aria-label="Comparison">
      <p className="card-route">
        <b>
          <Spelled text={targetName(primary)} />
        </b>{" "}
        to{" "}
        <b>
          <Spelled text={targetName(compare)} />
        </b>
      </p>
      <p className={`card-big${changes.length > 1 ? " many" : ""}`}>
        {changes.length
          ? changes.map((c) => (
              <span key={c.from} className="card-change">
                <Spelled text={`${c.from} → ${c.to}`} />
              </span>
            ))
          : "Same notes"}
      </p>
      <p>
        <Spelled text={change} />
      </p>
      <p>
        <Spelled text={share} />
      </p>
      <div className="card-foot">
        <button
          type="button"
          onClick={() => {
            armCompare(true);
          }}
        >
          Change
        </button>
        <button type="button" onClick={clearCompare}>
          Clear
        </button>
        <span className="card-key" aria-hidden="true">
          <span>
            <i className="glow-mark" />
            both
          </span>
          <span>
            <i className="ring-mark" />
            <Spelled text={primary.tonic} /> only
          </span>
          <span>
            <i className="dash-mark" />
            <Spelled text={compare.tonic} /> only
          </span>
        </span>
      </div>
    </section>
  );
}

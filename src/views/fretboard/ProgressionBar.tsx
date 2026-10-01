import { useEffect, useId, useRef, type ReactNode } from "react";
import { play, boardInstrument, unlockAudio } from "../../audio/index.ts";
import { Choice } from "../../components/Choice.tsx";
import { scrollIntoRow } from "../../components/scroll.ts";
import { Spelled } from "../../components/Spelled.tsx";
import { chordLabel, spokenChord } from "../../components/spelling.ts";
import {
  parseProgression,
  progressionChords,
  type RootString,
} from "../../relations/index.ts";
import { appStore, barsFor, MAX_BARS, useAppStore } from "../../state/index.ts";
import { tuning } from "../../theory/index.ts";
import { modelOf, progressionNow } from "./shapeModel.ts";

const barsText = (n: number) => `${String(n)} bar${n === 1 ? "" : "s"}`;

/** Plays the shell on the board once, as other shapes do when picked. */
function playCurrentShell() {
  const model = modelOf(appStore.getState());
  if (model.sound.length)
    play(boardInstrument(), [{ notes: model.sound, style: "chord" }]);
}

/** The chord entry. A symbol that is not a chord gets a wavy underline in place and is skipped. */
function Entry() {
  const id = useId();
  const text = useAppStore((s) => s.progression.text);
  const bars = useAppStore((s) => s.progression.bars);
  const setProgression = useAppStore((s) => s.setProgression);
  const tokens = parseProgression(text);
  const bad = tokens.filter((t) => !t.chord);
  const marked: ReactNode[] = [];
  let at = 0;
  for (const t of tokens) {
    marked.push(text.slice(at, t.start));
    marked.push(
      t.chord ? (
        t.text
      ) : (
        <mark key={t.start} className="entry-bad">
          {t.text}
        </mark>
      ),
    );
    at = t.start + t.text.length;
  }
  return (
    <div className="prog-entry">
      <label className="choice-label" htmlFor={id}>
        Chords
      </label>
      <div className="entry-box">
        <div className="entry-mirror" aria-hidden="true">
          {marked}
        </div>
        <input
          id={id}
          className="entry-field"
          value={text}
          placeholder="Dm7 G7 Cmaj7"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-invalid={bad.length > 0}
          aria-describedby={bad.length ? `${id}-bad` : undefined}
          onChange={(e) => {
            const next = e.target.value;
            const count = progressionChords(parseProgression(next)).length;
            setProgression({ text: next, bars: barsFor(bars, count) });
          }}
        />
      </div>
      {bad.length > 0 && (
        <p className="entry-note" id={`${id}-bad`}>
          {bad.map((t) => t.text).join(", ")}{" "}
          {bad.length === 1 ? "is not a chord" : "are not chords"}, so the
          progression skips {bad.length === 1 ? "it" : "them"}.
        </p>
      )}
    </div>
  );
}

function BarStep({
  n,
  onChange,
}: {
  n: number;
  onChange: (n: number) => void;
}) {
  return (
    <span className="bar-step">
      <button
        type="button"
        aria-label="One bar fewer"
        disabled={n <= 1}
        onClick={() => {
          onChange(n - 1);
        }}
      >
        −
      </button>
      <span>{barsText(n)}</span>
      <button
        type="button"
        aria-label="One bar more"
        disabled={n >= MAX_BARS}
        onClick={() => {
          onChange(n + 1);
        }}
      >
        +
      </button>
    </span>
  );
}

/** The chords in order with their bar counts; a skipped symbol stays in place, struck through. */
function Strip() {
  const progression = useAppStore((s) => s.progression);
  const playback = useAppStore((s) => s.playback);
  const fretboard = useAppStore((s) => s.fretboard);
  const setProgression = useAppStore((s) => s.setProgression);
  const now = progressionNow(
    progression,
    playback,
    tuning(fretboard.instrument, fretboard.tuning).strings,
  );
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const on = list.current?.querySelector<HTMLElement>(".strip-item.on");
    if (list.current && on) scrollIntoRow(list.current, on);
  }, [now.index]);
  if (now.tokens.length === 0) return null;
  // Each readable symbol's place among the chords (skipped symbols have none).
  const chordIndex: number[] = [];
  let count = 0;
  for (const t of now.tokens) chordIndex.push(t.chord ? count++ : -1);
  return (
    <div className="prog-strip-group" role="group" aria-label="Progression">
      <span className="choice-label" aria-hidden="true">
        Progression, loops
      </span>
      <ol className="prog-strip" ref={list}>
        {now.tokens.map((t, j) => {
          if (!t.chord)
            return (
              <li key={t.start} className="strip-item bad">
                <span className="strip-chord">
                  <s>{t.text}</s>
                </span>
                <span className="strip-sub">not a chord</span>
              </li>
            );
          const i = chordIndex[j] ?? 0;
          const chord = t.chord;
          const on = i === now.index;
          return (
            <li
              key={t.start}
              className={`strip-item${on ? " on" : ""}${i === now.nextIndex && now.chords.length > 1 ? " next" : ""}`}
            >
              <button
                type="button"
                className="strip-chord"
                aria-pressed={on}
                aria-disabled={playback.running}
                onClick={() => {
                  // While playing, the metronome decides the chord.
                  if (appStore.getState().playback.running) return;
                  unlockAudio();
                  setProgression({ current: i });
                  playCurrentShell();
                }}
              >
                <Spelled text={chordLabel(chord)} />
                <span className="sr-only">, {spokenChord(chord)}</span>
              </button>
              <BarStep
                n={now.bars[i] ?? 1}
                onChange={(n) => {
                  const bars = [...now.bars];
                  bars[i] = n;
                  setProgression({ bars });
                }}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Progression mode's settings above the board: the entry, the root string, the strip. */
export function ProgressionBar() {
  const root = useAppStore((s) => s.progression.root);
  const setProgression = useAppStore((s) => s.setProgression);
  return (
    <>
      <div className="shape-settings">
        <Entry />
        <Choice<RootString>
          stacked
          name="Root string"
          options={[
            { value: "6th", text: "6th" },
            { value: "5th", text: "5th" },
            { value: "auto", text: "Auto" },
          ]}
          value={root}
          onChange={(next) => {
            setProgression({ root: next });
          }}
          note={root === "auto" ? "least movement" : undefined}
        />
      </div>
      <Strip />
    </>
  );
}

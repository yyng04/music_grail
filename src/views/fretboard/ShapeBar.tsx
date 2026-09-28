import { useId, useRef, useState } from "react";
import { Choice } from "../../components/Choice.tsx";
import { Spelled } from "../../components/Spelled.tsx";
import { chordLabel, spokenChord } from "../../components/spelling.ts";
import { diatonicChords } from "../../relations/index.ts";
import { HARMONIES, useAppStore, type ShapeState } from "../../state/index.ts";
import { chordPart, play, unlockAudio } from "../../audio/index.ts";
import { ChordChips } from "./ChordChips.tsx";
import {
  focusDegree,
  MODES,
  playShape,
  type BoardModel,
} from "./shapeModel.ts";

/**
 * The controls directly above the board. The Show modes are tabs, a
 * level above everything else. Under them, each setting is a group with a
 * small plain label, and the groups and their options wrap rather than run
 * off the edge. A plain title then says what the board shows. On phones the
 * settings fold away behind the title, so the board comes first.
 */
export function ShapeBar({
  model,
  compact,
  boardId,
}: {
  model: BoardModel;
  compact: boolean;
  /** The board the tabs control. */
  boardId: string;
}) {
  const [open, setOpen] = useState(false);
  const settingsId = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const st = useAppStore((s) => s.shapes);
  const setShapes = useAppStore((s) => s.setShapes);
  const selection = useAppStore((s) => s.selection);
  const sevenths = useAppStore((s) => s.sevenths);
  const setSevenths = useAppStore((s) => s.setSevenths);
  const setFocusChord = useAppStore((s) => s.setFocusChord);
  const { primary } = selection;
  // A new setting starts again from the first shape up the neck.
  const set = (patch: Partial<ShapeState>) => {
    setShapes({ shape: 0, ...patch });
  };
  const choose = (mode: ShapeState["mode"]) => {
    set({ mode, strings: null });
  };

  // One place picks the focus chord on the fretboard: the chips, and the chord type beside them.
  const harmony = st.mode === "two" && st.two === "harmony";
  const chord = !harmony && (
    <>
      <ChordChips
        sevenths={sevenths}
        degree={focusDegree(selection)}
        onPick={(symbol) => {
          unlockAudio();
          setFocusChord("primary", symbol);
          if (st.mode !== "scale") {
            set({});
            playShape();
          } else if (symbol) play("guitar", [chordPart(symbol)]);
        }}
      />
      <Choice
        stacked
        name="Chord type"
        options={[
          { value: false, text: "3-note chords" },
          { value: true, text: "7th chords" },
        ]}
        value={sevenths}
        onChange={(next) => {
          setSevenths(next);
          if (st.mode !== "scale") set({});
        }}
      />
    </>
  );

  const strings = model.sets.length > 0 && (
    <Choice
      stacked
      name="Strings"
      options={model.sets.map((s) => ({
        value: s.id,
        text: s.name,
        label: `Strings ${s.name}`,
      }))}
      value={model.set?.id}
      onChange={(id) => {
        set({ strings: id });
      }}
      note={
        harmony && (st.harmony === "6ths" || st.harmony === "octaves")
          ? "one string skipped"
          : undefined
      }
    />
  );

  let options = null;
  if (st.mode === "triads") options = strings;
  else if (st.mode === "two")
    options = (
      <>
        <Choice
          stacked
          name="From"
          options={[
            { value: "pairs", text: "Chord tones" },
            { value: "harmony", text: "The key's scale" },
          ]}
          value={st.two}
          onChange={(two) => {
            set({ two, strings: null });
          }}
        />
        {st.two === "pairs" ? (
          <Choice
            stacked
            name="Pair"
            options={model.pairs.map((p) => ({
              value: p.pair.join(),
              text: p.text,
            }))}
            value={model.pair?.pair.join()}
            onChange={(v) => {
              const pair = model.pairs.find((p) => p.pair.join() === v)?.pair;
              if (pair) set({ pair });
            }}
          />
        ) : (
          <Choice
            stacked
            name="Interval"
            options={HARMONIES.map((h) => ({
              value: h,
              text: h === "octaves" ? "Octaves" : h,
            }))}
            value={st.harmony}
            onChange={(next) => {
              set({ harmony: next, strings: null });
            }}
          />
        )}
        {strings}
      </>
    );
  else if (st.mode === "guide")
    options = (
      <>
        <Choice
          stacked
          name="Moves to"
          options={diatonicChords(primary, { sevenths: true })
            .filter((c) => c.symbol !== model.chord)
            .map((c) => ({
              value: c.symbol,
              text: (
                <>
                  <Spelled text={chordLabel(c.symbol)} />
                  <span className="sr-only">, {spokenChord(c.symbol)}</span>
                </>
              ),
            }))}
          value={model.next}
          onChange={(next) => {
            set({ next });
          }}
        />
        {strings}
      </>
    );

  // Every mode has settings: the chord (except harmony through the key), then its own.
  const settings = (
    <div className="shape-settings" id={settingsId}>
      {chord}
      {options}
    </div>
  );

  return (
    <div className="shape-bar">
      <div className="show-tabs" role="tablist" aria-label="Show">
        {MODES.map((m, i) => (
          <button
            key={m.value}
            ref={(el) => {
              if (el) tabRefs.current.set(m.value, el);
              else tabRefs.current.delete(m.value);
            }}
            type="button"
            role="tab"
            aria-selected={st.mode === m.value}
            aria-controls={boardId}
            tabIndex={st.mode === m.value ? 0 : -1}
            onClick={() => {
              choose(m.value);
            }}
            onKeyDown={(e) => {
              // Tabs: ← → move between the modes (and do not step the strip).
              const to =
                e.key === "ArrowRight"
                  ? MODES[(i + 1) % MODES.length]
                  : e.key === "ArrowLeft"
                    ? MODES[(i - 1 + MODES.length) % MODES.length]
                    : e.key === "Home"
                      ? MODES[0]
                      : e.key === "End"
                        ? MODES[MODES.length - 1]
                        : undefined;
              if (!to) return;
              e.preventDefault();
              choose(to.value);
              tabRefs.current.get(to.value)?.focus();
            }}
          >
            {m.text}
          </button>
        ))}
      </div>
      {(!compact || open) && settings}
      {compact ? (
        <button
          type="button"
          className="shape-title fold"
          aria-expanded={open}
          aria-controls={settingsId}
          onClick={() => {
            setOpen(!open);
          }}
        >
          <span aria-live="polite">
            <Spelled text={model.title} />
          </span>
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d={open ? "M2 8l4-4 4 4" : "M2 4l4 4 4-4"} />
          </svg>
        </button>
      ) : (
        <p className="shape-title" aria-live="polite">
          <Spelled text={model.title} />
        </p>
      )}
      {/* On phones a long "use it for" caption waits in the fold; guide-tone motion always shows. */}
      {model.caption && (!compact || open || st.mode === "guide") && (
        <p className="shape-caption">
          <Spelled text={model.caption} />
        </p>
      )}
    </div>
  );
}

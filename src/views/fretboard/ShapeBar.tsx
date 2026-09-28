import { useId, useState } from "react";
import { Choice } from "../../components/Choice.tsx";
import { Spelled } from "../../components/Spelled.tsx";
import { chordLabel, spokenChord } from "../../components/spelling.ts";
import { diatonicChords } from "../../relations/index.ts";
import { HARMONIES, useAppStore, type ShapeState } from "../../state/index.ts";
import { chordPart, play, unlockAudio } from "../../audio/index.ts";
import { ChordChips } from "./ChordChips.tsx";
import { MODES, PAIRS, playShape, type BoardModel } from "./shapeModel.ts";

/**
 * The controls directly above the board: the Show modes, one row of
 * the active mode's settings, and a plain title saying what the board shows.
 * On phones the settings fold away behind the title, so the board comes first.
 */
export function ShapeBar({
  model,
  compact,
}: {
  model: BoardModel;
  compact: boolean;
}) {
  const [open, setOpen] = useState(false);
  const settingsId = useId();
  const st = useAppStore((s) => s.shapes);
  const setShapes = useAppStore((s) => s.setShapes);
  const primary = useAppStore((s) => s.selection.primary);
  const sevenths = useAppStore((s) => s.sevenths);
  const setSevenths = useAppStore((s) => s.setSevenths);
  const setFocusChord = useAppStore((s) => s.setFocusChord);
  // A new setting starts again from the first shape up the neck.
  const set = (patch: Partial<ShapeState>) => {
    setShapes({ shape: 0, ...patch });
  };
  // Choosing a chord here also sets the chord list's size, so the panel shows the same chord.
  const pickChord = (symbol: string, size: boolean) => {
    unlockAudio();
    setSevenths(size);
    setFocusChord("primary", symbol);
    set({});
    playShape();
  };

  const strings = model.sets.length > 0 && (
    <Choice
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
        st.mode === "two" &&
        st.two === "harmony" &&
        (st.harmony === "6ths" || st.harmony === "octaves")
          ? "one string skipped"
          : undefined
      }
    />
  );
  const position = st.mode !== "scale" && (
    <Choice
      name="Position"
      options={[
        { value: "whole", text: "Whole neck" },
        ...model.positions.map((p) => ({
          value: p.name,
          text: `${p.name} shape`,
        })),
      ]}
      value={st.position ?? "whole"}
      onChange={(v) => {
        set({ position: v === "whole" ? null : v });
      }}
    />
  );

  let chips = null;
  if (st.mode === "scale")
    chips = (
      <ChordChips
        sevenths={sevenths}
        value={primary.chord}
        onPick={(symbol) => {
          unlockAudio();
          setFocusChord(
            "primary",
            primary.chord === symbol ? undefined : symbol,
          );
          if (primary.chord !== symbol) play("guitar", [chordPart(symbol)]);
        }}
      />
    );
  else if (st.mode === "triads")
    chips = (
      <ChordChips
        sevenths={false}
        value={model.chord}
        onPick={(symbol) => {
          pickChord(symbol, false);
        }}
      />
    );
  else if (st.mode === "guide" || st.two === "pairs")
    chips = (
      <ChordChips
        sevenths
        value={model.chord}
        onPick={(symbol) => {
          pickChord(symbol, true);
        }}
      />
    );

  let options = null;
  if (st.mode === "triads")
    options = (
      <>
        {strings}
        {position}
      </>
    );
  else if (st.mode === "two")
    options = (
      <>
        <Choice
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
            name="Pair"
            options={PAIRS.map((p) => ({
              value: p.pair.join(),
              text: p.text,
            }))}
            value={st.pair.join()}
            onChange={(v) => {
              const pair = PAIRS.find((p) => p.pair.join() === v)?.pair;
              if (pair) set({ pair });
            }}
          />
        ) : (
          <Choice
            name="In"
            options={HARMONIES.map((h) => ({
              value: h,
              text: h === "octaves" ? "Octaves" : h,
            }))}
            value={st.harmony}
            onChange={(harmony) => {
              set({ harmony, strings: null });
            }}
          />
        )}
        {strings}
        {position}
      </>
    );
  else if (st.mode === "guide")
    options = (
      <>
        <Choice
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
        {position}
      </>
    );

  return (
    <div className="shape-bar">
      <Choice
        name="Show"
        showName={false}
        className="show-modes"
        options={MODES}
        value={st.mode}
        onChange={(mode) => {
          set({ mode, strings: null });
        }}
      />
      {(!compact || open) && (chips ?? options) && (
        <div className="shape-settings" id={settingsId}>
          {chips}
          {options && <div className="shape-options">{options}</div>}
        </div>
      )}
      {compact && (chips ?? options) ? (
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

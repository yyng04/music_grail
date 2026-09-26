// The Show control and each mode's own options (§5.2b).
import type { ReactNode } from "react";
import { Spelled } from "../../components/Spelled.tsx";
import { chordLabel } from "../../components/spelling.ts";
import { diatonicChords } from "../../relations/index.ts";
import { useAppStore, type ShapeState } from "../../state/index.ts";
import {
  fretsText,
  MODES,
  nextChord,
  PAIRS,
  pairsFor,
  STRING_SETS,
  type Built,
  type Harmony,
} from "./shapeModel.ts";

type Props = { st: ShapeState; set: (patch: Partial<ShapeState>) => void };

function Choice<T extends string | number>({
  name,
  options,
  value,
  onChange,
  showName = true,
}: {
  name: string;
  options: { value: T; text: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  showName?: boolean;
}) {
  return (
    <div className="choice" role="group" aria-label={name}>
      {showName && <span className="choice-name">{name}</span>}
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => {
            onChange(o.value);
          }}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}

function Stepper({ built, set }: { built: Built; set: Props["set"] }) {
  const s = built.shapes[built.lit];
  if (!s) return null;
  return (
    <div className="stepper" role="group" aria-label="Shape">
      <button
        type="button"
        aria-label="Previous shape, down the neck"
        disabled={built.lit <= 0}
        onClick={() => {
          set({ shape: built.lit - 1 });
        }}
      >
        ‹
      </button>
      <span>
        <b>
          <Spelled text={s.tag} />
        </b>
        , {fretsText(s)}
        <small>
          {built.lit + 1} of {built.shapes.length}
        </small>
      </span>
      <button
        type="button"
        aria-label="Next shape, up the neck"
        disabled={built.lit >= built.shapes.length - 1}
        onClick={() => {
          set({ shape: built.lit + 1 });
        }}
      >
        ›
      </button>
    </div>
  );
}

/** The options of the active mode: string set, pair, interval, next chord. */
function ModeOptions({ st, set, built }: Props & { built: Built }) {
  const primary = useAppStore((s) => s.selection.primary);
  if (st.mode === "triads")
    return (
      <Choice
        name="Strings"
        options={STRING_SETS.map((x, i) => ({ value: i, text: x.text }))}
        value={st.set}
        onChange={(i) => {
          set({ set: i, shape: 0 });
        }}
      />
    );
  if (st.mode === "two")
    return (
      <>
        <Choice
          name="From"
          options={[
            {
              value: "pairs",
              text: (
                <>
                  <Spelled text={chordLabel(built.chord)} /> chord tones
                </>
              ),
            },
            { value: "harmony", text: "The key's scale" },
          ]}
          value={st.two}
          onChange={(two) => {
            set({ two, shape: 0 });
          }}
        />
        {st.two === "pairs" ? (
          <Choice
            name="Pair"
            options={PAIRS.map((p) => ({ value: p.pair.join(), text: p.text }))}
            value={st.pair.join()}
            onChange={(v) => {
              set({ pair: v.split(",") as ShapeState["pair"], shape: 0 });
            }}
          />
        ) : (
          <>
            <Choice
              name="In"
              options={(["3rds", "6ths", "4ths", "octaves"] as Harmony[]).map(
                (h) => ({ value: h, text: h === "octaves" ? "Octaves" : h }),
              )}
              value={st.harmony}
              onChange={(harmony) => {
                set({
                  harmony,
                  strings2: pairsFor(harmony)[1] ?? "2 3",
                  shape: 0,
                });
              }}
            />
            <Choice
              name="Strings"
              options={pairsFor(st.harmony).map((p) => ({ value: p, text: p }))}
              value={st.strings2}
              onChange={(strings2) => {
                set({ strings2, shape: 0 });
              }}
            />
          </>
        )}
      </>
    );
  if (st.mode === "guide") {
    const chords = diatonicChords(primary, { sevenths: true });
    const next = st.next ?? nextChord({ primary }, built.chord);
    return (
      <Choice
        name={`${chordLabel(built.chord)} moves to`}
        options={chords
          .filter((c) => c.symbol !== built.chord)
          .map((c) => ({
            value: c.symbol,
            text: <Spelled text={chordLabel(c.symbol)} />,
          }))}
        value={next}
        onChange={(n) => {
          set({ next: n, shape: 0 });
        }}
      />
    );
  }
  return null;
}

/**
 * The Show control (§5.2b) as a numbered list, like the chord list: the active
 * mode turns bright and opens its options, the shape stepper and its caption.
 */
export function ShowList({ built }: { built: Built }) {
  const st = useAppStore((s) => s.shapes);
  const set = useAppStore((s) => s.setShapes);
  return (
    <section className="show-list" aria-label="Show">
      <ol>
        {MODES.map((m, n) => (
          <li key={m.value}>
            <button
              type="button"
              aria-pressed={st.mode === m.value}
              onClick={() => {
                set({ mode: m.value, shape: 0 });
              }}
            >
              <span className="numeral">{n + 1}</span>
              {m.text}
            </button>
            {st.mode === m.value && (
              <div className="show-detail">
                <ModeOptions st={st} set={set} built={built} />
                {m.value !== "scale" && <Stepper built={built} set={set} />}
                <p className="mode-caption">
                  <Spelled text={built.caption} />
                </p>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

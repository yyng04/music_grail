import { useEffect, useRef, type ReactNode } from "react";
import { Spelled } from "../../components/Spelled.tsx";
import { spokenName } from "../../components/spelling.ts";
import type { Dot, Shape } from "../../relations/index.ts";
import { useAppStore } from "../../state/index.ts";
import { unlockAudio } from "../../audio/index.ts";
import { fretsText, playShape, type BoardModel } from "./shapeModel.ts";

type TileDot = Pick<Dot, "string" | "fret" | "role">;

const INTERVAL_WORDS: Record<string, string> = {
  m2: "minor 2nd",
  M2: "major 2nd",
  m3: "minor 3rd",
  M3: "major 3rd",
  P4: "perfect 4th",
  A4: "augmented 4th",
  d5: "diminished 5th",
  P5: "perfect 5th",
  A5: "augmented 5th",
  m6: "minor 6th",
  M6: "major 6th",
  m7: "minor 7th",
  M7: "major 7th",
  P8: "octave",
};

/** A small chord diagram: strings upright, lowest on the left, the shape's notes as rings. */
function Diagram({
  dots,
  next = [],
  strings,
  from,
  to,
}: {
  dots: TileDot[];
  next?: TileDot[];
  strings: number;
  from: number;
  to: number;
}) {
  const low = from === 0 ? 0 : from - 1;
  const rows = Math.max(4, to - low + 1);
  const W = 56;
  const cell = 14;
  const sx = (s: number) => 6 + ((W - 12) * s) / Math.max(1, strings - 1);
  const fy = (f: number) => 8 + (f - low + 0.5) * cell;
  return (
    <svg
      viewBox={`0 0 ${String(W)} ${String(16 + rows * cell)}`}
      width={W}
      height={16 + rows * cell}
      aria-hidden="true"
    >
      {Array.from({ length: strings }, (_, s) => (
        <line
          key={s}
          x1={sx(s)}
          x2={sx(s)}
          y1={8}
          y2={8 + rows * cell}
          className="t-string"
        />
      ))}
      {Array.from({ length: rows + 1 }, (_, r) => (
        <line
          key={r}
          x1={sx(0)}
          x2={sx(strings - 1)}
          y1={8 + r * cell}
          y2={8 + r * cell}
          className={r === 0 && low === 0 ? "t-nut" : "t-fret"}
        />
      ))}
      {dots.map((d) => (
        <circle
          key={`${String(d.string)}-${String(d.fret)}`}
          cx={sx(d.string)}
          cy={fy(d.fret)}
          r={4.6}
          className={`t-dot r-${d.role}`}
        />
      ))}
      {next.map((d) => (
        <circle
          key={`n${String(d.string)}-${String(d.fret)}`}
          cx={sx(d.string)}
          cy={fy(d.fret)}
          r={4.6}
          className="t-dot next"
        />
      ))}
    </svg>
  );
}

type Tile = {
  key: string;
  name: ReactNode;
  sub: string;
  label: string;
  diagram?: ReactNode;
  pick: () => void;
};

/**
 * The one navigator for positions and shapes: a small chord diagram
 * for each shape in neck order, or each CAGED position in Scale, with arrows
 * at the ends. ← / → step through it anywhere on the fretboard view.
 */
export function ShapeStrip({
  model,
  strings,
  frets,
  onStep,
}: {
  model: BoardModel;
  strings: number;
  frets: number;
  onStep: (dir: 1 | -1) => void;
}) {
  const st = useAppStore((s) => s.shapes);
  const setShapes = useAppStore((s) => s.setShapes);
  const wrap = useRef<HTMLDivElement>(null);
  const scale = st.mode === "scale";

  let tiles: Tile[];
  let lit: number;
  if (scale) {
    tiles = [
      {
        key: "whole",
        name: "Whole neck",
        sub: `frets 0 to ${String(frets)}`,
        label: "Whole neck",
        pick: () => {
          setShapes({ position: null });
        },
      },
      ...model.positions.map((p) => ({
        key: p.name,
        name: `${p.name} shape`,
        sub: fretsText({ low: p.from, high: p.to }),
        label: `${p.name} shape, ${fretsText({ low: p.from, high: p.to })}`,
        diagram: (
          <Diagram
            dots={model.positionDots[p.name] ?? []}
            strings={strings}
            from={p.from}
            to={p.to}
          />
        ),
        pick: () => {
          setShapes({ position: p.name });
        },
      })),
    ];
    lit = st.position
      ? 1 + model.positions.findIndex((p) => p.name === st.position)
      : 0;
  } else {
    tiles = model.shapes.map((s: Shape, i) => {
      const names = s.dots.map((d) => d.name);
      const nextNames = s.next?.map((d) => d.name) ?? [];
      const pair = names.join(" + ");
      let name: ReactNode = <Spelled text={s.tag ?? pair} />;
      let sub = fretsText(s);
      let label = `${s.tag ?? ""}, ${spokenName(s.bass ?? "")} in the bass, ${fretsText(s)}`;
      if (st.mode === "two") {
        name = <Spelled text={pair} />;
        sub = `${s.interval ?? ""}, ${fretsText(s)}`;
        label = `${spokenName(names.join(" and "))}, ${INTERVAL_WORDS[s.interval ?? ""] ?? s.interval ?? ""}, ${fretsText(s)}`;
      } else if (st.mode === "guide") {
        name = <Spelled text={pair} />;
        label = `${spokenName(names.join(" and "))} to ${spokenName(nextNames.join(" and "))}, ${fretsText(s)}`;
      }
      return {
        key: `${String(i)}-${String(s.low)}-${s.dots.map((d) => d.string).join("")}`,
        name,
        sub,
        label,
        diagram: (
          <Diagram
            dots={s.dots}
            next={(s.next ?? []).filter(
              (_, j) => s.moves?.[j]?.from !== s.moves?.[j]?.to,
            )}
            strings={strings}
            from={s.low}
            to={s.high}
          />
        ),
        pick: () => {
          setShapes({ shape: i });
        },
      };
    });
    lit = model.lit;
  }

  // Keep the lit tile in view, and keep focus on it while stepping inside the strip.
  useEffect(() => {
    const w = wrap.current;
    const el = w?.querySelector<HTMLElement>(".tile.on");
    if (!w || !el) return;
    const pad = 40;
    if (el.offsetLeft - pad < w.scrollLeft) w.scrollLeft = el.offsetLeft - pad;
    else if (
      el.offsetLeft + el.offsetWidth + pad >
      w.scrollLeft + w.clientWidth
    )
      w.scrollLeft = el.offsetLeft + el.offsetWidth + pad - w.clientWidth;
    if (w.contains(document.activeElement)) el.focus();
  }, [lit, tiles.length]);

  const what = scale ? "position" : "shape";
  return (
    <div className="strip-bar">
      <button
        type="button"
        className="strip-step"
        aria-label={`Previous ${what}, down the neck`}
        disabled={lit <= 0}
        onClick={() => {
          onStep(-1);
        }}
      >
        ‹
      </button>
      <div className="strip-wrap" ref={wrap}>
        <div
          className="strip"
          role="group"
          aria-label={scale ? "Positions" : "Shapes"}
        >
          {tiles.map((t, i) => (
            <button
              key={t.key}
              type="button"
              className={`tile${i === lit ? " on" : ""}${t.diagram ? "" : " whole"}`}
              aria-pressed={i === lit}
              aria-label={t.label}
              tabIndex={i === lit || (lit < 0 && i === 0) ? 0 : -1}
              onClick={() => {
                unlockAudio();
                t.pick();
                playShape();
              }}
            >
              {t.diagram}
              <span className="tile-name">{t.name}</span>
              <span className="tile-sub">{t.sub}</span>
            </button>
          ))}
          {tiles.length === 0 && (
            <p className="strip-empty">
              No shape fits here within 4 frets. Try other strings or the whole
              neck.
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        className="strip-step"
        aria-label={`Next ${what}, up the neck`}
        disabled={lit >= tiles.length - 1}
        onClick={() => {
          onStep(1);
        }}
      >
        ›
      </button>
    </div>
  );
}

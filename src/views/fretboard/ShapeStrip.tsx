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

export type Orientation = {
  /** Strings run up the page, as on the upright phone board. */
  upright: boolean;
  /** Lying down: lowest string at the top (player's view). */
  lowOnTop: boolean;
  /** Nut on the right lying down; mirrored string order upright. */
  leftHanded: boolean;
};

/**
 * A small diagram of a shape, drawn the same way round as the board: lying
 * down on a wide screen, upright on the phone board, with the same string
 * order and hand. The shape's notes are rings in their role colours.
 */
function Diagram({
  dots,
  next = [],
  strings,
  from,
  to,
  orient,
}: {
  dots: TileDot[];
  next?: TileDot[];
  strings: number;
  from: number;
  to: number;
  orient: Orientation;
}) {
  const low = from === 0 ? 0 : from - 1;
  const cells = Math.max(4, to - low + 1);
  const cell = 14;
  const gap = orient.upright ? 44 / Math.max(1, strings - 1) : 9;
  const along = 16 + cells * cell;
  const across = 12 + gap * Math.max(1, strings - 1);
  const mirrored = !orient.upright && orient.leftHanded;
  const a = (x: number) => (mirrored ? along - x : x);
  const place = (s: number) =>
    orient.upright
      ? orient.leftHanded
        ? strings - 1 - s
        : s
      : orient.lowOnTop
        ? s
        : strings - 1 - s;
  const c = (s: number) => 6 + gap * place(s);
  const fa = (f: number) => a(8 + (f - low + 0.5) * cell);
  const xy = (al: number, ac: number) =>
    orient.upright ? { x: ac, y: al } : { x: al, y: ac };
  const seg = (a0: number, c0: number, a1: number, c1: number) => {
    const p = xy(a0, c0);
    const q = xy(a1, c1);
    return { x1: p.x, y1: p.y, x2: q.x, y2: q.y };
  };
  const w = orient.upright ? across : along;
  const h = orient.upright ? along : across;
  return (
    <svg
      viewBox={`0 0 ${String(w)} ${String(h)}`}
      width={w}
      height={h}
      aria-hidden="true"
    >
      {Array.from({ length: strings }, (_, s) => (
        <line
          key={s}
          {...seg(a(8), c(s), a(8 + cells * cell), c(s))}
          className="t-string"
        />
      ))}
      {Array.from({ length: cells + 1 }, (_, r) => (
        <line
          key={r}
          {...seg(a(8 + r * cell), c(0), a(8 + r * cell), c(strings - 1))}
          className={r === 0 && low === 0 ? "t-nut" : "t-fret"}
        />
      ))}
      {dots.map((d) => {
        const p = xy(fa(d.fret), c(d.string));
        return (
          <circle
            key={`${String(d.string)}-${String(d.fret)}`}
            cx={p.x}
            cy={p.y}
            r={4.4}
            className={`t-dot r-${d.role}`}
          />
        );
      })}
      {next.map((d) => {
        const p = xy(fa(d.fret), c(d.string));
        return (
          <circle
            key={`n${String(d.string)}-${String(d.fret)}`}
            cx={p.x}
            cy={p.y}
            r={4.4}
            className="t-dot next"
          />
        );
      })}
    </svg>
  );
}

type Tile = {
  key: string;
  name: ReactNode;
  sub: string;
  /** Said after the visible text, for screen readers ("B in the bass"). */
  extra?: string;
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
  orient,
  onStep,
}: {
  model: BoardModel;
  strings: number;
  frets: number;
  orient: Orientation;
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
        pick: () => {
          setShapes({ position: null });
        },
      },
      ...model.positions.map((p) => ({
        key: p.name,
        name: `${p.name} form`,
        sub: fretsText({ low: p.from, high: p.to }),
        diagram: (
          <Diagram
            dots={model.positionDots[p.name] ?? []}
            strings={strings}
            from={p.from}
            to={p.to}
            orient={orient}
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
      let extra = `${spokenName(s.bass ?? "")} in the bass`;
      if (st.mode === "two") {
        name = <Spelled text={pair} />;
        sub = `${s.interval ?? ""}, ${fretsText(s)}`;
        extra = `${spokenName(names.join(" and "))}, ${INTERVAL_WORDS[s.interval ?? ""] ?? s.interval ?? ""}`;
      } else if (st.mode === "guide") {
        name = <Spelled text={pair} />;
        extra = `${spokenName(names.join(" and "))} to ${spokenName(nextNames.join(" and "))}`;
      }
      return {
        key: `${String(i)}-${String(s.low)}-${s.dots.map((d) => d.string).join("")}`,
        name,
        sub,
        extra,
        diagram: (
          <Diagram
            dots={s.dots}
            next={(s.next ?? []).filter(
              (_, j) => s.moves?.[j]?.from !== s.moves?.[j]?.to,
            )}
            strings={strings}
            from={s.low}
            to={s.high}
            orient={orient}
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
  // A small plain label names the strip, as each group in the control bar is named.
  const name = scale ? "CAGED position" : "Shapes along the neck";
  return (
    <div className="strip-group">
      <span className="choice-label" aria-hidden="true">
        {name}
      </span>
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
          <div className="strip" role="group" aria-label={name}>
            {tiles.map((t, i) => (
              <button
                key={t.key}
                type="button"
                className={`tile${i === lit ? " on" : ""}${t.diagram ? "" : " whole"}`}
                aria-pressed={i === lit}
                tabIndex={i === lit || (lit < 0 && i === 0) ? 0 : -1}
                onClick={() => {
                  unlockAudio();
                  t.pick();
                  playShape();
                }}
              >
                {t.diagram}
                <span className="tile-name">{t.name}</span>{" "}
                <span className="tile-sub">{t.sub}</span>
                {t.extra && <span className="sr-only">, {t.extra}</span>}
              </button>
            ))}
            {tiles.length === 0 && (
              <p className="strip-empty">
                No shape fits here within 4 frets. Try other strings.
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
    </div>
  );
}

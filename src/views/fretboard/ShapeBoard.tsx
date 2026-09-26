// The board for shape modes and positions: a lit shape with the others faint,
// lines joining each shape's notes, guide-tone moves, and the position as a
// glass window with the CAGED letters under the frets they cover.
import { useRef, type ReactNode } from "react";
import { HaloNote } from "../../components/HaloNote.tsx";
import { useElementWidth } from "../../hooks/useElementWidth.ts";
import { useMediaQuery } from "../../hooks/useMediaQuery.ts";
import { midi } from "../../theory/index.ts";
import {
  boardGeometry,
  DOUBLE_INLAYS,
  INLAYS,
  NUMBERED,
  OVERHANG,
  stringWidth,
} from "./geometry.ts";
import type { Dot, Position, Shape } from "../../relations/index.ts";

export type Layer = {
  dots: (Dot & { faint?: boolean; dashed?: boolean })[];
  shapes: { shape: Shape; lit: boolean }[];
};

const fmt = (n: number) => Number(n.toFixed(2));

export function ShapeBoard({
  strings,
  frets,
  layer,
  position,
  positions,
  onStep,
  leftHanded = false,
  lowOnTop = false,
  label = "degree",
  children,
}: {
  strings: readonly string[];
  frets: number;
  layer: Layer;
  position?: Position;
  /** All positions, for styles that place their letters along the neck. */
  positions?: Position[];
  onStep?: (step: 1 | -1) => void;
  leftHanded?: boolean;
  lowOnTop?: boolean;
  label?: "note" | "degree" | "interval" | "none";
  children?: ReactNode;
}) {
  const compact = useMediaQuery("(max-width: 760px)");
  const upright = useMediaQuery("(max-width: 600px)");
  const frame = useRef<HTMLDivElement>(null);
  const visible = useElementWidth(frame, upright ? 358 : 1344);
  const count = strings.length;
  const g = boardGeometry({
    viewWidth: visible,
    strings: count,
    frets,
    compact,
    upright,
    leftHanded,
  });
  // Same string order as the scale board: see Fretboard.tsx.
  const across = (s: number) =>
    g.row(
      upright ? (leftHanded ? count - 1 - s : s) : lowOnTop ? s : count - 1 - s,
    );
  const xy = (a: number, c: number) => g.xy(a, c).map(fmt) as [number, number];
  const pt = (a: number, c: number) => xy(a, c).join(" ");
  const line = (a0: number, c0: number, a1: number, c1: number) => {
    const [x1, y1] = xy(a0, c0);
    const [x2, y2] = xy(a1, c1);
    return { x1, y1, x2, y2 };
  };
  const at = (a: number, c: number) => {
    const [left, top] = xy(a, c);
    return { left, top };
  };
  const neckStart = g.fret(0);
  const neckEnd = g.fret(frets);
  const edgeIn = g.firstRow - OVERHANG;
  const edgeOut = g.lastRow + OVERHANG;
  const middle = (g.firstRow + g.lastRow) / 2;
  // Upright, the slab keeps clear of the fret-number column.
  const slabPad = upright ? 0 : 10;
  const [gx, gy] = xy(neckStart, edgeIn);
  const [gx2, gy2] = xy(neckEnd, edgeOut);

  // A window covers its frets, from the wire before the first to the last fret's wire.
  const winStart = (p: Position) =>
    p.from === 0 ? g.dot(0) - 24 : g.fret(p.from - 1);
  const winEnd = (p: Position) => g.fret(p.to);
  const box = (a0: number, a1: number, c0: number, c1: number) => {
    const [x0, y0] = xy(a0, c0);
    const [x1, y1] = xy(a1, c1);
    return {
      x: Math.min(x0, x1),
      y: Math.min(y0, y1),
      width: Math.abs(x1 - x0),
      height: Math.abs(y1 - y0),
    };
  };

  return (
    <div className={`board-scroll${upright ? " upright" : ""}`} ref={frame}>
      <div
        className="board"
        style={{ width: fmt(g.width), height: fmt(g.height) }}
      >
        <svg
          viewBox={`0 0 ${String(fmt(g.width))} ${String(fmt(g.height))}`}
          width={fmt(g.width)}
          height={fmt(g.height)}
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id="boardSmoke"
              x1="0"
              y1="0"
              x2={upright ? "1" : "0"}
              y2={upright ? "0" : "1"}
            >
              <stop
                offset="0"
                stopColor="oklch(0.12 0.006 25)"
                stopOpacity="0.45"
              />
              <stop
                offset="1"
                stopColor="oklch(0.08 0.005 25)"
                stopOpacity="0.6"
              />
            </linearGradient>
            <linearGradient
              id="boardRim"
              gradientUnits="userSpaceOnUse"
              {...line(neckStart, edgeIn, neckEnd, edgeIn)}
            >
              <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.12" />
              <stop offset="1" stopColor="#d0473a" stopOpacity="0.45" />
            </linearGradient>
            <linearGradient
              id="slabFill"
              x1="0"
              y1="0"
              x2={upright ? "1" : "0"}
              y2={upright ? "0" : "1"}
            >
              <stop offset="0" stopColor="#fff" stopOpacity="0.07" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.015" />
              <stop offset="1" stopColor="#fff" stopOpacity="0.035" />
            </linearGradient>
            <linearGradient
              id="slabRim"
              x1="0"
              y1="0"
              x2={upright ? "1" : "0"}
              y2="1"
            >
              <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
              <stop offset="0.55" stopColor="#fff" stopOpacity="0.2" />
              <stop offset="1" stopColor="#c23a30" stopOpacity="0.9" />
            </linearGradient>
            <filter
              id="slabShadow"
              x="-20%"
              y="-20%"
              width="140%"
              height="160%"
            >
              <feDropShadow
                dx="0"
                dy="12"
                stdDeviation="12"
                floodColor="#000"
                floodOpacity="0.45"
              />
            </filter>
          </defs>
          <rect
            className="board-glass"
            x={gx}
            y={gy}
            width={fmt(gx2 - gx)}
            height={fmt(gy2 - gy)}
          />
          <path
            className="board-edge"
            d={`M${pt(neckStart, edgeIn)}L${pt(neckEnd, edgeIn)}`}
          />
          {Array.from({ length: frets }, (_, i) => i + 1).map((n) => (
            <line
              key={n}
              className={`fret${n % 12 === 0 ? " octave" : ""}`}
              {...line(g.fret(n), edgeIn, g.fret(n), edgeOut)}
            />
          ))}
          <line
            className="nut"
            {...line(g.fret(0), edgeIn, g.fret(0), edgeOut)}
          />
          {strings.map((open, s) => (
            <line
              key={s}
              className="string"
              strokeWidth={stringWidth(midi(open))}
              {...line(neckStart, across(s), neckEnd, across(s))}
            />
          ))}

          {/* Position window */}
          {position && (
            <g className="slab" filter="url(#slabShadow)">
              <rect
                {...box(
                  winStart(position),
                  winEnd(position),
                  edgeIn - slabPad,
                  edgeOut + slabPad,
                )}
                fill="url(#slabFill)"
              />
              <rect
                {...box(
                  winStart(position),
                  winEnd(position),
                  edgeIn - slabPad,
                  edgeOut + slabPad,
                )}
                className="slab-edge"
              />
              {/* the bright corner of the glass, as on the circle's key window */}
              <path
                className="slab-spec"
                d={`M${pt(winStart(position) + 4, edgeIn + 30)}L${pt(winStart(position) + 4, edgeIn - 6)}L${pt(winStart(position) + 60, edgeIn - 6)}`}
              />
            </g>
          )}
          {/* Stick lines join the notes of each shape. */}
          {layer.shapes.map(({ shape, lit }, i) => {
            const ds = [...shape.dots].sort((a, b) => a.string - b.string);
            return (
              <polyline
                key={`s${String(i)}`}
                className={`stick${lit ? " lit" : ""}`}
                points={ds
                  .map((d) => pt(g.dot(d.fret), across(d.string)))
                  .join(" ")}
              />
            );
          })}
          {/* Guide-tone moves: an arrow for each note that moves, one fret away. */}
          {layer.shapes
            .filter((s) => s.lit)
            .flatMap(({ shape }) => shape.moves ?? [])
            .filter((m) => !m.held)
            .map((m) => {
              const a0 = g.dot(m.from);
              const a1 = g.dot(m.to);
              const c = across(m.string) + g.dotSize(m.from) / 2 + 3;
              return (
                <path
                  key={`m${String(m.string)}-${String(m.from)}`}
                  className="move"
                  markerEnd="url(#arrow)"
                  d={`M${pt(a0, c)}Q${pt((a0 + a1) / 2, c + 12)} ${pt(a1, c)}`}
                />
              );
            })}
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 8 8"
              refX="6"
              refY="4"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path
                d="M1 1L6 4L1 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </marker>
          </defs>
        </svg>

        {INLAYS.filter((n) => n <= frets).flatMap((n) =>
          (DOUBLE_INLAYS.has(n)
            ? [middle - g.spacing, middle + g.spacing]
            : [middle]
          ).map((c) => (
            <span
              key={`${String(n)}-${String(c)}`}
              className="inlay"
              style={at(g.dot(n), c)}
            />
          )),
        )}
        {NUMBERED.filter((n) => n <= frets).map((n) => (
          <span
            key={n}
            className="fret-number"
            style={at(g.dot(n), g.numberRow)}
          >
            {n}
          </span>
        ))}
        {/* Glass style: the positions' letters sit along the neck, under the frets they cover. */}
        {positions?.map((p) => {
          const a = (winStart(p) + winEnd(p)) / 2;
          // Upright, the letters share the fret-number column, between the numbers.
          const c = upright ? g.numberRow : g.numberRow + 26;
          return (
            <span
              key={p.name}
              className={`pos-letter${position?.name === p.name ? " on" : ""}`}
              style={at(a, c)}
            >
              {p.name}
            </span>
          );
        })}
        {position && onStep && (
          <>
            <button
              type="button"
              className="slab-step"
              aria-label="Previous position"
              style={at(
                winStart(position) - (upright ? 0 : 16),
                upright ? edgeOut + 8 : edgeIn - 26,
              )}
              onClick={() => {
                onStep(-1);
              }}
            >
              {upright ? "↑" : "‹"}
            </button>
            {!upright && (
              <span
                className="slab-name"
                style={at(
                  (winStart(position) + winEnd(position)) / 2,
                  edgeIn - 26,
                )}
              >
                {position.name} shape
              </span>
            )}
            <button
              type="button"
              className="slab-step"
              aria-label="Next position"
              style={at(
                winEnd(position) + (upright ? 0 : 16),
                upright ? edgeOut + 8 : edgeIn - 26,
              )}
              onClick={() => {
                onStep(1);
              }}
            >
              {upright ? "↓" : "›"}
            </button>
          </>
        )}

        {layer.dots.map((d) => (
          <span
            key={`${String(d.string)}-${String(d.fret)}-${d.dashed ? "n" : "c"}`}
            className={`fret-dot${d.faint ? " faint" : ""}`}
            style={{
              ...at(g.dot(d.fret), across(d.string)),
              ["--dot-d" as string]: `${String(fmt(g.dotSize(d.fret)))}px`,
            }}
          >
            <HaloNote
              name={d.name}
              membership={d.dashed ? "compare" : "primary"}
              role={d.role}
              // A lit 2nd, 4th or 6th gets the plain grey ring so the shape still reads.
              hasCompare={
                d.role === "other" && !d.faint && layer.shapes.length > 0
              }
              label={
                label === "note" ? d.name : label === "none" ? "" : d.label
              }
              core
              small
            />
          </span>
        ))}
        {/* A guide tone that stays put is marked "held". */}
        {layer.shapes
          .filter((s) => s.lit)
          .flatMap(({ shape }) => shape.moves ?? [])
          .filter((m) => m.held)
          .map((m) => (
            <span
              key={`h${String(m.string)}`}
              className="held"
              style={
                upright
                  ? at(
                      g.dot(m.from) + g.dotSize(m.from) / 2 + 8,
                      across(m.string),
                    )
                  : at(
                      g.dot(m.from),
                      across(m.string) + g.dotSize(m.from) / 2 + 9,
                    )
              }
            >
              held
            </span>
          ))}
        {children}
      </div>
    </div>
  );
}

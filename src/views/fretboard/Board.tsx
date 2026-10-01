import { useLayoutEffect, useRef, useState } from "react";
import { HaloNote } from "../../components/HaloNote.tsx";
import { spokenName } from "../../components/spelling.ts";
import { useElementWidth } from "../../hooks/useElementWidth.ts";
import { useMediaQuery } from "../../hooks/useMediaQuery.ts";
import { midi, pitchClass } from "../../theory/index.ts";
import {
  boardGeometry,
  DOUBLE_INLAYS,
  INLAYS,
  NUMBERED,
  OVERHANG,
  stringWidth,
} from "./geometry.ts";
import type { BoardModel, BoardNote } from "./shapeModel.ts";

const fmt = (n: number) => Number(n.toFixed(2));

/**
 * The fretboard: smoked glass with frets in real proportion,
 * the string names at the nut, and the notes the model shows as halo notes.
 * Every position is always rendered, so notes fade in and out as the
 * selection or the shape changes. A position is drawn as a glass window.
 */
export function Board({
  id,
  strings,
  frets,
  leftHanded,
  lowOnTop,
  bare,
  model,
  onStep,
  onNote,
}: {
  id?: string;
  strings: readonly string[];
  frets: number;
  leftHanded: boolean;
  lowOnTop: boolean;
  /** No dot labels: scale tones without a ring get a grey one. */
  bare: boolean;
  model: BoardModel;
  onStep: (dir: 1 | -1) => void;
  onNote?: (note: BoardNote) => void;
}) {
  const compact = useMediaQuery("(max-width: 760px)");
  const upright = useMediaQuery("(max-width: 600px)");
  const scroller = useRef<HTMLDivElement>(null);
  const visible = useElementWidth(scroller, upright ? 358 : 1344);
  const count = strings.length;
  const g = boardGeometry({
    viewWidth: visible,
    strings: count,
    frets,
    compact,
    upright,
    leftHanded,
  });
  // Lying down, the diagram view puts the highest string at the top and the
  // player's view the lowest. Upright reads like a chord diagram: lowest
  // string on the left, mirrored for the left hand.
  const place = (string: number) =>
    upright
      ? leftHanded
        ? count - 1 - string
        : string
      : lowOnTop
        ? string
        : count - 1 - string;
  const across = (string: number) => g.row(place(string));
  const active = model.active;
  const dim = (string: number) =>
    active !== undefined && !active.includes(string);

  // A left-handed board lying down starts scrolled to its nut, on the right.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = leftHanded && !upright ? el.scrollWidth : 0;
  }, [leftHanded, upright]);

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
  const box = (a0: number, a1: number, c0: number, c1: number) => {
    const [x0, y0] = xy(a0, c0);
    const [x1, y1] = xy(a1, c1);
    return {
      x: Math.min(x0, x1),
      y: Math.min(y0, y1),
      width: fmt(Math.abs(x1 - x0)),
      height: fmt(Math.abs(y1 - y0)),
    };
  };
  const neckStart = Math.min(g.fret(0), g.fret(frets));
  const neckEnd = Math.max(g.fret(0), g.fret(frets));
  const edgeIn = g.firstRow - OVERHANG;
  const edgeOut = g.lastRow + OVERHANG;
  const middle = (g.firstRow + g.lastRow) / 2;
  // The lit rim runs along the neck, bright at the nut end.
  const rimFlip = leftHanded && !upright;
  const { position } = model;

  // Keyboard: the notes on the board are one tab stop. The arrow keys move to
  // the nearest note in that direction on screen (so it works lying down and
  // upright), Enter or Space plays it.
  const keyOf = (n: BoardNote) => `${String(n.string)}-${String(n.fret)}`;
  const shown = model.notes.filter((n) => n.shown);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const current = shown.find((n) => keyOf(n) === focusKey) ?? shown[0];
  const dotRefs = useRef(new Map<string, HTMLSpanElement>());
  const DIRS: Record<string, [number, number]> = {
    ArrowRight: [1, 0],
    ArrowLeft: [-1, 0],
    ArrowDown: [0, 1],
    ArrowUp: [0, -1],
  };
  const onDotKey = (e: React.KeyboardEvent, n: BoardNote) => {
    if ((e.key === "Enter" || e.key === " ") && onNote) {
      e.preventDefault();
      onNote(n);
      return;
    }
    const dir = DIRS[e.key];
    if (!dir) return;
    e.preventDefault();
    const [x0, y0] = xy(g.dot(n.fret), across(n.string));
    let best: { n: BoardNote; score: number } | undefined;
    for (const m of shown) {
      const [x, y] = xy(g.dot(m.fret), across(m.string));
      const ahead = (x - x0) * dir[0] + (y - y0) * dir[1];
      if (ahead <= 1) continue;
      const aside = Math.abs((x - x0) * dir[1] - (y - y0) * dir[0]);
      const score = ahead + 2 * aside;
      if (!best || score < best.score) best = { n: m, score };
    }
    if (!best) return;
    setFocusKey(keyOf(best.n));
    dotRefs.current.get(keyOf(best.n))?.focus();
  };
  // A window covers its frets, from the wire before the first to the last fret's wire.
  const winStart = (from: number) =>
    from === 0
      ? g.dot(0) - (leftHanded && !upright ? -24 : 24)
      : g.fret(from - 1);
  // Upright, the slab keeps clear of the fret-number column.
  const slabPad = upright ? 0 : 10;

  return (
    <div
      className={`board-scroll${position ? " windowed" : ""}`}
      ref={scroller}
    >
      <div
        id={id}
        className="board"
        role="group"
        aria-label={`Fretboard: ${spokenName(model.subject)}`}
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
              {...line(
                rimFlip ? neckEnd : neckStart,
                edgeIn,
                rimFlip ? neckStart : neckEnd,
                edgeIn,
              )}
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
            <marker
              id="moveArrow"
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
          <rect
            className="board-glass"
            {...box(neckStart, neckEnd, edgeIn, edgeOut)}
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
              className={`string${dim(s) ? " dim" : ""}`}
              strokeWidth={stringWidth(midi(open))}
              {...line(neckStart, across(s), neckEnd, across(s))}
            />
          ))}

          {position && (
            <g className="slab" filter="url(#slabShadow)">
              <rect
                {...box(
                  winStart(position.from),
                  g.fret(position.to),
                  edgeIn - slabPad,
                  edgeOut + slabPad,
                )}
                fill="url(#slabFill)"
              />
              <rect
                {...box(
                  winStart(position.from),
                  g.fret(position.to),
                  edgeIn - slabPad,
                  edgeOut + slabPad,
                )}
                className="slab-edge"
              />
            </g>
          )}

          {/* With a compare, a half-step link joins a changed note to the note that replaces it. */}
          {model.links.map((l) => {
            const a0 = g.dot(l.from);
            const a1 = g.dot(l.to);
            const c = across(l.string) - g.dotSize(l.from) / 2 - 2;
            return (
              <path
                key={`${String(l.string)}-${String(l.from)}-${String(l.to)}`}
                className="half-link"
                d={`M${pt(a0, c + 4)}Q${pt((a0 + a1) / 2, c - 9)} ${pt(a1, c + 4)}`}
              />
            );
          })}
          {/* Guide tones: an arrow from each note that moves to where it goes. */}
          {model.moves.map((m) => {
            const a0 = g.dot(m.from);
            const a1 = g.dot(m.to);
            const c = across(m.string) + g.dotSize(m.from) / 2 + 3;
            return (
              <path
                key={`${String(m.string)}-${String(m.from)}`}
                className="move"
                markerEnd="url(#moveArrow)"
                d={`M${pt(a0, c)}Q${pt((a0 + a1) / 2, c + 12)} ${pt(a1, c)}`}
              />
            );
          })}
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
            aria-hidden="true"
            style={at(g.dot(n), g.numberRow)}
          >
            {n}
          </span>
        ))}
        {strings.map((open, s) => (
          <span
            key={s}
            className={`string-name${dim(s) ? " dim" : active ? " on" : ""}`}
            aria-hidden="true"
            style={at(g.name, across(s))}
          >
            {pitchClass(open)}
          </span>
        ))}

        {position && (
          <>
            <button
              type="button"
              className="slab-step"
              aria-label="Previous position, down the neck"
              style={at(
                winStart(position.from) - (upright ? 0 : 16),
                upright ? edgeOut + 8 : edgeIn - 26,
              )}
              onClick={() => {
                onStep(-1);
              }}
            >
              {upright ? "↑" : leftHanded ? "›" : "‹"}
            </button>
            {!upright && (
              <span
                className="slab-name"
                style={at(
                  (winStart(position.from) + g.fret(position.to)) / 2,
                  edgeIn - 26,
                )}
              >
                {position.name} form
              </span>
            )}
            <button
              type="button"
              className="slab-step"
              aria-label="Next position, up the neck"
              style={at(
                g.fret(position.to) + (upright ? 0 : leftHanded ? -16 : 16),
                upright ? edgeOut + 8 : edgeIn - 26,
              )}
              onClick={() => {
                onStep(1);
              }}
            >
              {upright ? "↓" : leftHanded ? "‹" : "›"}
            </button>
          </>
        )}

        {model.notes.map((n) => (
          <span
            key={keyOf(n)}
            ref={(el) => {
              if (el) dotRefs.current.set(keyOf(n), el);
              else dotRefs.current.delete(keyOf(n));
            }}
            className={`fret-dot${n.shown ? "" : " hidden"}${bare ? " bare" : ""}${onNote ? " playable" : ""}`}
            role={n.shown ? (onNote ? "button" : "img") : undefined}
            // An image takes no name from its content, so a dot that does not play keeps a label.
            aria-label={n.shown && !onNote ? n.aria : undefined}
            aria-hidden={n.shown ? undefined : true}
            tabIndex={
              n.shown && onNote
                ? current && keyOf(current) === keyOf(n)
                  ? 0
                  : -1
                : undefined
            }
            onFocus={() => {
              setFocusKey(keyOf(n));
            }}
            onKeyDown={
              n.shown
                ? (e) => {
                    onDotKey(e, n);
                  }
                : undefined
            }
            style={{
              ...at(g.dot(n.fret), across(n.string)),
              ["--dot-d" as string]: `${String(fmt(g.dotSize(n.fret)))}px`,
            }}
            onClick={
              onNote && n.shown
                ? () => {
                    onNote(n);
                  }
                : undefined
            }
          >
            <HaloNote
              name={n.name}
              membership={n.membership}
              role={n.role}
              hasCompare={n.ring}
              label={n.label}
              core
              small
            />
            {/* The name starts with the visible label, then says the pitch and place. */}
            {n.shown && (
              <span className="sr-only">
                {n.label ? ", " : ""}
                {n.aria}
              </span>
            )}
          </span>
        ))}
        {model.held.map((h) => (
          <span
            key={`h${String(h.string)}`}
            className="held"
            aria-hidden="true"
            style={
              upright
                ? at(
                    g.dot(h.fret) + g.dotSize(h.fret) / 2 + 8,
                    across(h.string),
                  )
                : // Under the note, or above it on the bottom string, clear of the fret numbers.
                  at(
                    g.dot(h.fret),
                    across(h.string) +
                      (place(h.string) === count - 1 ? -1 : 1) *
                        (g.dotSize(h.fret) / 2 + 9),
                  )
            }
          >
            held
          </span>
        ))}
      </div>
    </div>
  );
}

import {
  animate,
  useMotionValue,
  useReducedMotion,
  type MotionValue,
} from "motion/react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { HaloNote } from "../../components/HaloNote.tsx";
import { SvgSpelled } from "../../components/Spelled.tsx";
import {
  chordLabel,
  spokenName,
  targetName,
} from "../../components/spelling.ts";
import { useElementWidth } from "../../hooks/useElementWidth.ts";
import {
  RINGS,
  TOGGLE_COLUMNS,
  cellId,
  cellStates,
  columns,
  keyForCell,
  noteArcs,
  noteRing,
  turn,
  windowAngle,
  type CellState,
  type Column,
  type Ring,
} from "../../relations/index.ts";
import { useAppStore } from "../../state/index.ts";
import type { Target } from "../../theory/index.ts";
import {
  arc,
  CX,
  CY,
  fmt,
  line,
  point,
  sector,
  windowPath,
} from "./geometry.ts";

/** Radii in a 980-unit box centred at (480, 480). */
const R: Record<Ring, number> = { outer: 330, middle: 240, inner: 157 };
const BAND: Record<Ring, [number, number]> = {
  outer: [285, 420],
  middle: [196, 285],
  inner: [112, 196],
};
const SLAB = { rIn: 114, rMid: 196, rOut: 396 };
const NOTE_R = 447;
const DISC_R = 418;
/** Orbit gaps (degrees either side of a label) so no line crosses a label or numeral. */
const GAP: Record<Ring, number> = { outer: 8.5, middle: 10.5, inner: 13 };
const WINDOW = windowPath(SLAB.rIn, SLAB.rMid, SLAB.rOut);
const EASE = [0.16, 1, 0.3, 1] as const;
const TURN_SECONDS = 0.4;

/** Type sizes in box units, with a floor in screen pixels so labels stay legible on phones. */
function sizes(width: number) {
  const scale = width / 980;
  const px = (base: number, min: number) => Math.max(base, min / scale);
  const compact = scale < 0.6;
  return {
    scale,
    compact,
    outer: px(32, compact ? 17 : 19),
    middle: px(24, compact ? 14 : 15.5),
    inner: px(18, compact ? 12 : 13),
    numeral: px(19, compact ? 11.5 : 13),
    hub: px(62, 26),
    kind: px(16, 12),
    note: px(44, 26),
  };
}
type Sizes = ReturnType<typeof sizes>;

/** Numerals sit outside any ring round their label (§5.1: numerals never under a ring). */
function numeralOffset(
  st: CellState,
  fs: number,
  numeral: number,
  compact: boolean,
): number {
  if (compact) return fs * 0.95;
  const ring = st.focus ? fs * 1.05 : st.tonic ? fs * 0.9 : 0;
  return Math.max(fs * 1.1, ring + 4 + numeral * 0.62);
}

const TRACKS = RINGS.map((ring) =>
  Array.from({ length: 12 }, (_, i) =>
    arc(R[ring], i * 30 + GAP[ring], (i + 1) * 30 - GAP[ring]),
  ).join(""),
).join("");
const SPOKES = [-15, 15].map((a) => line(SLAB.rMid, SLAB.rOut, a));
const HIGHLIGHT = arc(SLAB.rOut - 1, -40, -14);

function cellLabel(col: Column, ring: Ring): string {
  return chordLabel(col.cells[ring]);
}

function Labels({
  cols,
  states,
  z,
}: {
  cols: Column[];
  states: Partial<Record<string, CellState>>;
  z: Sizes;
}) {
  const out: ReactNode[] = [];
  for (const ring of RINGS)
    for (const col of cols) {
      const st = states[cellId(ring, col.index)] ?? {};
      const [x, y] = point(R[ring], col.index * 30);
      const fs = z[ring];
      const off = numeralOffset(st, fs, z.numeral, z.compact);
      const inside = Boolean(st.p ?? st.c) && !st.outOfKey;
      const cell = sector(
        BAND[ring][0] + 3,
        Math.min(BAND[ring][1], SLAB.rOut) - 3,
        col.index * 30 - 13.5,
        col.index * 30 + 13.5,
      );
      out.push(
        <g
          key={cellId(ring, col.index)}
          className={`label ${inside ? "in" : "out"}`}
        >
          {st.tonic &&
            (z.compact ? (
              <path className="tonic-halo" filter="url(#halo)" d={cell} />
            ) : (
              <circle
                className="tonic-halo"
                filter="url(#halo)"
                cx={fmt(x)}
                cy={fmt(y)}
                r={fmt(fs * 0.9)}
              />
            ))}
          {st.focus &&
            (z.compact ? (
              <path className="focus-halo" filter="url(#halo)" d={cell} />
            ) : (
              <circle
                className="focus-halo"
                filter="url(#halo)"
                cx={fmt(x)}
                cy={fmt(y)}
                r={fmt(fs * 1.05)}
              />
            ))}
          {st.changed && <path className="changed-mark" d={cell} />}
          <text className="name" x={fmt(x)} y={fmt(y)} fontSize={fmt(fs)}>
            <SvgSpelled text={cellLabel(col, ring)} />
          </text>
          {st.p && (
            <text
              className="numeral"
              x={fmt(x)}
              y={fmt(y - off)}
              fontSize={fmt(z.numeral)}
            >
              <SvgSpelled text={st.p} />
            </text>
          )}
          {st.c && !z.compact && (
            <text
              className="numeral c"
              x={fmt(x)}
              y={fmt(y + off)}
              fontSize={fmt(z.numeral)}
            >
              <SvgSpelled text={st.c} />
            </text>
          )}
        </g>,
      );
    }
  return (
    <>
      <path className="track" d={TRACKS} />
      {out}
    </>
  );
}

/** Turns a window's angle the short way round to a new target (a tritone turns clockwise). */
function useWindowTurn(
  value: MotionValue<number>,
  target: number,
  reduce: boolean,
) {
  useEffect(() => {
    const from = value.get();
    const to = from + turn(((from % 360) + 360) % 360, target);
    if (to === from) return;
    const controls = animate(value, to, {
      duration: reduce ? 0 : TURN_SECONDS,
      ease: EASE,
    });
    return () => {
      controls.stop();
    };
  }, [value, target, reduce]);
}

export function CircleOfFifths() {
  const selection = useAppStore((s) => s.selection);
  const columnSpellings = useAppStore((s) => s.columnSpellings);
  const armed = useAppStore((s) => s.compareArmed);
  const setPrimary = useAppStore((s) => s.setPrimary);
  const setCompare = useAppStore((s) => s.setCompare);
  const toggleColumnSpelling = useAppStore((s) => s.toggleColumnSpelling);
  const reduce = useReducedMotion() ?? false;

  const svgRef = useRef<SVGSVGElement>(null);
  const width = useElementWidth(svgRef, 820);
  const z = sizes(width);
  const cols = useMemo(
    () => columns(selection, columnSpellings),
    [selection, columnSpellings],
  );
  const states = useMemo(() => cellStates(selection, cols), [selection, cols]);
  const ring = useMemo(() => noteRing(selection), [selection]);
  const arcs = noteArcs(ring, Boolean(selection.compare));
  const hasCompare = Boolean(selection.compare);

  // The two windows turn with Motion; their transforms are written straight to the DOM.
  const primaryAngle = windowAngle(selection.primary);
  const compareAngle = selection.compare
    ? windowAngle(selection.compare)
    : primaryAngle;
  const aP = useMotionValue(primaryAngle);
  const aC = useMotionValue(compareAngle);
  const hadCompare = useRef(hasCompare);
  const rotating = useRef<(SVGElement | null)[]>([]);
  const compareRef = useRef<SVGGElement>(null);
  const refracted = useRef<SVGGElement>(null);
  const place = () => {
    const p = aP.get();
    for (const el of rotating.current)
      el?.setAttribute(
        "transform",
        `rotate(${fmt(p)} ${String(CX)} ${String(CY)})`,
      );
    compareRef.current?.setAttribute(
      "transform",
      `rotate(${fmt(aC.get())} ${String(CX)} ${String(CY)})`,
    );
    // Labels under the glass are enlarged about the window's centre, as if refracted.
    const [mx, my] = point(285, p);
    refracted.current?.setAttribute(
      "transform",
      `translate(${fmt(mx)} ${fmt(my)}) scale(1.06) translate(${fmt(-mx)} ${fmt(-my)})`,
    );
  };
  useLayoutEffect(place);
  useEffect(() => {
    const offP = aP.on("change", place);
    const offC = aC.on("change", place);
    return () => {
      offP();
      offC();
    };
  });
  useWindowTurn(aP, primaryAngle, reduce);
  // A new compare appears in place; changing it turns its window.
  useLayoutEffect(() => {
    if (hasCompare && !hadCompare.current) aC.jump(compareAngle);
    hadCompare.current = hasCompare;
  }, [hasCompare, compareAngle, aC]);
  useWindowTurn(aC, compareAngle, reduce);

  // Plain click: primary. Shift-click, an armed Compare control or a long press: compare.
  const longPress = useRef<{ timer: number; fired: boolean }>({
    timer: 0,
    fired: false,
  });
  const choose = (target: Target, asCompare: boolean) => {
    if (asCompare || armed) setCompare(target);
    else setPrimary(target);
  };
  const cellHandlers = (target: Target) => ({
    onMouseDown: (e: React.MouseEvent) => {
      if (e.shiftKey) e.preventDefault();
    },
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") return;
      longPress.current.fired = false;
      longPress.current.timer = window.setTimeout(() => {
        longPress.current.fired = true;
        setCompare(target);
      }, 500);
    },
    onPointerUp: () => {
      window.clearTimeout(longPress.current.timer);
    },
    onPointerLeave: () => {
      window.clearTimeout(longPress.current.timer);
    },
    onClick: (e: React.MouseEvent) => {
      if (longPress.current.fired) {
        longPress.current.fired = false;
        return;
      }
      choose(target, e.shiftKey);
    },
  });

  const labels = <Labels cols={cols} states={states} z={z} />;
  const primary = selection.primary;

  return (
    <svg
      ref={svgRef}
      className={`circle${armed ? " arming" : ""}`}
      data-measure="circle"
      viewBox="-10 -10 980 980"
      role="group"
      aria-label={`Circle of fifths, showing ${spokenName(targetName(primary))}`}
    >
      <defs>
        <radialGradient
          id="smoke"
          cx={CX}
          cy={CY}
          r={DISC_R}
          gradientUnits="userSpaceOnUse"
        >
          <stop
            offset="0"
            stopColor="oklch(0.12 0.006 25)"
            stopOpacity="0.34"
          />
          <stop
            offset="0.8"
            stopColor="oklch(0.1 0.005 25)"
            stopOpacity="0.44"
          />
          <stop
            offset="1"
            stopColor="oklch(0.08 0.005 25)"
            stopOpacity="0.58"
          />
        </radialGradient>
        <linearGradient id="discRim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.05" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="0.75" stopColor="#b3302a" stopOpacity="0.15" />
          <stop offset="1" stopColor="#d0473a" stopOpacity="0.6" />
        </linearGradient>
        <clipPath id="lensClip">
          <path
            ref={(el) => {
              rotating.current[0] = el;
            }}
            d={WINDOW}
          />
        </clipPath>
        <mask
          id="outsideLens"
          maskUnits="userSpaceOnUse"
          x="-50"
          y="-50"
          width="1080"
          height="1080"
        >
          <rect x="-50" y="-50" width="1080" height="1080" fill="#fff" />
          <path
            ref={(el) => {
              rotating.current[1] = el;
            }}
            d={WINDOW}
            fill="#000"
          />
        </mask>
        <radialGradient
          id="glassFill"
          gradientUnits="userSpaceOnUse"
          cx={CX}
          cy={CY}
          r="400"
        >
          <stop offset="0.3" stopColor="#fff" stopOpacity="0.012" />
          <stop offset="0.85" stopColor="#fff" stopOpacity="0.035" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.06" />
        </radialGradient>
        <linearGradient id="rimGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="0.8" stopColor="#b3302a" stopOpacity="0.75" />
          <stop offset="1" stopColor="#d0473a" stopOpacity="0.95" />
        </linearGradient>
        <filter id="slabShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="12"
            stdDeviation="12"
            floodColor="#000"
            floodOpacity="0.45"
          />
        </filter>
        <filter id="halo" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx={CX} cy={CY} r={DISC_R} fill="url(#smoke)" />
      <circle
        cx={CX}
        cy={CY}
        r={DISC_R}
        fill="none"
        stroke="url(#discRim)"
        strokeWidth="1.2"
      />

      {/* Note ring: the 12 pitch classes; the key's notes are joined by a lit arc. */}
      <g aria-label="Notes of the key on the circle">
        <circle className="note-track" cx={CX} cy={CY} r={NOTE_R} />
        {arcs.map((a) => (
          <path
            key={`${String(a.from)}-${String(a.dashed)}`}
            className={`note-arc${a.dashed ? " dashed" : ""}`}
            d={arc(NOTE_R, a.from * 30, a.from * 30 + 30)}
          />
        ))}
        {ring.map((n) => {
          const [x, y] = point(NOTE_R, n.position * 30);
          const pad = 16;
          return (
            <foreignObject
              key={n.position}
              x={fmt(x - z.note / 2 - pad)}
              y={fmt(y - z.note / 2 - pad)}
              width={fmt(z.note + 2 * pad)}
              height={fmt(z.note + 2 * pad)}
            >
              <div
                className="ring-note"
                style={{ ["--ring-d" as string]: `${fmt(z.note)}px` }}
              >
                <HaloNote
                  name={n.name}
                  membership={n.membership}
                  role={n.role}
                  hasCompare={hasCompare}
                  core
                />
              </div>
            </foreignObject>
          );
        })}
      </g>

      <circle className="hub-line" cx={CX} cy={CY} r="104" />
      <g
        ref={compareRef}
        className="compare-slab"
        style={{ opacity: hasCompare ? 1 : 0 }}
      >
        <path className="fill" d={WINDOW} />
        <path className="edge" d={WINDOW} />
      </g>
      <path
        ref={(el) => {
          rotating.current[2] = el;
        }}
        className="lens-body"
        d={WINDOW}
        filter="url(#slabShadow)"
      />
      <g mask="url(#outsideLens)">{labels}</g>
      <g clipPath="url(#lensClip)">
        <g ref={refracted}>{labels}</g>
      </g>
      <g
        ref={(el) => {
          rotating.current[3] = el;
        }}
      >
        {SPOKES.map((s, i) => (
          <line key={i} className="lens-spoke" {...s} />
        ))}
        <path className="lens-edge" d={WINDOW} />
        <path className="lens-spec" d={HIGHLIGHT} />
      </g>

      <text
        className="hub-key"
        x={CX}
        y={fmt(CY - z.hub * 0.12)}
        fontSize={fmt(z.hub)}
      >
        <SvgSpelled text={primary.tonic} />
      </text>
      <text
        className="hub-kind"
        x={CX}
        y={fmt(CY + z.hub * 0.56)}
        fontSize={fmt(z.kind)}
      >
        {primary.kind.replace("-", " ")}
      </text>

      {/* Hit areas: a click always selects a key (§5.1). */}
      {RINGS.map((ringName) =>
        cols.map((col) => {
          const target = keyForCell(ringName, col);
          return (
            <path
              key={cellId(ringName, col.index)}
              className="hit"
              role="button"
              aria-label={
                ringName === "inner"
                  ? `${spokenName(cellLabel(col, "inner").replace("°", " diminished"))}, selects ${spokenName(targetName(target))}`
                  : spokenName(targetName(target))
              }
              d={sector(
                BAND[ringName][0],
                BAND[ringName][1],
                col.index * 30 - 15,
                col.index * 30 + 15,
              )}
              {...cellHandlers(target)}
            />
          );
        }),
      )}

      {/* Enharmonic toggles on the three bottom columns (§5.1). */}
      {TOGGLE_COLUMNS.map((i) => {
        const col = cols[i];
        if (!col?.alternate) return null;
        const [x, y] = point(403, i * 30);
        const r = 11;
        return (
          <g
            key={i}
            className="toggle"
            role="button"
            tabIndex={0}
            aria-label={`Spell as ${spokenName(col.alternate)}`}
            onClick={() => {
              toggleColumnSpelling(i);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleColumnSpelling(i);
              }
            }}
          >
            <title>{`Spell as ${col.alternate}`}</title>
            <circle
              className="toggle-hit"
              cx={fmt(x)}
              cy={fmt(y)}
              r={fmt(Math.max(r, 16 / z.scale))}
            />
            <circle cx={fmt(x)} cy={fmt(y)} r={r} />
            <path
              d={`M${fmt(x - 5)} ${fmt(y - 2)}h9m-2.5-2.5 2.5 2.5-2.5 2.5M${fmt(x + 5)} ${fmt(y + 2.5)}h-9m2.5-2.5-2.5 2.5 2.5 2.5`}
            />
          </g>
        );
      })}
    </svg>
  );
}

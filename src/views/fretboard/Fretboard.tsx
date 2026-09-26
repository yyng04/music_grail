import { useLayoutEffect, useMemo, useRef } from "react";
import { HaloNote } from "../../components/HaloNote.tsx";
import { spokenName, targetName } from "../../components/spelling.ts";
import { useElementWidth } from "../../hooks/useElementWidth.ts";
import { useMediaQuery } from "../../hooks/useMediaQuery.ts";
import {
  fretboardNotes,
  halfStepLinks,
  type FretNote,
} from "../../relations/index.ts";
import { useAppStore } from "../../state/index.ts";
import { midi, octave, tuning } from "../../theory/index.ts";
import { FretboardBar } from "./FretboardBar.tsx";
import { ShapeBoard } from "./ShapeBoard.tsx";
import { useShapes } from "./shapeModel.ts";
import { ShapeStrip } from "./ShapeStrip.tsx";
import { ShowList } from "./ShowList.tsx";
import {
  boardGeometry,
  DOUBLE_INLAYS,
  INLAYS,
  NUMBERED,
  OVERHANG,
  stringWidth,
} from "./geometry.ts";

const ROLE_WORD: Partial<Record<FretNote["role"], string>> = {
  root: "root",
  third: "3rd",
  fifth: "5th",
  seventh: "7th",
};
const fmt = (n: number) => Number(n.toFixed(2));

function describe(n: FretNote, stringCount: number): string {
  const role = ROLE_WORD[n.role];
  const where =
    n.membership === "compare"
      ? "only in the compare key"
      : n.membership === "none"
        ? "outside the key"
        : "";
  return [
    `${spokenName(n.name)} ${String(octave(n.pitch) ?? "")}`,
    role,
    `string ${String(stringCount - n.string)}`,
    n.fret === 0 ? "open" : `fret ${String(n.fret)}`,
    where,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * The fretboard (§5.2): smoked glass with frets in real proportion, and every
 * note of the key (or keys, with a compare) as a halo note coloured by role.
 */
export function Fretboard() {
  const selection = useAppStore((s) => s.selection);
  const settings = useAppStore((s) => s.fretboard);
  const compact = useMediaQuery("(max-width: 760px)");
  const upright = useMediaQuery("(max-width: 600px)");
  const scroller = useRef<HTMLDivElement>(null);
  const visible = useElementWidth(scroller, upright ? 358 : 1344);

  const strings = tuning(settings.instrument, settings.tuning).strings;
  const count = strings.length;
  const g = boardGeometry({
    viewWidth: visible,
    strings: count,
    frets: settings.frets,
    compact,
    upright,
    leftHanded: settings.leftHanded,
  });
  // Lying down, the diagram view puts the highest string at the top and the
  // player's view the lowest. Upright reads like a chord diagram: lowest
  // string on the left, mirrored for the left hand.
  const place = (string: number) =>
    upright
      ? settings.leftHanded
        ? count - 1 - string
        : string
      : settings.lowOnTop
        ? string
        : count - 1 - string;
  const across = (string: number) => g.row(place(string));

  const notes = useMemo(
    () => fretboardNotes(selection, strings, settings.frets),
    [selection, strings, settings.frets],
  );
  const links = useMemo(
    () => halfStepLinks(selection, strings, settings.frets),
    [selection, strings, settings.frets],
  );
  const hasCompare = Boolean(selection.compare);
  const shapes = useShapes();
  const setShapes = useAppStore((s) => s.setShapes);
  const { built } = shapes;
  // Shape modes and positions draw on the shape board; the plain scale keeps this one.
  const shapeView = shapes.st.mode !== "scale" || shapes.st.position !== null;
  const names = built.positions.map((p) => p.name);
  const at0 = shapes.st.position ? names.indexOf(shapes.st.position) : -1;

  // A left-handed board lying down starts scrolled to its nut, on the right.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el)
      el.scrollLeft = settings.leftHanded && !upright ? el.scrollWidth : 0;
  }, [settings.leftHanded, upright]);

  const pt = (along: number, acrossAt: number) =>
    g.xy(along, acrossAt).map(fmt).join(" ");
  const line = (a0: number, c0: number, a1: number, c1: number) => {
    const [x1, y1] = g.xy(a0, c0);
    const [x2, y2] = g.xy(a1, c1);
    return { x1: fmt(x1), y1: fmt(y1), x2: fmt(x2), y2: fmt(y2) };
  };
  const neckStart = Math.min(g.fret(0), g.fret(settings.frets));
  const neckEnd = Math.max(g.fret(0), g.fret(settings.frets));
  const edgeIn = g.firstRow - OVERHANG;
  const edgeOut = g.lastRow + OVERHANG;
  const [glassX, glassY] = g.xy(neckStart, edgeIn);
  const [glassX2, glassY2] = g.xy(neckEnd, edgeOut);
  const middle = (g.firstRow + g.lastRow) / 2;
  const at = (along: number, acrossAt: number) => {
    const [left, top] = g.xy(along, acrossAt);
    return { left: fmt(left), top: fmt(top) };
  };
  // The lit rim runs along the neck, bright at the nut end.
  const rimFlip = settings.leftHanded && !upright;

  return (
    <div className={`fretboard${upright ? " upright" : ""}`}>
      <FretboardBar upright={upright} />
      {upright && <ShowList built={built} />}
      <ShapeStrip
        built={built}
        strings={count}
        frets={settings.frets}
        scaleDots={shapes.scaleDots}
      />
      {shapeView && (
        <ShapeBoard
          strings={strings}
          frets={settings.frets}
          layer={built.layer}
          position={built.position}
          positions={built.positions}
          leftHanded={settings.leftHanded}
          lowOnTop={settings.lowOnTop}
          label={settings.label}
          onStep={(step) => {
            setShapes({
              position: names[at0 + step] ?? shapes.st.position,
              shape: 0,
            });
          }}
        />
      )}
      <div className="board-scroll" ref={scroller} hidden={shapeView}>
        <div
          className="board"
          role="group"
          aria-label={`Fretboard showing ${spokenName(targetName(selection.primary))}`}
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
            </defs>
            <rect
              className="board-glass"
              x={fmt(glassX)}
              y={fmt(glassY)}
              width={fmt(glassX2 - glassX)}
              height={fmt(glassY2 - glassY)}
            />
            <path
              className="board-edge"
              d={`M${pt(neckStart, edgeIn)}L${pt(neckEnd, edgeIn)}`}
            />
            {Array.from({ length: settings.frets }, (_, i) => i + 1).map(
              (n) => (
                <line
                  key={n}
                  className={`fret${n % 12 === 0 ? " octave" : ""}`}
                  {...line(g.fret(n), edgeIn, g.fret(n), edgeOut)}
                />
              ),
            )}
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
            {/* A half-step link joins a changed note to the note that replaces it. */}
            {links.map((l) => {
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
          </svg>

          {INLAYS.filter((n) => n <= settings.frets).flatMap((n) =>
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
          {NUMBERED.filter((n) => n <= settings.frets).map((n) => (
            <span
              key={n}
              className="fret-number"
              aria-hidden="true"
              style={at(g.dot(n), g.numberRow)}
            >
              {n}
            </span>
          ))}

          {notes.map((n) => {
            const shown = n.membership !== "none" || settings.showOutside;
            const label =
              settings.label === "note"
                ? n.name
                : settings.label === "none"
                  ? ""
                  : settings.label === "interval" && n.interval === "P1"
                    ? "R"
                    : n[settings.label];
            return (
              <span
                key={`${String(n.string)}-${String(n.fret)}`}
                className={`fret-dot${shown ? "" : " hidden"}${settings.label === "none" ? " bare" : ""}`}
                role={shown ? "img" : undefined}
                aria-label={shown ? describe(n, count) : undefined}
                aria-hidden={shown ? undefined : true}
                style={{
                  ...at(g.dot(n.fret), across(n.string)),
                  ["--dot-d" as string]: `${String(fmt(g.dotSize(n.fret)))}px`,
                }}
              >
                <HaloNote
                  name={n.name}
                  membership={n.membership}
                  role={n.role}
                  hasCompare={hasCompare}
                  label={label}
                  core
                  small
                />
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

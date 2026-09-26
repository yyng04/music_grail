import {
  chordInfo,
  chroma,
  keySignature,
  majorKeyTonics,
  parentMajorTonic,
  relativeMinor,
  type Selection,
  type Target,
} from "../theory/index.ts";
import { degreeOf, roleOf, type Role } from "./degrees.ts";
import { diatonicChords } from "./diatonic.ts";
import { membership, spellIn, type Membership } from "./membership.ts";

/**
 * The circle of fifths as data (§5.1): 12 columns, C at the top, clockwise by
 * ascending fifths. Each column holds a major key (outer ring), its relative
 * minor (middle ring) and its vii° chord (inner ring).
 */

export type Ring = "outer" | "middle" | "inner";
export type CellId = `${Ring}-${number}`;
export const cellId = (ring: Ring, index: number) =>
  `${ring}-${String(index)}` as CellId;
export const RINGS: readonly Ring[] = ["outer", "middle", "inner"];
/** Columns whose major key has two standard spellings: B/Cb, F#/Gb, Db/C#. */
export const TOGGLE_COLUMNS = [5, 6, 7] as const;

export type Column = {
  index: number;
  /** Major key tonic as currently spelled, e.g. "F#" or "Gb". */
  major: string;
  /** The other standard spelling of this column, if there is one. */
  alternate?: string;
  /** Chord symbols of the three cells, e.g. "D", "Bm", "C#dim". */
  cells: Record<Ring, string>;
};

/** Pitch class of column i: C = 0, then up a fifth (7 semitones) per step. */
const columnChroma = (i: number) => (i * 7) % 12;

/** Standard spellings for each column, the default (fewer accidentals, sharps on a tie) first. */
function spellingsFor(i: number): string[] {
  const options = majorKeyTonics().filter((t) => chroma(t) === columnChroma(i));
  const cost = (t: string) => keySignature({ tonic: t, kind: "major" });
  return options.sort(
    (a, b) =>
      cost(a).count - cost(b).count || (cost(a).accidental === "#" ? -1 : 1),
  );
}

/** Column index of a key's window: its parent major key's column. */
export function columnOf(target: Pick<Target, "tonic" | "kind">): number {
  const c = chroma(parentMajorTonic(target));
  return (
    Array.from({ length: 12 }, (_, i) => i).find(
      (i) => columnChroma(i) === c,
    ) ?? 0
  );
}

export type ColumnSpellings = Partial<Record<number, string>>;

/**
 * The 12 columns as spelled for this selection. A column that holds the
 * primary (or else the compare) key uses that key's spelling, so there is only
 * one spelling on screen; other columns use the owner's toggle choice or the
 * default.
 */
export function columns(
  selection: Selection,
  chosen: ColumnSpellings = {},
): Column[] {
  const inUse = new Map<number, string>();
  for (const t of [selection.compare, selection.primary])
    if (t) inUse.set(columnOf(t), parentMajorTonic(t));
  return Array.from({ length: 12 }, (_, index) => {
    const options = spellingsFor(index);
    const preferred = inUse.get(index) ?? chosen[index];
    const major = options.find((o) => o === preferred) ?? options[0] ?? "C";
    const triads = diatonicChords(
      { tonic: major, kind: "major" },
      { sevenths: false },
    );
    return {
      index,
      major,
      alternate: options.find((o) => o !== major),
      cells: {
        outer: major,
        middle: triads[5]?.symbol ?? "",
        inner: triads[6]?.symbol ?? "",
      },
    };
  });
}

/**
 * The cell that holds a triad, matched by root pitch and chord type, so a
 * compare key spelled the other way (Db against C#) still finds its cells.
 */
export function cellOf(symbol: string, cols: Column[]): CellId | undefined {
  const want = chordInfo(symbol);
  if (!want) return undefined;
  for (const col of cols)
    for (const ring of RINGS) {
      const have = chordInfo(col.cells[ring]);
      if (
        have &&
        have.suffix === want.suffix &&
        chroma(have.root) === chroma(want.root)
      )
        return cellId(ring, col.index);
    }
  return undefined;
}

export type CellState = {
  /** Numeral in the primary window, in the compare window. */
  p?: string;
  c?: string;
  tonic?: boolean;
  focus?: boolean;
  /** Harmonic minor: a chord that differs from the natural minor (dashed marker). */
  changed?: boolean;
  /** In the primary window's glass but not a chord of the key (harmonic minor). */
  outOfKey?: boolean;
};

type WindowCell = { cell: CellId; numeral?: string; changed?: boolean };

/**
 * The cells a target lights (§5.1). Harmonic minor uses its natural minor's
 * window; cells there that are not harmonic-minor chords lose their numeral,
 * and the chords that change (V, vii°) are lit in their own cells.
 */
function windowCells(target: Target, cols: Column[]): WindowCell[] {
  const triads = diatonicChords(target, { sevenths: false });
  if (target.kind !== "harmonic-minor")
    return triads.flatMap((t) => {
      const cell = cellOf(t.symbol, cols);
      return cell ? [{ cell, numeral: t.numeral }] : [];
    });
  const natural = diatonicChords(
    { tonic: target.tonic, kind: "minor" },
    { sevenths: false },
  );
  const numeralOf = new Map(triads.map((t) => [t.symbol, t.numeral]));
  const inWindow = natural.flatMap((t) => {
    const cell = cellOf(t.symbol, cols);
    return cell ? [{ cell, numeral: numeralOf.get(t.symbol) }] : [];
  });
  const naturalSymbols = new Set(natural.map((t) => t.symbol));
  const changed = triads.flatMap((t) => {
    const cell = naturalSymbols.has(t.symbol)
      ? undefined
      : cellOf(t.symbol, cols);
    return cell ? [{ cell, numeral: t.numeral, changed: true }] : [];
  });
  return [...inWindow, ...changed];
}

/** The triad cell a focus chord highlights: same root and degree (Gm7 in Bb → the Gm cell). */
export function focusCell(target: Target, cols: Column[]): CellId | undefined {
  if (!target.chord) return undefined;
  const info = chordInfo(target.chord);
  if (!info) return undefined;
  const triads = diatonicChords(target, { sevenths: false });
  const sevenths = diatonicChords(target, { sevenths: true });
  const i =
    [...sevenths, ...triads].findIndex((c) => c.symbol === info.symbol) % 7;
  const triad = i >= 0 ? triads[i] : undefined;
  return triad ? cellOf(triad.symbol, cols) : undefined;
}

export function cellStates(
  selection: Selection,
  cols: Column[],
): Partial<Record<CellId, CellState>> {
  const out: Partial<Record<CellId, CellState>> = {};
  const at = (cell: CellId) => (out[cell] ??= {});
  const { primary, compare } = selection;
  for (const w of windowCells(primary, cols)) {
    const s = at(w.cell);
    if (w.numeral) s.p = w.numeral;
    else s.outOfKey = true;
    if (w.changed) s.changed = true;
  }
  if (compare)
    for (const w of windowCells(compare, cols))
      if (w.numeral) at(w.cell).c = w.numeral;
  const tonic = cellOf(
    diatonicChords(primary, { sevenths: false })[0]?.symbol ?? "",
    cols,
  );
  if (tonic) at(tonic).tonic = true;
  const focus = focusCell(primary, cols);
  if (focus) at(focus).focus = true;
  return out;
}

/** Angle of a target's window: 30° per column clockwise from C at the top. */
export function windowAngle(target: Pick<Target, "tonic" | "kind">): number {
  return columnOf(target) * 30;
}

/** Signed rotation the short way round; a tritone (180°) turns clockwise. */
export function turn(from: number, to: number): number {
  const d = (((to - from) % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
}

/** The key a click selects (§5.1): outer → major, middle → minor, inner → the column's major. */
export function keyForCell(ring: Ring, col: Column): Target {
  if (ring === "middle") return relativeMinor(col.major);
  return { tonic: col.major, kind: "major" };
}

/** Arrow keys: the next column clockwise (+1) or anticlockwise (-1), keeping the kind. */
export function stepKey(target: Target, step: 1 | -1, cols: Column[]): Target {
  const col = cols[(columnOf(target) + step + 12) % 12];
  if (!col) return target;
  if (target.kind === "major") return { tonic: col.major, kind: "major" };
  if (target.kind === "minor" || target.kind === "harmonic-minor")
    return { tonic: relativeMinor(col.major).tonic, kind: target.kind };
  // A mode keeps its degree in the new parent key.
  const from = diatonicChords(
    { tonic: cols[columnOf(target)]?.major ?? "C", kind: "major" },
    { sevenths: false },
  );
  const degree = from.findIndex((c) => c.root === target.tonic);
  const to = diatonicChords(
    { tonic: col.major, kind: "major" },
    { sevenths: false },
  )[Math.max(degree, 0)];
  return { tonic: to?.root ?? col.major, kind: target.kind };
}

export type RingNote = {
  position: number;
  /** The key's own spelling when lit, the column's standard spelling otherwise. */
  name: string;
  membership: Membership;
  role: Role;
  degree?: string;
};

/**
 * The note ring (§5.1): the 12 pitch classes in fifths order. Lit notes use the
 * key's spelling (the compare key's for compare-only notes); unlit positions
 * use the standard spelling of the position.
 */
export function noteRing(selection: Selection): RingNote[] {
  const standard = Array.from(
    { length: 12 },
    (_, i) => spellingsFor(i)[0] ?? "C",
  );
  return standard.map((pos, position) => {
    const m = membership(pos, selection);
    const name =
      m === "none"
        ? pos
        : m === "compare" && selection.compare
          ? (spellIn(pos, selection.compare) ?? pos)
          : (spellIn(pos, selection.primary) ?? pos);
    return {
      position,
      name,
      membership: m,
      role:
        m === "compare" || m === "none"
          ? "outside"
          : roleOf(name, selection.primary),
      degree: m === "none" ? undefined : degreeOf(name, selection.primary),
    };
  });
}

/** Arc segments joining neighbouring positions of the same key (primary solid, compare dashed). */
export function noteArcs(
  ring: RingNote[],
  hasCompare: boolean,
): { from: number; dashed: boolean }[] {
  const inP = (n?: RingNote) =>
    n?.membership === "both" || n?.membership === "primary";
  const inC = (n?: RingNote) =>
    n?.membership === "both" || n?.membership === "compare";
  const arcs: { from: number; dashed: boolean }[] = [];
  for (let i = 0; i < 12; i++) {
    const a = ring[i],
      b = ring[(i + 1) % 12];
    if (inP(a) && inP(b)) arcs.push({ from: i, dashed: false });
    else if (hasCompare && inC(a) && inC(b))
      arcs.push({ from: i, dashed: true });
  }
  return arcs;
}

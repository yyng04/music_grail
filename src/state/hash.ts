import {
  chordInfo,
  normaliseKind,
  type Selection,
  type Target,
} from "../theory/index.ts";
import type { ShapeRole } from "../relations/index.ts";
import { DEFAULT_SHAPES, HARMONIES, type ShapeState } from "./fretboard.ts";
import {
  checkSelection,
  DEFAULT_SELECTION,
  type Checked,
} from "./selection.ts";

// In the hash, "#" is written "s", "##" is "x" and flats stay "b".
const ACCIDENTAL_TO_URL: Record<string, string> = {
  "": "",
  "#": "s",
  "##": "x",
  b: "b",
  bb: "bb",
};
const URL_TO_ACCIDENTAL: Record<string, string> = {
  "": "",
  s: "#",
  x: "##",
  b: "b",
  bb: "bb",
};

/** Written in the hash for a major triad, whose canonical suffix is empty. */
const MAJOR_TRIAD = "maj";

export function encodeNote(note: string): string {
  const match = /^([A-G])(.*)$/.exec(note);
  const url = match ? ACCIDENTAL_TO_URL[match[2] ?? ""] : undefined;
  if (!match || url === undefined)
    throw new Error(`Cannot encode note: ${note}`);
  return `${match[1] ?? ""}${url}`;
}

export function decodeNote(text: string): string | undefined {
  const match = /^([A-G])(.*)$/.exec(text);
  const accidental = match ? URL_TO_ACCIDENTAL[match[2] ?? ""] : undefined;
  return match && accidental !== undefined
    ? `${match[1] ?? ""}${accidental}`
    : undefined;
}

function split(text: string): [string, string] | undefined {
  const i = text.indexOf("-");
  return i > 0 ? [text.slice(0, i), text.slice(i + 1)] : undefined;
}

export function encodeKey(target: Pick<Target, "tonic" | "kind">): string {
  return `${encodeNote(target.tonic)}-${target.kind}`;
}

export function decodeKey(
  text: string,
): Pick<Target, "tonic" | "kind"> | undefined {
  const parts = split(text);
  const tonic = parts && decodeNote(parts[0]);
  const kind = parts && normaliseKind(parts[1]);
  return tonic && kind ? { tonic, kind } : undefined;
}

export function encodeChord(symbol: string): string {
  const info = chordInfo(symbol);
  if (!info) throw new Error(`Cannot encode chord: ${symbol}`);
  return `${encodeNote(info.root)}-${info.suffix || MAJOR_TRIAD}`;
}

/** "C-sus4" → "Csus4", "C-maj" → "C". Returns the canonical symbol. */
export function decodeChord(text: string): string | undefined {
  const parts = split(text);
  const root = parts && decodeNote(parts[0]);
  if (!parts || !root || !parts[1]) return undefined;
  return chordInfo(`${root}${parts[1]}`)?.symbol;
}

/** Views other than the circle (the default) are named in the hash, so a link opens the same view. */
const VIEWS = ["circle", "fretboard"] as const;
export type HashView = (typeof VIEWS)[number];

export function formatHash(
  selection: Selection,
  view: HashView = "circle",
  shapes?: ShapeState,
): string {
  const { primary, compare } = selection;
  const params: [string, string][] = [["p", encodeKey(primary)]];
  if (primary.chord) params.push(["pchord", encodeChord(primary.chord)]);
  if (compare) params.push(["c", encodeKey(compare)]);
  if (compare?.chord) params.push(["cchord", encodeChord(compare.chord)]);
  if (view !== "circle") params.push(["view", view]);
  if (view === "fretboard" && shapes) params.push(...shapeParams(shapes));
  return params.map(([k, v]) => `${k}=${v}`).join("&");
}

// The fretboard's Show state. Defaults are left out, so a plain scale
// view keeps a short link: show, pos, strings, shape, pair, in, next.
const ROLE_NUMBER: Record<ShapeRole, string> = {
  root: "1",
  third: "3",
  fifth: "5",
  seventh: "7",
  other: "",
};
const NUMBER_ROLE: Record<string, ShapeRole> = {
  "1": "root",
  "3": "third",
  "5": "fifth",
  "7": "seventh",
};

function shapeParams(st: ShapeState): [string, string][] {
  const show = st.mode === "two" ? st.two : st.mode;
  const out: [string, string][] = [];
  if (show !== "scale") out.push(["show", show]);
  if (st.position) out.push(["pos", st.position]);
  if (show !== "scale" && st.strings) out.push(["strings", st.strings]);
  if (show !== "scale" && st.shape > 0)
    out.push(["shape", String(st.shape + 1)]);
  const pair = st.pair.map((r) => ROLE_NUMBER[r]).join("-");
  if (show === "pairs" && pair !== "3-7") out.push(["pair", pair]);
  if (show === "harmony" && st.harmony !== "3rds") out.push(["in", st.harmony]);
  if (show === "guide" && st.next) out.push(["next", encodeChord(st.next)]);
  return out;
}

/** The Show state named in a hash; anything missing or unreadable takes its default. */
export function parseShapes(hash: string): ShapeState {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const st: ShapeState = { ...DEFAULT_SHAPES, next: undefined };
  const show = q.get("show");
  if (show === "triads" || show === "guide") st.mode = show;
  if (show === "pairs" || show === "harmony") {
    st.mode = "two";
    st.two = show;
  }
  const pos = q.get("pos");
  if (pos && /^[CAGED]$/.test(pos)) st.position = pos;
  const strings = q.get("strings");
  if (strings && /^\d{2,3}$/.test(strings)) st.strings = strings;
  const shape = Number(q.get("shape"));
  if (Number.isInteger(shape) && shape >= 1) st.shape = shape - 1;
  const [a, b] = (q.get("pair") ?? "").split("-").map((n) => NUMBER_ROLE[n]);
  if (a && b && a !== b) st.pair = [a, b];
  const harmony = HARMONIES.find((h) => h === q.get("in"));
  if (harmony) st.harmony = harmony;
  const next = q.get("next");
  if (next) st.next = decodeChord(next);
  return st;
}

/** The view named in a hash; the circle when it names none or an unknown one. */
export function parseView(hash: string): HashView {
  const name = new URLSearchParams(hash.replace(/^#/, "")).get("view");
  return VIEWS.find((v) => v === name) ?? "circle";
}

/** Parses a hash (with or without "#"). Anything invalid is dropped with a warning. */
export function parseHash(hash: string): Checked<Selection> {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const warnings: string[] = [];

  const readTarget = (
    keyParam: string,
    chordParam: string,
  ): Target | undefined => {
    const keyText = params.get(keyParam);
    if (keyText === null) return undefined;
    const key = decodeKey(keyText);
    if (!key) {
      warnings.push(`Ignoring ${keyParam}=${keyText}: not a key`);
      return undefined;
    }
    const chordText = params.get(chordParam);
    if (chordText === null) return key;
    const chord = decodeChord(chordText);
    if (!chord) {
      warnings.push(`Ignoring ${chordParam}=${chordText}: not a chord`);
      return key;
    }
    return { ...key, chord };
  };

  const primary = readTarget("p", "pchord");
  const compare = readTarget("c", "cchord");
  const checked = checkSelection({
    primary: primary ?? DEFAULT_SELECTION.primary,
    ...(compare ? { compare } : {}),
  });
  return { value: checked.value, warnings: [...warnings, ...checked.warnings] };
}

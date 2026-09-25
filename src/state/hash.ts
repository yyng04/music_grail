import {
  chordInfo,
  normaliseKind,
  type Selection,
  type Target,
} from "../theory/index.ts";
import {
  checkSelection,
  DEFAULT_SELECTION,
  type Checked,
} from "./selection.ts";

// In the hash, "#" is written "s", "##" is "x" and flats stay "b" (§3).
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

export function formatHash(selection: Selection): string {
  const { primary, compare } = selection;
  const params: [string, string][] = [["p", encodeKey(primary)]];
  if (primary.chord) params.push(["pchord", encodeChord(primary.chord)]);
  if (compare) params.push(["c", encodeKey(compare)]);
  if (compare?.chord) params.push(["cchord", encodeChord(compare.chord)]);
  return params.map(([k, v]) => `${k}=${v}`).join("&");
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

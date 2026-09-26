import { Chord } from "tonal";
import { fromTonalInterval } from "./intervals.ts";

/** One suffix per chord type, so every symbol in the app has one spelling. */
const SUFFIX: Record<string, string> = {
  major: "",
  minor: "m",
  diminished: "dim",
  augmented: "aug",
  "major seventh": "maj7",
  "dominant seventh": "7",
  "minor seventh": "m7",
  "half-diminished": "m7b5",
  "diminished seventh": "dim7",
  "minor/major seventh": "mMaj7",
  "augmented seventh": "maj7#5",
};

export type ChordInfo = {
  /** Canonical symbol, e.g. "Gm7", "C", "Bdim". */
  symbol: string;
  root: string;
  /** Canonical suffix: "" for a major triad, "m7", "maj7", ... */
  suffix: string;
  notes: string[];
  /** Quality-first intervals from the root, e.g. ["P1", "m3", "P5", "m7"]. */
  intervals: string[];
};

export function chordInfo(symbol: string): ChordInfo | undefined {
  const chord = Chord.get(symbol);
  if (chord.empty || !chord.tonic) return undefined;
  const suffix = SUFFIX[chord.type] ?? chord.aliases[0] ?? "";
  const bass = chord.bass && chord.bass !== chord.tonic ? `/${chord.bass}` : "";
  return {
    symbol: `${chord.tonic}${suffix}${bass}`,
    root: chord.tonic,
    suffix,
    notes: chord.notes,
    intervals: chord.intervals.map(fromTonalInterval),
  };
}

/** Canonical form of a symbol, or undefined if Tonal does not know it. */
export function canonicalChord(symbol: string): string | undefined {
  return chordInfo(symbol)?.symbol;
}

/** Chord symbols that match these spelled notes, best first, canonical form. */
export function detectChords(notes: readonly string[]): string[] {
  return Chord.detect([...notes]).flatMap((s) => canonicalChord(s) ?? []);
}

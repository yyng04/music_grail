import {
  canonicalChord,
  chordInfo,
  detectChords,
  majorKeyChords,
  parentMajorTonic,
  scaleNotes,
  transpose,
  type Target,
} from "../theory/index.ts";

export type DiatonicChord = {
  /** 1 to 7, counted from the target's tonic. */
  degree: number;
  numeral: string;
  symbol: string;
  root: string;
  notes: string[];
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

/** Numeral case and suffix for each chord type that occurs in a major-scale mode. */
const NUMERAL: Record<string, { upper: boolean; suffix: string }> = {
  "": { upper: true, suffix: "" },
  m: { upper: false, suffix: "" },
  dim: { upper: false, suffix: "°" },
  aug: { upper: true, suffix: "+" },
  maj7: { upper: true, suffix: "maj7" },
  "7": { upper: true, suffix: "7" },
  m7: { upper: false, suffix: "7" },
  m7b5: { upper: false, suffix: "m7b5" },
  dim7: { upper: false, suffix: "°7" },
};

function numeral(degree: number, suffix: string): string {
  const roman = ROMAN[degree - 1] ?? "?";
  const style = NUMERAL[suffix] ?? { upper: true, suffix };
  return `${style.upper ? roman : roman.toLowerCase()}${style.suffix}`;
}

/**
 * The 7 diatonic chords of a target, from its tonic. Minor keys and modes take
 * the parent major key's chords, renumbered from their own tonic.
 */
export function diatonicChords(
  target: Pick<Target, "tonic" | "kind">,
  { sevenths }: { sevenths: boolean },
): DiatonicChord[] {
  const parent = parentMajorTonic(target);
  const parentChords = majorKeyChords(parent, sevenths);
  const offset = scaleNotes({ tonic: parent, kind: "major" }).indexOf(
    target.tonic,
  );
  if (offset < 0) throw new Error(`${target.tonic} is not in ${parent} major`);

  return parentChords.map((_, i) => {
    const symbol = parentChords[(i + offset) % 7] ?? "";
    const info = chordInfo(symbol);
    if (!info) throw new Error(`Unknown chord: ${symbol}`);
    return {
      degree: i + 1,
      numeral: numeral(i + 1, info.suffix),
      symbol: info.symbol,
      root: info.root,
      notes: info.notes,
    };
  });
}

/** True when the chord is one of the target's diatonic triads or 7th chords (same spelling). */
export function isDiatonic(
  chord: string,
  target: Pick<Target, "tonic" | "kind">,
): boolean {
  const symbol = canonicalChord(chord);
  if (symbol === undefined) return false;
  return [true, false].some((sevenths) =>
    diatonicChords(target, { sevenths }).some((c) => c.symbol === symbol),
  );
}

/** Spelled notes → chord symbol, e.g. ["G", "B", "D", "F"] → "G7". */
export function detectChord(notes: readonly string[]): string | undefined {
  return detectChords(notes)[0];
}

/** A dominant 7th chord → the one major key in which it is V7. */
export function keyOfDominant(chord: string): Target | undefined {
  const info = chordInfo(chord);
  if (!info || info.suffix !== "7") return undefined;
  const tonic = transpose(info.root, "P4");
  const five = diatonicChords({ tonic, kind: "major" }, { sevenths: true })[4];
  return five?.symbol === info.symbol ? { tonic, kind: "major" } : undefined;
}

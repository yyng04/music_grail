import { Key, Mode, Note, Scale } from "tonal";
import { isPitchClass } from "./notes.ts";
import { KINDS, type Kind, type Target } from "./types.ts";

/** Accepts any kind name, including "ionian" and "aeolian", and normalises it. */
export function normaliseKind(name: string): Kind | undefined {
  const lower = name.toLowerCase();
  if (lower === "ionian") return "major";
  if (lower === "aeolian") return "minor";
  if (lower === "harmonic minor") return "harmonic-minor";
  return (KINDS as readonly string[]).includes(lower)
    ? (lower as Kind)
    : undefined;
}

/** Tonal's scale name for a kind. */
function scaleName(kind: Kind): string {
  if (kind === "major") return "ionian";
  if (kind === "minor") return "aeolian";
  if (kind === "harmonic-minor") return "harmonic minor";
  return kind;
}

/** The mode whose parent major key a kind shares (harmonic minor: its natural minor's). */
function modeName(kind: Kind): string {
  return kind === "harmonic-minor" ? "aeolian" : scaleName(kind);
}

export function isValidTonic(tonic: string): boolean {
  return isPitchClass(tonic);
}

/** The 7 notes of the target, starting on its tonic. */
export function scaleNotes(target: Pick<Target, "tonic" | "kind">): string[] {
  const notes = Scale.get(`${target.tonic} ${scaleName(target.kind)}`).notes;
  if (notes.length !== 7)
    throw new Error(`Unknown key: ${target.tonic} ${target.kind}`);
  return notes;
}

/**
 * Tonic of the major key that shares the target's notes: D dorian → "C".
 * Harmonic minor takes its natural minor's relative major (A → "C").
 */
export function parentMajorTonic(
  target: Pick<Target, "tonic" | "kind">,
): string {
  if (target.kind === "major") return target.tonic;
  return Mode.relativeTonic("ionian", modeName(target.kind), target.tonic);
}

export type KeySignature = {
  count: number;
  accidental: "#" | "b" | "";
  /** "2#", "3b" or "0". */
  label: string;
};

export function keySignature(
  target: Pick<Target, "tonic" | "kind">,
): KeySignature {
  const alteration = Key.majorKey(parentMajorTonic(target)).alteration;
  const accidental = alteration > 0 ? "#" : alteration < 0 ? "b" : "";
  const count = Math.abs(alteration);
  return { count, accidental, label: `${String(count)}${accidental}` };
}

/** One of the 15 standard keys: its parent major key has at most 7 sharps or flats. */
export function isStandardKey(target: Pick<Target, "tonic" | "kind">): boolean {
  return keySignature(target).count <= 7;
}

/**
 * The same pitches spelled as a standard key: D# major → Eb major,
 * G# lydian → Ab lydian. A standard key is returned unchanged.
 */
export function standardKey<T extends Pick<Target, "tonic" | "kind">>(
  target: T,
): T {
  if (isStandardKey(target)) return target;
  const simplest = Note.simplify(target.tonic);
  for (const tonic of [simplest, Note.enharmonic(simplest)]) {
    if (isStandardKey({ tonic, kind: target.kind }))
      return { ...target, tonic };
  }
  return target;
}

export function relativeMinor(majorTonic: string): Target {
  return { tonic: Key.majorKey(majorTonic).minorRelative, kind: "minor" };
}

/** Diatonic chord symbols of a major key, in degree order. */
export function majorKeyChords(tonic: string, sevenths: boolean): string[] {
  const key = Key.majorKey(tonic);
  return [...(sevenths ? key.chords : key.triads)];
}

/** Diatonic chord symbols of a harmonic minor key, in degree order. */
export function harmonicMinorChords(
  tonic: string,
  sevenths: boolean,
): string[] {
  const key = Key.minorKey(tonic).harmonic;
  return [...(sevenths ? key.chords : key.triads)];
}

/** The 15 standard major keys: C, then 7 steps up in fifths and 7 down in fourths. */
export function majorKeyTonics(): string[] {
  const up = ["C"];
  const down: string[] = [];
  for (let i = 0; i < 7; i++) {
    up.push(Note.transpose(up[up.length - 1] ?? "C", "5P"));
    down.push(Note.transpose(down[down.length - 1] ?? "C", "4P"));
  }
  return [...up, ...down];
}

/**
 * The same key spelled the other standard way, if it has one:
 * F# major → Gb major, D# minor → Eb minor, B major → Cb major.
 * The parent major key is swapped for its enharmonic twin, and the tonic keeps
 * its position in that key's scale.
 */
export function enharmonicKey(
  target: Pick<Target, "tonic" | "kind">,
): Pick<Target, "tonic" | "kind"> | undefined {
  const parent = parentMajorTonic(target);
  const pitch = Note.get(parent).chroma;
  const twin = majorKeyTonics().find(
    (t) => t !== parent && Note.get(t).chroma === pitch,
  );
  if (!twin) return undefined;
  const degree = scaleNotes({ tonic: parent, kind: "major" }).indexOf(
    scaleNotes(target)[0] ?? "",
  );
  const tonic = scaleNotes({ tonic: twin, kind: "major" })[degree];
  return tonic ? { tonic, kind: target.kind } : undefined;
}

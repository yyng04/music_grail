import { Key, Mode, Scale } from "tonal";
import { isPitchClass } from "./notes.ts";
import { KINDS, type Kind, type Target } from "./types.ts";

/** Accepts any kind name, including "ionian" and "aeolian", and normalises it. */
export function normaliseKind(name: string): Kind | undefined {
  const lower = name.toLowerCase();
  if (lower === "ionian") return "major";
  if (lower === "aeolian") return "minor";
  return (KINDS as readonly string[]).includes(lower)
    ? (lower as Kind)
    : undefined;
}

function modeName(kind: Kind): string {
  if (kind === "major") return "ionian";
  if (kind === "minor") return "aeolian";
  return kind;
}

export function isValidTonic(tonic: string): boolean {
  return isPitchClass(tonic);
}

/** The 7 notes of the target, starting on its tonic. */
export function scaleNotes(target: Pick<Target, "tonic" | "kind">): string[] {
  const notes = Scale.get(`${target.tonic} ${modeName(target.kind)}`).notes;
  if (notes.length !== 7)
    throw new Error(`Unknown key: ${target.tonic} ${target.kind}`);
  return notes;
}

/** Tonic of the major key that shares the target's notes: D dorian → "C". */
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

export function relativeMinor(majorTonic: string): Target {
  return { tonic: Key.majorKey(majorTonic).minorRelative, kind: "minor" };
}

/** Diatonic chord symbols of a major key, in degree order. */
export function majorKeyChords(tonic: string, sevenths: boolean): string[] {
  const key = Key.majorKey(tonic);
  return [...(sevenths ? key.chords : key.triads)];
}

import { Note } from "tonal";

/** True for a spelled pitch class with no octave, e.g. "F#" but not "F#4". */
export function isPitchClass(name: string): boolean {
  const note = Note.get(name);
  return !note.empty && note.name === name && note.oct === undefined;
}

/** Pitch class of a note with or without octave: "C#4" → "C#". */
export function pitchClass(name: string): string {
  return Note.get(name).pc;
}

/** 0 to 11. Equal for enharmonic spellings. */
export function chroma(name: string): number {
  const note = Note.get(name);
  if (note.empty) throw new Error(`Not a note: ${name}`);
  return note.chroma;
}

export function samePitch(a: string, b: string): boolean {
  return chroma(a) === chroma(b);
}

export function letter(name: string): string {
  return Note.get(name).letter;
}

/** Octave number of a note with octave: "B#3" → 3. */
export function octave(name: string): number | undefined {
  return Note.get(name).oct;
}

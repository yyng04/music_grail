import { Interval, Note } from "tonal";

/**
 * Tonal writes intervals number-first ("3M"); the app writes them
 * quality-first ("M3"). Nothing outside theory/ sees Tonal's format.
 */
export function fromTonalInterval(tonal: string): string {
  const i = Interval.get(tonal);
  if (i.empty) throw new Error(`Not an interval: ${tonal}`);
  return `${i.dir < 0 ? "-" : ""}${i.q}${String(Math.abs(i.num))}`;
}

export function toTonalInterval(name: string): string {
  const match = /^(-?)(P|M|m|A+|d+)(\d+)$/.exec(name);
  const i = match
    ? Interval.get(`${match[1] ?? ""}${match[3] ?? ""}${match[2] ?? ""}`)
    : undefined;
  if (!i || i.empty) throw new Error(`Not an interval: ${name}`);
  return i.name;
}

/** The note an interval above `note`: transpose("F", "M3") → "A". */
export function transpose(note: string, interval: string): string {
  const result = Note.transpose(note, toTonalInterval(interval));
  if (!result) throw new Error(`Cannot transpose ${note} by ${interval}`);
  return result;
}

/** Ascending interval between two pitch classes: ("B", "F") → "d5". */
export function intervalBetween(from: string, to: string): string {
  return fromTonalInterval(Interval.distance(from, to));
}

/** Degree label for an interval above the tonic: "m3" → "b3", "A4" → "#4". */
export function degreeLabel(interval: string): string {
  const i = Interval.get(toTonalInterval(interval));
  const accidentals = i.alt < 0 ? "b".repeat(-i.alt) : "#".repeat(i.alt);
  return `${accidentals}${String(i.simple)}`;
}

/** Interval for a degree label: "b3" → "m3", "#4" → "A4", "5" → "P5". */
export function intervalFromDegree(degree: string): string {
  const match = /^(b*|#*)([1-7])$/.exec(degree);
  if (!match) throw new Error(`Not a degree: ${degree}`);
  const accidentals = match[1] ?? "";
  const alt = accidentals.startsWith("b")
    ? -accidentals.length
    : accidentals.length;
  const i = Interval.get({ step: Number(match[2]) - 1, alt, oct: 0, dir: 1 });
  return fromTonalInterval(i.name);
}

/** Notes of a degree formula: ("C", ["1", "b3", "5"]) → ["C", "Eb", "G"]. */
export function notesFromDegrees(
  tonic: string,
  degrees: readonly string[],
): string[] {
  return degrees.map((d) => transpose(tonic, intervalFromDegree(d)));
}

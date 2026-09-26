import {
  chordInfo,
  chroma,
  degreeLabel,
  fretPitch,
  intervalBetween,
  respell,
  type Selection,
} from "../theory/index.ts";
import { standardName } from "./circle.ts";
import { roleOf, type Role } from "./degrees.ts";
import {
  membership,
  noteDiff,
  spellIn,
  type Membership,
} from "./membership.ts";

export type FretNote = {
  /** Index into the tuning's strings, 0 = lowest. */
  string: number;
  fret: number;
  /** The exact pitch in the displayed spelling, with octave: "E#4", "B#3". */
  pitch: string;
  /** The displayed pitch class: the primary key's spelling, else the compare key's, else standard. */
  name: string;
  membership: Membership;
  role: Role;
  /** Degree and interval above the focus chord's root, or above the tonic when none is set. */
  degree: string;
  interval: string;
};

/** The note a degree or interval label is measured from: the focus chord's root, else the tonic. */
export function labelReference(selection: Selection): string {
  const { primary } = selection;
  const chord = primary.chord ? chordInfo(primary.chord) : undefined;
  return chord?.root ?? primary.tonic;
}

/**
 * Every position on the neck, frets 0 to `frets` on each string (§5.2), with
 * its membership (§3) and its role in the primary key or focus chord (§4.2).
 * Views decide what to hide; nothing here depends on how the board is drawn.
 */
export function fretboardNotes(
  selection: Selection,
  strings: readonly string[],
  frets: number,
): FretNote[] {
  const { primary, compare } = selection;
  const reference = labelReference(selection);
  // Each of the 12 pitch classes is worked out once, then placed on the neck.
  const byChroma = new Map<
    number,
    Omit<FretNote, "string" | "fret" | "pitch">
  >();
  const describe = (sharp: string) => {
    const c = chroma(sharp);
    const known = byChroma.get(c);
    if (known) return known;
    const m = membership(sharp, selection);
    const name =
      (m === "compare" && compare ? spellIn(sharp, compare) : undefined) ??
      spellIn(sharp, primary) ??
      standardName(sharp);
    const interval = intervalBetween(reference, name);
    const entry = {
      name,
      membership: m,
      role:
        m === "compare" || m === "none"
          ? ("outside" as const)
          : roleOf(name, primary),
      degree: degreeLabel(interval),
      interval,
    };
    byChroma.set(c, entry);
    return entry;
  };

  const out: FretNote[] = [];
  strings.forEach((open, string) => {
    for (let fret = 0; fret <= frets; fret++) {
      const sharp = fretPitch(open, fret);
      const note = describe(sharp);
      out.push({
        string,
        fret,
        pitch: respell(sharp, note.name),
        ...note,
      });
    }
  });
  return out;
}

export type FretLink = { string: number; from: number; to: number };

/**
 * With a compare set, each note that changes by a half step (G → D: C → C#)
 * is joined to the note that replaces it on the same string, one fret away.
 */
export function halfStepLinks(
  selection: Selection,
  strings: readonly string[],
  frets: number,
): FretLink[] {
  const { primary, compare } = selection;
  if (!compare) return [];
  const moves = noteDiff(primary, compare)
    .changed.filter((c) => c.halfStep)
    .map((c) => ({
      from: chroma(c.primary),
      step: (chroma(c.compare) - chroma(c.primary) + 12) % 12 === 1 ? 1 : -1,
    }));
  const out: FretLink[] = [];
  strings.forEach((open, string) => {
    for (let fret = 0; fret <= frets; fret++) {
      const c = chroma(fretPitch(open, fret));
      for (const move of moves) {
        const to = fret + move.step;
        if (c === move.from && to >= 0 && to <= frets)
          out.push({ string, from: fret, to });
      }
    }
  });
  return out;
}

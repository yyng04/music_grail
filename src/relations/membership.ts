import {
  chroma,
  letter,
  scaleNotes,
  type Selection,
  type Target,
} from "../theory/index.ts";

export type NotePair = { primary: string; compare: string };

export type KeyDiff = {
  /** Same pitch and same spelling. */
  same: string[];
  /** Same pitch, different spelling. Not a difference. */
  respelled: NotePair[];
  /** Pitches in one key only, paired with the note that replaces them. */
  changed: (NotePair & { halfStep: boolean })[];
  onlyPrimary: string[];
  onlyCompare: string[];
};

export type Membership = "both" | "primary" | "compare" | "none";

/** True when the note's pitch is in the target's scale (any spelling). */
export function inTarget(note: string, target: Target): boolean {
  const c = chroma(note);
  return scaleNotes(target).some((n) => chroma(n) === c);
}

/** The target's own spelling of a pitch, or undefined if it is not in the target. */
export function spellIn(note: string, target: Target): string | undefined {
  const c = chroma(note);
  return scaleNotes(target).find((n) => chroma(n) === c);
}

/** Pitches the two targets share, each spelled as its own target spells it. */
export function sharedNotes(a: Target, b: Target): NotePair[] {
  const compare = scaleNotes(b);
  return scaleNotes(a).flatMap((p) => {
    const q = compare.find((n) => chroma(n) === chroma(p));
    return q === undefined ? [] : [{ primary: p, compare: q }];
  });
}

function semitoneApart(a: string, b: string): boolean {
  const d = Math.abs(chroma(a) - chroma(b));
  return d === 1 || d === 11;
}

export function noteDiff(a: Target, b: Target): KeyDiff {
  const shared = sharedNotes(a, b);
  const sharedPrimary = new Set(shared.map((s) => s.primary));
  const sharedCompare = new Set(shared.map((s) => s.compare));
  const onlyPrimary = scaleNotes(a).filter((n) => !sharedPrimary.has(n));
  const onlyCompare = scaleNotes(b).filter((n) => !sharedCompare.has(n));

  // Pair each changed note with the note on the same letter (C → C#);
  // fall back to a note a half step away.
  const unpaired = [...onlyCompare];
  const changed: KeyDiff["changed"] = [];
  for (const p of onlyPrimary) {
    const sameLetter = unpaired.findIndex((q) => letter(q) === letter(p));
    const i =
      sameLetter >= 0
        ? sameLetter
        : unpaired.findIndex((q) => semitoneApart(p, q));
    const q = i >= 0 ? unpaired.splice(i, 1)[0] : undefined;
    if (q !== undefined)
      changed.push({ primary: p, compare: q, halfStep: semitoneApart(p, q) });
  }

  return {
    same: shared.filter((s) => s.primary === s.compare).map((s) => s.primary),
    respelled: shared.filter((s) => s.primary !== s.compare),
    changed,
    onlyPrimary,
    onlyCompare,
  };
}

/**
 * Which targets of the selection contain this pitch. With no compare set,
 * a note in the primary returns "primary"; views draw that as a solid fill.
 */
export function membership(note: string, selection: Selection): Membership {
  const p = inTarget(note, selection.primary);
  const c = selection.compare ? inTarget(note, selection.compare) : false;
  if (p && c) return "both";
  if (p) return "primary";
  if (c) return "compare";
  return "none";
}

import {
  keySignature,
  parentMajorTonic,
  relativeMinor,
  scaleNotes,
  type Selection,
  type Target,
} from "../theory/index.ts";
import { degreeOf, roleOf, type Role } from "./degrees.ts";
import { diatonicChords } from "./diatonic.ts";
import { noteDiff, sharedNotes, type Membership } from "./membership.ts";

export type RowNote = {
  name: string;
  membership: Membership;
  role: Role;
  degree: string;
  /** Set on a primary-only note that the next note (compare only) replaces. */
  change?: { to: string; halfStep: boolean };
};

/**
 * The panel's note row: the primary key's notes in order; with a compare set,
 * each note that changes is followed by the note that replaces it, and any
 * other compare-only notes come last. Roles follow the primary target (§4.2).
 */
export function noteRow(selection: Selection): RowNote[] {
  const { primary, compare } = selection;
  const note = (name: string, m: Membership): RowNote => ({
    name,
    membership: m,
    role: m === "compare" ? "outside" : roleOf(name, primary),
    degree: degreeOf(name, primary),
  });
  if (!compare) return scaleNotes(primary).map((n) => note(n, "primary"));
  const diff = noteDiff(primary, compare);
  const shared = new Set(sharedNotes(primary, compare).map((s) => s.primary));
  const out: RowNote[] = [];
  const placed = new Set<string>();
  for (const n of scaleNotes(primary)) {
    const change = diff.changed.find((c) => c.primary === n);
    out.push({
      ...note(n, shared.has(n) ? "both" : "primary"),
      ...(change
        ? { change: { to: change.compare, halfStep: change.halfStep } }
        : {}),
    });
    if (change) {
      out.push(note(change.compare, "compare"));
      placed.add(change.compare);
    }
  }
  for (const n of diff.onlyCompare)
    if (!placed.has(n)) out.push(note(n, "compare"));
  return out;
}

export type CompareSummary = {
  changed: { from: string; to: string; halfStep: boolean }[];
  sharedNotes: number;
  respelled: number;
  sharedChords: string[];
};

/** What changes when music moves from the primary key to the compare key (§3). */
export function compareSummary(
  primary: Target,
  compare: Target,
  sevenths: boolean,
): CompareSummary {
  const diff = noteDiff(primary, compare);
  const theirs = new Set(
    diatonicChords(compare, { sevenths }).map((c) => c.symbol),
  );
  return {
    changed: diff.changed.map((c) => ({
      from: c.primary,
      to: c.compare,
      halfStep: c.halfStep,
    })),
    sharedNotes: diff.same.length + diff.respelled.length,
    respelled: diff.respelled.length,
    sharedChords: diatonicChords(primary, { sevenths })
      .map((c) => c.symbol)
      .filter((s) => theirs.has(s)),
  };
}

const COUNT = ["no", "1", "2", "3", "4", "5", "6", "7"];

/** The line under the key name: signature and relative key, in words. */
export function keyMeta(target: Target): string {
  const sig = keySignature(target);
  const noun = sig.accidental === "#" ? "sharp" : "flat";
  const count =
    sig.count === 0
      ? "No sharps or flats"
      : `${COUNT[sig.count] ?? String(sig.count)} ${noun}${sig.count > 1 ? "s" : ""}`;
  if (target.kind === "major")
    return `${count} · relative ${relativeMinor(target.tonic).tonic} minor`;
  if (target.kind === "minor")
    return `${count} · relative ${parentMajorTonic(target)} major`;
  if (target.kind === "harmonic-minor") {
    const seventh = scaleNotes(target)[6] ?? "";
    return `${target.tonic} minor's key signature, with a raised 7th (${seventh})`;
  }
  return `${count} · the notes of ${parentMajorTonic(target)} major, from ${target.tonic}`;
}

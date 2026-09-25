import {
  chordInfo,
  degreeLabel,
  intervalBetween,
  type Target,
} from "../theory/index.ts";
import { spellIn } from "./membership.ts";

export type Role = "root" | "third" | "fifth" | "seventh" | "other" | "outside";

/**
 * Degree label of a note in the target ("1", "b3", "#4"). A note in the key
 * uses the key's spelling; a note outside it uses its own spelling.
 */
export function degreeOf(note: string, target: Target): string {
  return degreeLabel(
    intervalBetween(target.tonic, spellIn(note, target) ?? note),
  );
}

const ROLE_BY_NUMBER: Record<string, Role> = {
  "1": "root",
  "3": "third",
  "5": "fifth",
  "7": "seventh",
};

/**
 * A note's role (§4.2): its role in the target's focus chord when one is set,
 * otherwise its role in the target's key. Notes outside the key are "outside".
 */
export function roleOf(note: string, target: Target): Role {
  const spelled = spellIn(note, target);
  if (spelled === undefined) return "outside";

  const chord = target.chord ? chordInfo(target.chord) : undefined;
  if (chord) {
    const i = chord.notes.indexOf(spelled);
    const interval = i >= 0 ? chord.intervals[i] : undefined;
    const number = interval?.replace(/^[PMmAd]+/, "") ?? "";
    return ROLE_BY_NUMBER[number] ?? "other";
  }

  const number = degreeOf(spelled, target).replace(/^[b#]+/, "");
  return ROLE_BY_NUMBER[number] ?? "other";
}

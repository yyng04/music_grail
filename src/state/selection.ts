import { isDiatonic, spellIn } from "../relations/index.ts";
import {
  canonicalChord,
  chordInfo,
  isValidTonic,
  standardKey,
  type Selection,
  type Target,
} from "../theory/index.ts";

export const DEFAULT_SELECTION: Selection = {
  primary: { tonic: "C", kind: "major" },
};

export type Checked<T> = { value: T; warnings: string[] };

/**
 * Rewrites a theoretical key to its standard spelling (§3), then canonicalises
 * the focus chord and drops it if it is not diatonic (v1 rule, §5.1).
 * Returns undefined for an invalid tonic.
 */
export function checkTarget(target: Target): Checked<Target> | undefined {
  if (!isValidTonic(target.tonic)) return undefined;
  const warnings: string[] = [];
  const { chord: chordAsGiven, ...given } = target;
  const key = standardKey(given);
  let chord = chordAsGiven;

  if (key.tonic !== given.tonic) {
    warnings.push(
      `Rewriting ${given.tonic} ${given.kind} as ${key.tonic} ${key.kind}: not a standard key`,
    );
    // Respell the focus chord's root the way the rewritten key spells it.
    const info = chord === undefined ? undefined : chordInfo(chord);
    const root = info && spellIn(info.root, key);
    if (info && root) chord = `${root}${info.suffix}`;
  }
  if (chord === undefined) return { value: key, warnings };

  const symbol = canonicalChord(chord);
  if (symbol === undefined || !isDiatonic(symbol, key)) {
    warnings.push(
      `Ignoring chord ${chord}: not diatonic to ${key.tonic} ${key.kind}`,
    );
    return { value: key, warnings };
  }
  return { value: { ...key, chord: symbol }, warnings };
}

export function checkSelection(selection: Selection): Checked<Selection> {
  const primary = checkTarget(selection.primary);
  const compare = selection.compare
    ? checkTarget(selection.compare)
    : undefined;
  const warnings = [...(primary?.warnings ?? []), ...(compare?.warnings ?? [])];
  if (!primary)
    warnings.push(`Invalid primary tonic: ${selection.primary.tonic}`);
  if (selection.compare && !compare)
    warnings.push(`Invalid compare tonic: ${selection.compare.tonic}`);

  return {
    value: {
      primary: primary?.value ?? DEFAULT_SELECTION.primary,
      ...(compare ? { compare: compare.value } : {}),
    },
    warnings,
  };
}

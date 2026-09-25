import { isDiatonic } from "../relations/index.ts";
import {
  canonicalChord,
  isValidTonic,
  type Selection,
  type Target,
} from "../theory/index.ts";

export const DEFAULT_SELECTION: Selection = {
  primary: { tonic: "C", kind: "major" },
};

export type Checked<T> = { value: T; warnings: string[] };

/**
 * Canonicalises a target's focus chord and drops it if it is not diatonic
 * (v1 rule, §5.1). Returns undefined for an invalid tonic.
 */
export function checkTarget(target: Target): Checked<Target> | undefined {
  if (!isValidTonic(target.tonic)) return undefined;
  const { chord, ...key } = target;
  if (chord === undefined) return { value: key, warnings: [] };

  const symbol = canonicalChord(chord);
  if (symbol === undefined || !isDiatonic(symbol, key)) {
    return {
      value: key,
      warnings: [
        `Ignoring chord ${chord}: not diatonic to ${key.tonic} ${key.kind}`,
      ],
    };
  }
  return { value: { ...key, chord: symbol }, warnings: [] };
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

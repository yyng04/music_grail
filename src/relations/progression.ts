// A typed chord progression: the symbols parsed in order, which chord sounds
// in each bar of the loop, and one shell voicing per chord chosen so the hand
// moves as little as possible from chord to chord.
import { canonicalChord, chroma } from "../theory/index.ts";
import { chordTones, shellShapes, type Shape, type Tone } from "./shapes.ts";

/** One symbol of the entry, with where it starts; `chord` is unset when it is not a chord. */
export type ProgressionToken = { text: string; start: number; chord?: string };

/** Splits the entry on spaces; a symbol the theory layer cannot read keeps its place with no chord. */
export function parseProgression(text: string): ProgressionToken[] {
  const out: ProgressionToken[] = [];
  const re = /\S+/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const chord = canonicalChord(m[0]);
    out.push(
      chord
        ? { text: m[0], start: m.index, chord }
        : { text: m[0], start: m.index },
    );
  }
  return out;
}

/** The chords of an entry, in order, with the unreadable symbols left out. */
export const progressionChords = (tokens: readonly ProgressionToken[]) =>
  tokens.flatMap((t) => (t.chord ? [t.chord] : []));

export const totalBars = (bars: readonly number[]) =>
  bars.reduce((a, b) => a + b, 0);

/** Which chord sounds in a bar of the loop (bars count from 0 and wrap): [2, 1, 1] → 0, 0, 1, 2, 0. */
export function chordAtBar(bars: readonly number[], bar: number): number {
  const total = totalBars(bars);
  if (total <= 0) return 0;
  let left = ((bar % total) + total) % total;
  for (let i = 0; i < bars.length; i++) {
    left -= bars[i] ?? 0;
    if (left < 0) return i;
  }
  return 0;
}

/** The loop bar each chord starts on: [2, 1, 1] → 0, 2, 3. */
export function startBars(bars: readonly number[]): number[] {
  let at = 0;
  return bars.map((n) => {
    const start = at;
    at += n;
    return start;
  });
}

export type RootString = "6th" | "5th" | "auto";

/**
 * The tones a shell uses: root, 3rd and 7th. A triad has no 7th, so its 5th
 * takes the 7th's place in the same shapes.
 */
function shellTones(chord: string): { tones: Tone[]; triad: boolean } {
  const tones = chordTones(chord);
  if (tones.some((t) => t.role === "seventh")) return { tones, triad: false };
  return {
    tones: tones.map((t) =>
      t.role === "fifth" ? { ...t, role: "seventh" as const } : t,
    ),
    triad: true,
  };
}

/** A chord's shells within frets 0 to `maxFret`; a triad's are labelled with its 5th. */
export function progressionShells(
  chord: string,
  tuning: readonly string[],
  maxFret: number,
): Shape[] {
  const { tones, triad } = shellTones(chord);
  return shellShapes(tuning, tones, maxFret)
    .filter((s) => s.high <= maxFret)
    .map((s) =>
      triad
        ? {
            ...s,
            dots: s.dots.map((d) =>
              d.role === "seventh" ? { ...d, role: "fifth" as const } : d,
            ),
            tag: s.tag?.replace(" 7", " 5"),
          }
        : s,
    );
}

/** The voices of a shape from the lowest string up. */
const voices = (s: Shape) => [...s.dots].sort((a, b) => a.string - b.string);

/**
 * How far the hand moves between two shells: each voice's fret distance,
 * low voice to low voice, plus 2 for every string a voice changes.
 */
export function shellMovement(a: Shape, b: Shape): number {
  const vb = voices(b);
  return voices(a).reduce((sum, d, i) => {
    const e = vb[i];
    return e
      ? sum + Math.abs(d.fret - e.fret) + 2 * Math.abs(d.string - e.string)
      : sum;
  }, 0);
}

/** Every shape repeats an octave up, so the choice stays within the first 12 frets. */
const SHELL_FRETS = 12;

/**
 * One shell per chord. Every chord after the first takes the shell closest
 * to the one before. The first chord is the one that makes the whole loop
 * move least (ties go to the lower frets). With the root string set to 6th
 * or 5th, every chord keeps its root on that string where it can.
 */
export function progressionVoicing(
  chords: readonly string[],
  tuning: readonly string[],
  root: RootString,
): (Shape | undefined)[] {
  const rootString = root === "6th" ? 0 : root === "5th" ? 1 : undefined;
  const options = chords.map((c) => {
    const all = progressionShells(c, tuning, SHELL_FRETS);
    if (rootString === undefined) return all;
    const kept = all.filter(
      (s) => Math.min(...s.dots.map((d) => d.string)) === rootString,
    );
    return kept.length ? kept : all;
  });
  let best:
    { shapes: (Shape | undefined)[]; cost: number; low: number } | undefined;
  for (const first of options[0] ?? []) {
    const shapes: (Shape | undefined)[] = [first];
    let prev = first;
    let cost = 0;
    for (const opts of options.slice(1)) {
      const next = [...opts].sort(
        (x, y) =>
          shellMovement(prev, x) - shellMovement(prev, y) || x.low - y.low,
      )[0];
      shapes.push(next);
      if (!next) continue;
      cost += shellMovement(prev, next);
      prev = next;
    }
    cost += shellMovement(prev, first);
    if (
      !best ||
      cost < best.cost ||
      (cost === best.cost && first.low < best.low)
    )
      best = { shapes, cost, low: first.low };
  }
  return best?.shapes ?? chords.map(() => undefined);
}

/** Voices of the next shell that sit where a voice of this one already is: the held notes. */
export function heldVoices(
  shape: Shape | undefined,
  next: Shape | undefined,
): { string: number; fret: number }[] {
  if (!shape || !next) return [];
  return next.dots
    .filter((d) =>
      shape.dots.some(
        (e) =>
          e.string === d.string &&
          e.fret === d.fret &&
          chroma(e.name) === chroma(d.name),
      ),
    )
    .map((d) => ({ string: d.string, fret: d.fret }));
}

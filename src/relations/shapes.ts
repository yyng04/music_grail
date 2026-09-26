// Shapes for the fretboard's Show modes (§5.2b): closed triads, two-note
// chords (pairs from a chord, harmony through the key), guide-tone moves and
// the CAGED positions, all computed from the tuning data.
import {
  chordInfo,
  chroma,
  degreeLabel,
  fretPitch,
  intervalBetween,
  midi,
  parentMajorTonic,
  scaleNotes,
  type Target,
} from "../theory/index.ts";
import { roleOf } from "./degrees.ts";

export type ShapeRole = "root" | "third" | "fifth" | "seventh" | "other";
export type Tone = { name: string; role: ShapeRole; degree: string };
export type Dot = {
  string: number;
  fret: number;
  name: string;
  role: ShapeRole;
  label: string;
};
export type Move = { string: number; from: number; to: number; held: boolean };
export type Shape = {
  dots: Dot[];
  low: number;
  high: number;
  /** Short name for steppers and tiles: "1st inversion", "M3", "Am7 → D7". */
  tag: string;
  moves?: Move[];
  next?: Dot[];
};

const ROLE: Record<string, ShapeRole> = {
  "1": "root",
  "3": "third",
  "5": "fifth",
  "7": "seventh",
};

export function chordTones(symbol: string): Tone[] {
  const c = chordInfo(symbol);
  if (!c) return [];
  return c.notes.map((name, i) => {
    const iv = c.intervals[i] ?? "P1";
    return {
      name,
      role: ROLE[iv.replace(/^[PMmAd]+/, "")] ?? "other",
      degree: degreeLabel(iv),
    };
  });
}

const toneAt = (open: string, fret: number, tones: Tone[]) => {
  const c = chroma(fretPitch(open, fret));
  return tones.find((t) => chroma(t.name) === c);
};
const dot = (string: number, fret: number, t: Tone): Dot => ({
  string,
  fret,
  name: t.name,
  role: t.role,
  label: t.degree,
});
const span = (frets: number[]) => Math.max(...frets) - Math.min(...frets);
const byNeck = (a: Shape, b: Shape) => a.low - b.low || a.high - b.high;

/** Every closed triad shape on three adjacent strings: one chord tone per string, all three tones, within 4 frets. */
export function triadShapes(
  strings: readonly string[],
  set: readonly [number, number, number],
  tones: Tone[],
  frets: number,
): Shape[] {
  const triad = tones.slice(0, 3);
  const out: Shape[] = [];
  const [a, b, c] = set.map((s) => strings[s] ?? "E2") as [
    string,
    string,
    string,
  ];
  for (let f0 = 0; f0 <= frets; f0++)
    for (let f1 = Math.max(0, f0 - 3); f1 <= Math.min(frets, f0 + 3); f1++)
      for (let f2 = Math.max(0, f0 - 3); f2 <= Math.min(frets, f0 + 3); f2++) {
        if (span([f0, f1, f2]) > 3) continue;
        const t = [
          toneAt(a, f0, triad),
          toneAt(b, f1, triad),
          toneAt(c, f2, triad),
        ];
        if (t.some((x) => !x) || new Set(t.map((x) => x?.role)).size !== 3)
          continue;
        const [t0, t1, t2] = t as [Tone, Tone, Tone];
        const bass = t0.role;
        out.push({
          dots: [dot(set[0], f0, t0), dot(set[1], f1, t1), dot(set[2], f2, t2)],
          low: Math.min(f0, f1, f2),
          high: Math.max(f0, f1, f2),
          tag:
            bass === "root"
              ? "Root position"
              : bass === "third"
                ? "1st inversion"
                : "2nd inversion",
        });
      }
  return out.sort(byNeck);
}

/** Two-note shapes on the given string pairs: lower note on the lower string, within 4 frets. */
function twoNote(
  strings: readonly string[],
  pairs: [number, number][],
  frets: number,
  /** For a pitch on the lower string: its spelling and the upper note (name, MIDI pitch). */
  upper: (
    lowerPitch: string,
  ) => { low: string; name: string; pitch: number } | undefined,
  tone: (name: string) => Tone,
  tag: (lower: string, upper: string) => string,
): Shape[] {
  const out: Shape[] = [];
  for (const [lo, hi] of pairs) {
    const openLo = strings[lo] ?? "E2";
    const openHi = strings[hi] ?? "E4";
    for (let f = 0; f <= frets; f++) {
      const pitch = fretPitch(openLo, f);
      const up = upper(pitch);
      if (!up) continue;
      const g = up.pitch - midi(openHi);
      if (g < 0 || g > frets || Math.abs(g - f) > 3) continue;
      const lowTone = tone(up.low);
      const upTone = tone(up.name);
      out.push({
        dots: [dot(lo, f, lowTone), dot(hi, g, upTone)],
        low: Math.min(f, g),
        high: Math.max(f, g),
        tag: tag(lowTone.name, upTone.name),
      });
    }
  }
  return out.sort(byNeck);
}

const intervalName = (a: string, b: string) => {
  const iv = intervalBetween(a, b);
  return iv === "P1" ? "P8" : iv;
};

/** The key harmonised in one diatonic interval on a pair of strings (3rds, 6ths, 4ths, octaves). */
export function harmonyShapes(
  strings: readonly string[],
  key: Target,
  steps: number,
  pair: [number, number],
  frets: number,
): Shape[] {
  const scale = scaleNotes(key);
  const tone = (name: string): Tone => ({
    name,
    role: (roleOf(name, key) === "outside"
      ? "other"
      : roleOf(name, key)) as ShapeRole,
    degree: degreeLabel(intervalBetween(key.tonic, name)),
  });
  return twoNote(
    strings,
    [pair],
    frets,
    (pitch) => {
      const i = scale.findIndex((n) => chroma(n) === chroma(pitch));
      const low = scale[i];
      const target = scale[(i + steps) % 7];
      if (i < 0 || !low || !target) return undefined;
      const d = (chroma(target) - chroma(low) + 12) % 12 || 12;
      return { low, name: target, pitch: midi(pitch) + d };
    },
    tone,
    intervalName,
  );
}

/** A pair of chord tones on neighbouring strings or with one string skipped, either note on top. */
export function pairShapes(
  strings: readonly string[],
  a: Tone,
  b: Tone,
  frets: number,
): Shape[] {
  // Neighbouring strings, and one string skipped (root + 7th needs the skip).
  const adjacent = strings.flatMap((_, i) =>
    [i + 1, i + 2]
      .filter((j) => j < strings.length)
      .map((j) => [i, j] as [number, number]),
  );
  const tones = [a, b];
  return twoNote(
    strings,
    adjacent,
    frets,
    (pitch) => {
      const low = tones.find((t) => chroma(t.name) === chroma(pitch));
      const up = tones.find((t) => t !== low);
      if (!low || !up) return undefined;
      const d = (chroma(up.name) - chroma(low.name) + 12) % 12;
      return { low: low.name, name: up.name, pitch: midi(pitch) + d };
    },
    (name) => tones.find((t) => t.name === name) ?? a,
    intervalName,
  );
}

/**
 * Guide tones (3rd and 7th) of one chord on two strings, each moved to
 * the nearest guide tone of the next chord on the same string (held, or a
 * half or whole step away).
 */
export function guideShapes(
  strings: readonly string[],
  from: string,
  to: string,
  frets: number,
): Shape[] {
  const guide = (s: string) =>
    chordTones(s).filter((t) => t.role === "third" || t.role === "seventh");
  const [third, seventh] = guide(from);
  const next = guide(to);
  if (!third || !seventh) return [];
  return pairShapes(strings, third, seventh, frets).flatMap((shape) => {
    const moves: Move[] = [];
    const nextDots: Dot[] = [];
    for (const d of shape.dots) {
      const open = strings[d.string] ?? "E2";
      let best: { fret: number; tone: Tone } | undefined;
      for (const step of [0, -1, 1, -2, 2]) {
        const f = d.fret + step;
        if (f < 0 || f > frets) continue;
        const t = toneAt(open, f, next);
        if (t) {
          best = { fret: f, tone: t };
          break;
        }
      }
      if (!best) return [];
      moves.push({
        string: d.string,
        from: d.fret,
        to: best.fret,
        held: best.fret === d.fret,
      });
      nextDots.push(dot(d.string, best.fret, best.tone));
    }
    return [{ ...shape, moves, next: nextDots, tag: `${from} → ${to}` }];
  });
}

export type Position = { name: string; from: number; to: number };

/**
 * The five CAGED positions of a key on standard guitar tuning, in neck order.
 * Each is a 4-fret window holding every note of the key, placed by where the
 * open-chord shape's root falls (E and G shapes: 6th string; C and A: 5th; D: 4th).
 */
export function cagedPositions(key: Target): Position[] {
  // The positions follow the major key that shares the notes (A minor → C major).
  const tonic = parentMajorTonic(key);
  const root = (open: string, min: number) => {
    for (let f = min; f < min + 12; f++)
      if (chroma(fretPitch(open, f)) === chroma(tonic)) return f;
    return min;
  };
  const e = root("E2", 1);
  const d = root("D3", 1);
  const c = root("A2", 3);
  const a = root("A2", 1);
  const g = root("E2", 3);
  return [
    { name: "E", from: e - 1, to: e + 2 },
    { name: "D", from: d - 1, to: d + 2 },
    { name: "C", from: c - 3, to: c },
    { name: "A", from: a - 1, to: a + 2 },
    { name: "G", from: g - 3, to: g },
  ].sort((x, y) => x.from - y.from);
}

export const inWindow = (s: Shape, p?: Position) =>
  !p || (s.low >= p.from && s.high <= p.to);

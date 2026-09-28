// Shapes for the fretboard's Show modes: closed triads, two-note
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
  pitchClass,
  scaleNotes,
  type Target,
} from "../theory/index.ts";
import { roleOf } from "./degrees.ts";

export type ShapeRole = "root" | "third" | "fifth" | "seventh" | "other";
/** A note of a chord or key, with its degree ("b3") and interval ("m3") from the chord root or tonic. */
export type Tone = {
  name: string;
  role: ShapeRole;
  degree: string;
  interval: string;
};
export type Dot = Tone & { string: number; fret: number };
export type Move = { string: number; from: number; to: number };
export type Shape = {
  dots: Dot[];
  low: number;
  high: number;
  /** Triads: "Root position", "1st inversion", "2nd inversion". */
  tag?: string;
  /** Triads: the note on the lowest string. Shells: the root's string, by its open note. */
  bass?: string;
  /** Two-note shapes: from the lower note to the upper, quality-first ("d5"). */
  interval?: string;
  /** Guide tones: where each note goes in the next chord, on the same string. */
  moves?: Move[];
  next?: Dot[];
};

const ROLE: Record<string, ShapeRole> = {
  "1": "root",
  "3": "third",
  "5": "fifth",
  "7": "seventh",
};

/** A chord's notes with their role, degree and interval above the root. */
export function chordTones(symbol: string): Tone[] {
  const c = chordInfo(symbol);
  if (!c) return [];
  return c.notes.map((name, i) => {
    const interval = c.intervals[i] ?? "P1";
    return {
      name,
      role: ROLE[interval.replace(/^[PMmAd]+/, "")] ?? "other",
      degree: degreeLabel(interval),
      interval,
    };
  });
}

/** A key's note as a tone: its role, degree and interval above the tonic. */
export function keyTone(name: string, key: Target): Tone {
  const role = roleOf(name, key);
  const interval = intervalBetween(key.tonic, name);
  return {
    name,
    role: role === "outside" ? "other" : role,
    degree: degreeLabel(interval),
    interval,
  };
}

export type StringSet = {
  /** Tuning indices joined, lowest first: "345". Stable for a given tuning. */
  id: string;
  /** Tuning indices, lowest string first. */
  strings: number[];
  /** Open notes, low to high: "G B E". */
  name: string;
};

/**
 * Groups of `size` strings, highest group first, named by their open notes
 * from low to high ("G B E", "D G B", ...). With `skip`, every other string
 * (for 6ths and octaves on two strings: "D B" skips the G string).
 */
export function stringSets(
  tuning: readonly string[],
  size: number,
  skip = false,
): StringSet[] {
  const step = skip ? 2 : 1;
  const out: StringSet[] = [];
  for (let lo = tuning.length - 1 - step * (size - 1); lo >= 0; lo--) {
    const strings = Array.from({ length: size }, (_, i) => lo + i * step);
    out.push({
      id: strings.join(""),
      strings,
      name: strings.map((s) => pitchClass(tuning[s] ?? "")).join(" "),
    });
  }
  return out;
}

const toneAt = (open: string, fret: number, tones: readonly Tone[]) => {
  const c = chroma(fretPitch(open, fret));
  return tones.find((t) => chroma(t.name) === c);
};
const at = (string: number, fret: number, t: Tone): Dot => ({
  ...t,
  string,
  fret,
});
const byNeck = (a: Shape, b: Shape) => a.low - b.low || a.high - b.high;
const INVERSION: Partial<Record<ShapeRole, string>> = {
  root: "Root position",
  third: "1st inversion",
  fifth: "2nd inversion",
};

/**
 * Every closed triad shape on three strings: exactly the three chord tones,
 * one per string, within 4 frets, named by the note in the bass.
 * A 7th chord uses its triad.
 */
export function triadShapes(
  tuning: readonly string[],
  set: readonly number[],
  tones: readonly Tone[],
  frets: number,
): Shape[] {
  const triad = tones.slice(0, 3);
  const opens = set.map((s) => tuning[s] ?? "E2");
  const [s0, s1, s2] = set;
  const [a, b, c] = opens;
  if (s0 === undefined || s1 === undefined || s2 === undefined) return [];
  if (!a || !b || !c) return [];
  const out: Shape[] = [];
  for (let f0 = 0; f0 <= frets; f0++)
    for (let f1 = Math.max(0, f0 - 3); f1 <= Math.min(frets, f0 + 3); f1++)
      for (let f2 = Math.max(0, f0 - 3); f2 <= Math.min(frets, f0 + 3); f2++) {
        const low = Math.min(f0, f1, f2);
        const high = Math.max(f0, f1, f2);
        if (high - low > 3) continue;
        const t0 = toneAt(a, f0, triad);
        const t1 = toneAt(b, f1, triad);
        const t2 = toneAt(c, f2, triad);
        if (!t0 || !t1 || !t2) continue;
        if (new Set([t0.role, t1.role, t2.role]).size !== 3) continue;
        out.push({
          dots: [at(s0, f0, t0), at(s1, f1, t1), at(s2, f2, t2)],
          low,
          high,
          tag: INVERSION[t0.role] ?? "",
          bass: t0.name,
        });
      }
  return out.sort(byNeck);
}

const intervalName = (a: string, b: string) => {
  const iv = intervalBetween(a, b);
  return iv === "P1" ? "P8" : iv;
};

/**
 * Two-note shapes on one pair of strings, lower note on the lower string,
 * within 4 frets. `upper` names the note above a pitch on the lower string.
 */
function twoNote(
  tuning: readonly string[],
  [lo, hi]: readonly [number, number],
  frets: number,
  upper: (
    lowerPitch: string,
  ) => { low: Tone; high: Tone; pitch: number } | undefined,
): Shape[] {
  const openLo = tuning[lo] ?? "E2";
  const openHi = tuning[hi] ?? "E4";
  const out: Shape[] = [];
  for (let f = 0; f <= frets; f++) {
    const up = upper(fretPitch(openLo, f));
    if (!up) continue;
    const g = up.pitch - midi(openHi);
    if (g < 0 || g > frets || Math.abs(g - f) > 3) continue;
    out.push({
      dots: [at(lo, f, up.low), at(hi, g, up.high)],
      low: Math.min(f, g),
      high: Math.max(f, g),
      interval: intervalName(up.low.name, up.high.name),
    });
  }
  return out.sort(byNeck);
}

/** The key harmonised in one diatonic interval on a pair of strings (3rds: 2 steps, 6ths: 5, 4ths: 3, octaves: 7). */
export function harmonyShapes(
  tuning: readonly string[],
  key: Target,
  steps: number,
  pair: readonly [number, number],
  frets: number,
): Shape[] {
  const scale = scaleNotes(key);
  return twoNote(tuning, pair, frets, (pitch) => {
    const i = scale.findIndex((n) => chroma(n) === chroma(pitch));
    const low = scale[i];
    const high = scale[(i + steps) % 7];
    if (i < 0 || !low || !high) return undefined;
    const up = (chroma(high) - chroma(low) + 12) % 12 || 12;
    return {
      low: keyTone(low, key),
      high: keyTone(high, key),
      pitch: midi(pitch) + up,
    };
  });
}

/** Two tones of a chord on one pair of strings, either note on top. */
export function pairShapes(
  tuning: readonly string[],
  pair: readonly [number, number],
  a: Tone,
  b: Tone,
  frets: number,
): Shape[] {
  return twoNote(tuning, pair, frets, (pitch) => {
    const low = [a, b].find((t) => chroma(t.name) === chroma(pitch));
    const high = low === a ? b : a;
    if (!low) return undefined;
    const up = (chroma(high.name) - chroma(low.name) + 12) % 12;
    return { low, high, pitch: midi(pitch) + up };
  });
}

/** A 7th chord's guide tones: its 3rd and 7th (Dm7 → F, C). */
export function guideTones(symbol: string): string[] {
  const tones = chordTones(symbol);
  return (["third", "seventh"] as const).flatMap(
    (r) => tones.find((t) => t.role === r)?.name ?? [],
  );
}

export type GuideMotion = { from: string; to: string; semitones: number };

/** Signed distance between two pitch classes the short way, -6 to 5 semitones. */
const shortest = (from: string, to: string) =>
  ((chroma(to) - chroma(from) + 18) % 12) - 6;

/**
 * How each guide tone of one chord moves to a guide tone of the next, the
 * shortest way, each to a different note: Am7 → D7 is C held, G → F# (-1).
 */
export function guideToneMotion(from: string, to: string): GuideMotion[] {
  const a = guideTones(from);
  const b = guideTones(to);
  const [a3, a7] = a;
  const [b3, b7] = b;
  if (!a3 || !a7 || !b3 || !b7) return [];
  const pairing = (x: string, y: string) => [
    { from: a3, to: x, semitones: shortest(a3, x) },
    { from: a7, to: y, semitones: shortest(a7, y) },
  ];
  const straight = pairing(b3, b7);
  const crossed = pairing(b7, b3);
  const cost = (m: GuideMotion[]) =>
    m.reduce((sum, x) => sum + Math.abs(x.semitones), 0);
  return cost(crossed) < cost(straight) ? crossed : straight;
}

const STEP_WORDS: Record<number, string> = {
  1: "a half step",
  2: "a whole step",
  3: "a minor 3rd",
  4: "a major 3rd",
  5: "a 4th",
  6: "a tritone",
};

/** The motion in words: "B held, F# → E, a whole step down." */
export function describeMotion(motion: readonly GuideMotion[]): string {
  const parts = motion.map((m) =>
    m.semitones === 0
      ? { moves: false, text: `${m.from} held` }
      : {
          moves: true,
          text: `${m.from} → ${m.to}, ${STEP_WORDS[Math.abs(m.semitones)] ?? ""} ${m.semitones < 0 ? "down" : "up"}`,
        },
  );
  // Two moving notes become two sentences, since each already has a comma.
  if (parts.every((p) => p.moves))
    return parts.map((p) => `${p.text}.`).join(" ");
  return `${parts.map((p) => p.text).join(", ")}.`;
}

/**
 * Guide tones (3rd and 7th) of one chord on a pair of strings, each moved on
 * its own string to the guide tone it goes to in the next chord.
 */
export function guideShapes(
  tuning: readonly string[],
  pair: readonly [number, number],
  from: string,
  to: string,
  frets: number,
): Shape[] {
  const tones = chordTones(from);
  const nextTones = chordTones(to);
  const third = tones.find((t) => t.role === "third");
  const seventh = tones.find((t) => t.role === "seventh");
  const motion = guideToneMotion(from, to);
  if (!third || !seventh || motion.length !== 2) return [];
  return pairShapes(tuning, pair, third, seventh, frets).flatMap((shape) => {
    const moves: Move[] = [];
    const next: Dot[] = [];
    for (const d of shape.dots) {
      const m = motion.find((x) => x.from === d.name);
      const tone = nextTones.find((t) => t.name === m?.to);
      const fret = d.fret + (m?.semitones ?? 0);
      if (!m || !tone || fret < 0 || fret > frets) return [];
      moves.push({ string: d.string, from: d.fret, to: fret });
      next.push(at(d.string, fret, tone));
    }
    const all = [...shape.dots, ...next].map((d) => d.fret);
    return [
      {
        ...shape,
        low: Math.min(...all),
        high: Math.max(...all),
        moves,
        next,
      },
    ];
  });
}

export type ShellForm = {
  /** Low to high: "R 3 7" or "R 7 3". */
  order: string;
  /** Tuning indices, lowest first. */
  strings: [number, number, number];
  roles: [ShapeRole, ShapeRole, ShapeRole];
  /** Open notes of the three strings, low to high: "E A D". */
  name: string;
  /** Open note of the root's string: "E". */
  root: string;
};

/**
 * The four shell forms: R 3 7 on three neighbouring strings, and R 7 3
 * with one string skipped between the root and the 7th, each with the root on
 * the lowest string and on the next one up. Forms that need a string the
 * instrument does not have are left out (a 4-string bass has three).
 */
export function shellForms(tuning: readonly string[]): ShellForm[] {
  const out: ShellForm[] = [];
  for (const r of [0, 1])
    for (const [order, gaps, roles] of [
      ["R 3 7", [1, 2], ["root", "third", "seventh"]],
      ["R 7 3", [2, 3], ["root", "seventh", "third"]],
    ] as const) {
      const strings: [number, number, number] = [r, r + gaps[0], r + gaps[1]];
      if (strings.some((x) => x >= tuning.length)) continue;
      const open = strings.map((x) => pitchClass(tuning[x] ?? ""));
      out.push({
        order,
        strings,
        roles: [...roles],
        name: open.join(" "),
        root: open[0] ?? "",
      });
    }
  return out;
}

/**
 * Shell voicings of a 7th chord: root, 3rd and 7th, the 5th left out, in the
 * four forms, each at the lowest place it fits within 4 frets, then the same
 * forms an octave up where they fit. Tagged "R 7 3, root on E".
 */
export function shellShapes(
  tuning: readonly string[],
  tones: readonly Tone[],
  frets: number,
): Shape[] {
  const byRole = (role: ShapeRole) => tones.find((t) => t.role === role);
  const places = shellForms(tuning).map((form) => {
    const found: Shape[] = [];
    const [rs] = form.strings;
    const root = byRole("root");
    if (!root) return found;
    for (let f = 0; f <= frets; f++) {
      const open = tuning[rs] ?? "E2";
      if (chroma(fretPitch(open, f)) !== chroma(root.name)) continue;
      const dots: Dot[] = [];
      for (let i = 0; i < 3; i++) {
        const tone = byRole(form.roles[i] ?? "root");
        const string = form.strings[i] ?? 0;
        const onString = tuning[string] ?? "E2";
        if (!tone) break;
        // The note nearest the root's fret on its string, within the 4-fret span.
        let best: number | undefined;
        for (let g = Math.max(0, f - 3); g <= Math.min(frets, f + 3); g++)
          if (
            chroma(fretPitch(onString, g)) === chroma(tone.name) &&
            (best === undefined || Math.abs(g - f) < Math.abs(best - f))
          )
            best = g;
        if (best === undefined) break;
        dots.push(at(string, best, tone));
      }
      const all = dots.map((d) => d.fret);
      if (dots.length !== 3 || Math.max(...all) - Math.min(...all) > 3)
        continue;
      found.push({
        dots,
        low: Math.min(...all),
        high: Math.max(...all),
        tag: `${form.order}, root on ${form.root}`,
        bass: form.root,
      });
    }
    return found;
  });
  // The four forms at their lowest place, then the four an octave up, and so on.
  const out: Shape[] = [];
  const rounds = Math.max(0, ...places.map((p) => p.length));
  for (let k = 0; k < rounds; k++)
    for (const p of places) {
      const shape = p[k];
      if (shape) out.push(shape);
    }
  return out;
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

// What the fretboard shows for the Show state: the notes on the board,
// the shapes for the strip, and the plain title line that says what is shown.
import { useMemo } from "react";
import { boardInstrument, play, unlockAudio } from "../../audio/index.ts";
import {
  chordLabel,
  spokenName,
  targetName,
} from "../../components/spelling.ts";
import {
  cagedPositions,
  chordTones,
  describeMotion,
  diatonicChords,
  fretboardNotes,
  guideShapes,
  chordAtBar,
  guideToneMotion,
  halfStepLinks,
  heldVoices,
  parseProgression,
  progressionChords,
  progressionVoicing,
  harmonyShapes,
  labelReference,
  pairShapes,
  shellShapes,
  stringSets,
  triadShapes,
  type Dot,
  type FretLink,
  type FretNote,
  type Membership,
  type Move,
  type Position,
  type ProgressionToken,
  type Role,
  type Shape,
  type ShapeRole,
  type StringSet,
} from "../../relations/index.ts";
import {
  appStore,
  barsFor,
  STOPPED,
  useAppStore,
  type AppState,
  type DotLabel,
  type Harmony,
  type Mode,
  type Playback,
  type ProgressionState,
  type ShapeState,
} from "../../state/index.ts";
import {
  chordInfo,
  chroma,
  degreeLabel,
  fretPitch,
  intervalBetween,
  midi,
  octave,
  pitchClass,
  respell,
  transpose,
  tuning,
  type Selection,
} from "../../theory/index.ts";

export const MODES: { value: Mode; text: string }[] = [
  { value: "scale", text: "Scale" },
  { value: "chords", text: "Chord shapes" },
  { value: "two", text: "Two-note chords" },
  { value: "guide", text: "Guide tones" },
  { value: "progression", text: "Progression" },
];

export const PAIRS: {
  pair: [ShapeRole, ShapeRole];
  text: string;
  caption: string;
}[] = [
  {
    pair: ["root", "fifth"],
    text: "Root + 5th",
    caption:
      "Power chord. No 3rd, so it's neither major nor minor and fits under either. Rock and heavier styles, especially with distortion.",
  },
  {
    pair: ["root", "third"],
    text: "Root + 3rd",
    caption:
      "The smallest shape that says major or minor. Light fills, and when another instrument covers the rest.",
  },
  {
    pair: ["third", "seventh"],
    text: "3rd + 7th",
    caption:
      "Guide tones: the two notes that define a 7th chord's sound. Jazz, soul and funk comping. The next chord's guide tones are usually a half step away.",
  },
  {
    pair: ["root", "seventh"],
    text: "Root + 7th",
    caption:
      "Open, tense sound. The base of jazz shell voicings (add the 3rd for a three-note shell).",
  },
  {
    pair: ["third", "fifth"],
    text: "3rd + 5th",
    caption:
      "The top of the triad without the root. Works when a bass player plays the root.",
  },
  {
    pair: ["fifth", "seventh"],
    text: "5th + 7th",
    caption:
      "Colour without root or 3rd. Sounds unresolved; used over a moving bass line.",
  },
];

export const SHELL_CAPTION =
  "Root, 3rd and 7th: the notes that name a 7th chord, with the 5th left out. The standard jazz and blues comping shapes.";

export const HARMONY_CAPTION: Record<Harmony, string> = {
  "3rds": "Sweet harmony for melodies and fills.",
  "6ths": "Wider and fuller, a staple of soul and country fills.",
  "4ths": "Open and modern.",
  octaves: "Doubles a melody for weight.",
};
const STEPS: Record<Harmony, number> = {
  "3rds": 2,
  "6ths": 5,
  "4ths": 3,
  octaves: 7,
};

/** Every position on the neck, drawn or hidden, with how to draw it. */
export type BoardNote = {
  string: number;
  fret: number;
  name: string;
  /** With octave, in the displayed spelling: what a click plays. */
  pitch: string;
  membership: Membership;
  role: Role;
  /** Primary-only notes as plain rings: a compare is set, or a lit 2nd/4th/6th in a shape. */
  ring: boolean;
  label: string;
  shown: boolean;
  aria: string;
};

export type BoardModel = {
  mode: Mode;
  notes: BoardNote[];
  links: FretLink[];
  moves: Move[];
  held: { string: number; fret: number }[];
  positions: Position[];
  position?: Position;
  /** Scale tiles: the key's notes in each position. */
  positionDots: Record<string, Pick<Dot, "string" | "fret" | "role">[]>;
  sets: StringSet[];
  set?: StringSet;
  /** Strings in use (the others are dimmed): the chosen set, or a shell's own strings. */
  active?: number[];
  /** Two-note chords: the pairs the chord offers, and the one shown. */
  pairs: typeof PAIRS;
  pair?: (typeof PAIRS)[number];
  /** The chord the mode shows (a triad in Triad shapes, a 7th chord otherwise). */
  chord: string;
  next?: string;
  shapes: Shape[];
  lit: number;
  title: string;
  caption?: string;
  /** Above the board: whose roles the colours (and numbers) show. */
  reference: string;
  /** What the shape sounds like: pitches low to high, and the next chord's for guide tones. */
  sound: string[];
  soundNext: string[];
  /** For the board's accessible name. */
  subject: string;
};

const ROLE_WORD: Partial<Record<Role, string>> = {
  root: "root",
  third: "3rd",
  fifth: "5th",
  seventh: "7th",
};

/** A tone's label under the Note / Degree / Interval / None setting ("R" for the root interval). */
export function labelFor(
  setting: DotLabel,
  t: { name: string; degree: string; interval: string },
): string {
  if (setting === "note") return t.name;
  if (setting === "none") return "";
  if (setting === "interval") return t.interval === "P1" ? "R" : t.interval;
  return t.degree;
}

function describe(
  name: string,
  pitch: string,
  role: Role,
  string: number,
  fret: number,
  count: number,
  where: string,
): string {
  return [
    `${spokenName(name)} ${String(octave(pitch) ?? "")}`,
    ROLE_WORD[role],
    `string ${String(count - string)}`,
    fret === 0 ? "open" : `fret ${String(fret)}`,
    where,
  ]
    .filter(Boolean)
    .join(", ");
}

/** The string sets a mode offers, highest first; none in Scale. */
export function setsFor(st: ShapeState, strings: readonly string[]) {
  if (st.mode === "scale") return [];
  // Shells have fixed strings: the four forms say where they sit.
  if (st.mode === "chords")
    return st.family === "triads" ? stringSets(strings, 3) : [];
  const skip =
    st.mode === "two" &&
    st.two === "harmony" &&
    (st.harmony === "6ths" || st.harmony === "octaves");
  return stringSets(strings, 2, skip);
}

/**
 * The mode's default strings: the top three for triads (G B E), the top pair
 * for chord tones (B E), G B for harmony (D B when a string is skipped), D G
 * for guide tones.
 */
function defaultSet(st: ShapeState, sets: StringSet[]): StringSet | undefined {
  const pick =
    st.mode === "guide" ? 2 : st.mode === "two" && st.two === "harmony" ? 1 : 0;
  return sets[Math.min(pick, sets.length - 1)];
}

/** Which diatonic chord the focus chord is (1 to 7), in either size; undefined with none. */
export function focusDegree(sel: Selection): number | undefined {
  const chord = sel.primary.chord;
  if (!chord) return undefined;
  for (const sevenths of [true, false]) {
    const found = diatonicChords(sel.primary, { sevenths }).find(
      (c) => c.symbol === chord,
    );
    if (found) return found.degree;
  }
  return undefined;
}

/**
 * The chord a mode shows, from the focus chord's degree (the tonic with none):
 * triads use the triad, shells and guide tones the 7th chord, two-note chords
 * the focus chord as it is (or the tonic chord in the chosen size).
 */
export function modeChord(
  sel: Selection,
  st: Pick<ShapeState, "mode" | "family">,
  sevenths: boolean,
): string {
  if (st.mode === "scale") return sel.primary.chord ?? "";
  if (st.mode === "two")
    return (
      sel.primary.chord ??
      diatonicChords(sel.primary, { sevenths })[0]?.symbol ??
      ""
    );
  const triad = st.mode === "chords" && st.family === "triads";
  const chords = diatonicChords(sel.primary, { sevenths: !triad });
  const degree = focusDegree(sel) ?? 1;
  return chords[degree - 1]?.symbol ?? chords[0]?.symbol ?? "";
}

/** The pairs a chord has: every pair of its root, 3rd, 5th and 7th. */
export function pairsOf(chord: string): typeof PAIRS {
  const roles = new Set(chordTones(chord).map((t) => t.role));
  return PAIRS.filter((p) => p.pair.every((r) => roles.has(r)));
}

/** The default next chord for guide tones: the diatonic 7th chord a 5th below (Am7 → D7). */
export function nextChord(sel: Selection, from: string): string {
  const root = transpose(chordTones(from)[0]?.name ?? "C", "P4");
  return (
    diatonicChords(sel.primary, { sevenths: true }).find(
      (c) => chroma(c.root) === chroma(root),
    )?.symbol ?? from
  );
}

const TRIAD_WORDS: Record<string, string> = {
  "": "major",
  m: "minor",
  dim: "diminished",
  aug: "augmented",
};

export const fretsText = (s: { low: number; high: number }) =>
  s.low === s.high
    ? `fret ${String(s.low)}`
    : `frets ${String(s.low)} to ${String(s.high)}`;

/**
 * The reference line: whose roles the colours and numbers show. The
 * focus chord's when one is set (its 7th form where a mode needs a 7th),
 * otherwise the key's. Without numbers on the dots it speaks of colours only.
 */
function referenceLine(label: DotLabel, subject: string): string {
  const what =
    label === "degree" || label === "interval"
      ? "Colours and numbers"
      : "Colours";
  return `${what}: roles in ${subject}`;
}

/** Pitches of some dots, low to high, spelled as the dots are. */
const pitches = (dots: readonly Dot[], strings: readonly string[]) =>
  dots
    .map((d) => respell(fretPitch(strings[d.string] ?? "E2", d.fret), d.name))
    .sort((a, b) => midi(a) - midi(b));

/** A progression at this moment: its chords, bars, shells and which chord is current. */
export type ProgressionNow = {
  tokens: ProgressionToken[];
  chords: string[];
  bars: number[];
  total: number;
  shapes: (Shape | undefined)[];
  index: number;
  nextIndex: number;
  /** Bar of the loop (from 0) on the display: where playback is, or the current chord's first bar. */
  bar: number;
};

// The shells depend only on the chords, the tuning and the root string.
let voicingCache: { key: string; shapes: (Shape | undefined)[] } | undefined;

export function progressionNow(
  p: ProgressionState,
  playback: Playback,
  strings: readonly string[],
): ProgressionNow {
  const tokens = parseProgression(p.text);
  const chords = progressionChords(tokens);
  const bars = barsFor(p.bars, chords.length);
  const total = bars.reduce((a, b) => a + b, 0);
  const key = `${chords.join(" ")}|${strings.join(" ")}|${p.root}`;
  if (voicingCache?.key !== key)
    voicingCache = { key, shapes: progressionVoicing(chords, strings, p.root) };
  const index = playback.running
    ? playback.countIn
      ? 0
      : chordAtBar(bars, playback.bar)
    : Math.min(p.current, Math.max(0, chords.length - 1));
  let bar = 0;
  for (let i = 0; i < index; i++) bar += bars[i] ?? 0;
  if (playback.running && !playback.countIn && total)
    bar = playback.bar % total;
  return {
    tokens,
    chords,
    bars,
    total,
    shapes: voicingCache.shapes,
    index,
    nextIndex: chords.length ? (index + 1) % chords.length : 0,
    bar,
  };
}

/**
 * Progression mode: the current chord's shell lit, the next chord's voices
 * as plain rings in their role colours, and "held" where a voice stays.
 * Other notes show dimmed only with "Notes outside" set to Dimmed.
 */
function progressionModel(
  now: ProgressionNow,
  sel: Selection,
  strings: readonly string[],
  frets: number,
  label: DotLabel,
  showOutside: boolean,
): BoardModel {
  const count = strings.length;
  const current = now.chords[now.index];
  const next = now.chords.length > 1 ? now.chords[now.nextIndex] : undefined;
  const shape = now.shapes[now.index];
  const nextShape = next ? now.shapes[now.nextIndex] : undefined;
  const held = heldVoices(shape, nextShape);
  const at = (d: { string: number; fret: number }) =>
    `${String(d.string)}-${String(d.fret)}`;
  const lit = new Map((shape?.dots ?? []).map((d) => [at(d), d]));
  const isHeld = new Set(held.map(at));
  const rings = new Map(
    (nextShape?.dots ?? [])
      .filter((d) => !isHeld.has(at(d)))
      .map((d) => [at(d), d]),
  );
  const root = current ? chordInfo(current)?.root : undefined;
  const notes: BoardNote[] = fretboardNotes(sel, strings, frets).map((n) => {
    const d = lit.get(at(n)) ?? rings.get(at(n));
    if (!d) {
      const interval = root ? intervalBetween(root, n.name) : "P1";
      const tone = { name: n.name, degree: degreeLabel(interval), interval };
      return {
        string: n.string,
        fret: n.fret,
        name: n.name,
        pitch: n.pitch,
        membership: "none" as const,
        role: "outside" as const,
        ring: false,
        label: labelFor(label, tone),
        shown: showOutside && current !== undefined,
        aria: describe(
          n.name,
          n.pitch,
          "outside",
          n.string,
          n.fret,
          count,
          "outside the shell",
        ),
      };
    }
    const ring = !lit.has(at(n));
    const pitch = respell(fretPitch(strings[d.string] ?? "E2", d.fret), d.name);
    const whose = ring ? (next ?? "") : (current ?? "");
    return {
      string: d.string,
      fret: d.fret,
      name: d.name,
      pitch,
      membership: "primary" as const,
      role: d.role,
      ring,
      label: labelFor(label, d),
      shown: true,
      aria: describe(
        d.name,
        pitch,
        d.role,
        d.string,
        d.fret,
        count,
        `of ${spokenName(chordLabel(whose))}${ring ? ", the next chord" : isHeld.has(at(d)) ? ", held into the next chord" : ""}`,
      ),
    };
  });
  const names = (shape?.dots ?? []).map((d) => d.name).join(" ");
  const triad = shape?.dots.some((d) => d.role === "fifth") ?? false;
  const title = current
    ? `${chordLabel(current)} shell · ${shape ? `${shape.tag ?? ""} · ${names}` : "no shell within 12 frets"}`
    : "Type chord symbols, separated by spaces";
  const strip = new Set([
    ...(shape?.dots ?? []).map((d) => d.string),
    ...(nextShape?.dots ?? []).map((d) => d.string),
  ]);
  return {
    mode: "progression",
    notes,
    links: [],
    moves: [],
    held,
    positions: [],
    positionDots: {},
    sets: [],
    pairs: [],
    chord: current ?? "",
    next,
    shapes: [],
    lit: -1,
    active: strip.size ? [...strip] : undefined,
    title,
    caption: triad
      ? `${chordLabel(current ?? "")} is a triad, so its 5th takes the 7th's place in the shell.`
      : undefined,
    reference: current
      ? `${referenceLine(label, chordLabel(current))}${next ? `. Rings: ${chordLabel(next)}, the next chord.` : ""}`
      : "",
    sound: shape ? pitches(shape.dots, strings) : [],
    soundNext: [],
    subject: current
      ? `${chordLabel(current)} shell${next ? `, with ${chordLabel(next)} next` : ""}`
      : "no chords yet",
  };
}

export function boardModel(
  st: ShapeState,
  sel: Selection,
  strings: readonly string[],
  frets: number,
  label: DotLabel,
  showOutside: boolean,
  sevenths = true,
  progression?: { state: ProgressionState; playback: Playback },
): BoardModel {
  if (st.mode === "progression")
    return progressionModel(
      progressionNow(
        progression?.state ?? appStore.getState().progression,
        progression?.playback ?? STOPPED,
        strings,
      ),
      sel,
      strings,
      frets,
      label,
      showOutside,
    );
  const count = strings.length;
  const hasCompare = Boolean(sel.compare);
  const key = targetName(sel.primary);
  const positions = cagedPositions(sel.primary);
  // A position belongs to Scale mode; the shape modes move along the neck with the strip.
  const position =
    st.mode === "scale"
      ? positions.find((p) => p.name === st.position)
      : undefined;
  const inPosition = (fret: number) =>
    !position || (fret >= position.from && fret <= position.to);
  const base: FretNote[] = fretboardNotes(sel, strings, frets);
  const positionDots = Object.fromEntries(
    positions.map((p) => [
      p.name,
      base
        .filter(
          (n) => n.membership !== "none" && n.fret >= p.from && n.fret <= p.to,
        )
        .map((n) => ({
          string: n.string,
          fret: n.fret,
          role: n.role === "outside" ? "other" : n.role,
        })),
    ]),
  );
  const common = {
    mode: st.mode,
    positions,
    position,
    positionDots,
    moves: [] as Move[],
    held: [] as { string: number; fret: number }[],
    soundNext: [] as string[],
  };

  if (st.mode === "scale") {
    const chord = sel.primary.chord ?? "";
    const where = position
      ? `${position.name} form, ${fretsText({ low: position.from, high: position.to })}`
      : "whole neck";
    const subject = sel.compare
      ? `${key} compared with ${targetName(sel.compare)}`
      : key;
    const counted =
      label === "degree" || label === "interval"
        ? ` ${label === "degree" ? "Degrees" : "Intervals"} count from ${labelReference(sel)}.`
        : "";
    return {
      ...common,
      notes: base.map((n) => ({
        string: n.string,
        fret: n.fret,
        name: n.name,
        pitch: n.pitch,
        membership: n.membership,
        role: n.role,
        ring: hasCompare,
        label: labelFor(label, n),
        shown: (n.membership !== "none" || showOutside) && inPosition(n.fret),
        aria: describe(
          n.name,
          n.pitch,
          n.role,
          n.string,
          n.fret,
          count,
          n.membership === "compare"
            ? "only in the compare key"
            : n.membership === "none"
              ? "outside the key"
              : "",
        ),
      })),
      links: halfStepLinks(sel, strings, frets).filter(
        (l) => inPosition(l.from) && inPosition(l.to),
      ),
      sets: [],
      pairs: [],
      chord,
      shapes: [],
      lit: -1,
      title: `${subject} · ${where}`,
      reference: referenceLine(label, chord ? chordLabel(chord) : key),
      caption: chord
        ? `${chordLabel(chord)}: its chord tones glow, the key's other notes are dim.${counted}`
        : undefined,
      sound: [],
      subject: `${subject}, ${where}`,
    };
  }

  const sets = setsFor(st, strings);
  const set = sets.find((s) => s.id === st.strings) ?? defaultSet(st, sets);
  const chord = modeChord(sel, st, sevenths);
  const shells = st.mode === "chords" && st.family === "shells";
  // Said when the mode shows a different size of the focus chord ("the triad of Am7").
  const focus = sel.primary.chord;
  const derived = focus && focus !== chord ? focus : undefined;
  const available = pairsOf(chord);
  const pairInfo =
    available.find((p) => p.pair.join() === st.pair.join()) ?? available[0];
  let all: Shape[] = [];
  let what = "";
  let caption: string | undefined;
  let next: string | undefined;
  const [s0, s1] = set?.strings ?? [];
  const pair =
    s0 !== undefined && s1 !== undefined ? ([s0, s1] as const) : undefined;

  if (st.mode === "chords" && st.family === "triads" && set) {
    all = triadShapes(strings, set.strings, chordTones(chord), frets);
    const info = chordInfo(chord);
    const kind = info ? (TRIAD_WORDS[info.suffix] ?? info.suffix) : "";
    what = `${info?.root ?? chord} ${kind} triad${derived ? ` (the triad of ${chordLabel(derived)})` : ""} · strings ${set.name}`;
  } else if (shells) {
    all = shellShapes(strings, chordTones(chord), frets);
    what = `${chordLabel(chord)} shell${derived ? ` (the 7th form of ${chordLabel(derived)})` : ""}`;
    caption = `${SHELL_CAPTION}${derived ? ` Shells need a 7th, so ${chordLabel(derived)} is shown as ${chordLabel(chord)}.` : ""}`;
  } else if (st.mode === "two" && st.two === "pairs" && pair) {
    const tones = chordTones(chord);
    const [a, b] = (pairInfo?.pair ?? []).map((r) =>
      tones.find((t) => t.role === r),
    );
    all = a && b ? pairShapes(strings, pair, a, b, frets) : [];
    what = `${chordLabel(chord)} · ${pairInfo?.text ?? ""} · strings ${set?.name ?? ""}`;
    caption = pairInfo?.caption;
  } else if (st.mode === "two" && pair) {
    all = harmonyShapes(strings, sel.primary, STEPS[st.harmony], pair, frets);
    const skipped = strings[pair[0] + 1];
    what = `${key} in ${st.harmony} · strings ${set?.name ?? ""}${pair[1] - pair[0] === 2 && skipped ? ` (${pitchClass(skipped)} string skipped)` : ""}`;
    caption = HARMONY_CAPTION[st.harmony];
  } else if (st.mode === "guide" && pair) {
    const sevenths = diatonicChords(sel.primary, { sevenths: true });
    next =
      st.next && sevenths.some((c) => c.symbol === st.next)
        ? st.next
        : nextChord(sel, chord);
    all = guideShapes(strings, pair, chord, next, frets);
    what = `${chordLabel(chord)} → ${chordLabel(next)} · strings ${set?.name ?? ""}`;
    caption = `${describeMotion(guideToneMotion(chord, next))} Solid notes are ${chordLabel(chord)}'s, dashed are ${chordLabel(next)}'s.${derived ? ` Guide tones need a 7th, so ${chordLabel(derived)} is shown as ${chordLabel(chord)}.` : ""}`;
  }

  const shapes = all;
  const lit = shapes.length ? Math.min(st.shape, shapes.length - 1) : -1;
  const shape = shapes[lit];
  const forced: DotLabel = st.mode === "guide" ? "note" : label;
  const harmonyMode = st.mode === "two" && st.two === "harmony";
  const shapeDot = new Map<string, { dot: Dot; next: boolean }>();
  for (const d of shape?.next ?? [])
    shapeDot.set(`${String(d.string)}-${String(d.fret)}`, {
      dot: d,
      next: true,
    });
  for (const d of shape?.dots ?? [])
    shapeDot.set(`${String(d.string)}-${String(d.fret)}`, {
      dot: d,
      next: false,
    });

  let detail = "no shape within 4 frets";
  if (shape && shells)
    detail = `${shape.tag ?? ""} · ${shape.dots.map((d) => d.name).join(" ")}`;
  else if (shape && st.mode === "chords")
    detail = `${shape.tag ?? ""} (${shape.bass ?? ""} in the bass)`;
  else if (shape && st.mode === "two") {
    const [lo, hi] = shape.dots;
    detail = `${lo?.name ?? ""} + ${hi?.name ?? ""} (${shape.interval ?? ""})`;
  } else if (shape) detail = fretsText(shape);

  return {
    ...common,
    moves: (shape?.moves ?? []).filter((m) => m.from !== m.to),
    held: (shape?.moves ?? [])
      .filter((m) => m.from === m.to)
      .map((m) => ({ string: m.string, fret: m.from })),
    notes: base.map((n) => {
      const hit = shapeDot.get(`${String(n.string)}-${String(n.fret)}`);
      if (!hit) return { ...n, ring: false, label: "", shown: false, aria: "" };
      const d = hit.dot;
      const pitch = respell(
        fretPitch(strings[d.string] ?? "E2", d.fret),
        d.name,
      );
      return {
        string: d.string,
        fret: d.fret,
        name: d.name,
        pitch,
        membership: hit.next ? "compare" : "primary",
        role: d.role,
        ring: !hit.next && d.role === "other",
        label: labelFor(forced, d),
        shown: true,
        aria: describe(
          d.name,
          pitch,
          hit.next ? "outside" : d.role,
          d.string,
          d.fret,
          count,
          hit.next && next ? `in ${spokenName(chordLabel(next))}` : "",
        ),
      };
    }),
    links: [],
    sets,
    set,
    active:
      set?.strings ??
      (shells && shape ? shape.dots.map((d) => d.string) : undefined),
    pairs: available,
    pair: pairInfo,
    chord,
    next,
    shapes,
    lit,
    title: `${what} · ${detail}`,
    // Harmony through the key colours by the key; the other modes by the chord they draw.
    reference: referenceLine(
      forced,
      harmonyMode || !focus
        ? key
        : chordLabel(st.mode === "guide" || shells ? chord : focus),
    ),
    caption,
    sound: shape ? pitches(shape.dots, strings) : [],
    soundNext: shape?.next ? pitches(shape.next, strings) : [],
    subject: `${what}, ${detail}`,
  };
}

/** The board model for the store's current state. */
export function modelOf(state: AppState): BoardModel {
  const { fretboard } = state;
  return boardModel(
    state.shapes,
    state.selection,
    tuning(fretboard.instrument, fretboard.tuning).strings,
    fretboard.frets,
    fretboard.label,
    fretboard.showOutside,
    state.sevenths,
    { state: state.progression, playback: state.playback },
  );
}

export function useBoardModel(): BoardModel {
  const selection = useAppStore((s) => s.selection);
  const fretboard = useAppStore((s) => s.fretboard);
  const shapes = useAppStore((s) => s.shapes);
  const sevenths = useAppStore((s) => s.sevenths);
  const progression = useAppStore((s) => s.progression);
  const playback = useAppStore((s) => s.playback);
  // While playing, the board only redraws when the chord changes, not every beat.
  const index =
    shapes.mode === "progression"
      ? progressionNow(
          progression,
          playback,
          tuning(fretboard.instrument, fretboard.tuning).strings,
        ).index
      : 0;
  return useMemo(
    () =>
      boardModel(
        shapes,
        selection,
        tuning(fretboard.instrument, fretboard.tuning).strings,
        fretboard.frets,
        fretboard.label,
        fretboard.showOutside,
        sevenths,
        { state: { ...progression, current: index }, playback: STOPPED },
      ),
    // The model reads the chord shown through `index` when playing.
    [shapes, selection, fretboard, sevenths, progression, index],
  );
}

/**
 * One step along the strip (← / → and the strip's arrows): the next position
 * in Scale, the next shape up or down the neck otherwise.
 */
export function stepPatch(
  st: ShapeState,
  model: BoardModel,
  dir: 1 | -1,
): Partial<ShapeState> | undefined {
  if (st.mode === "scale") {
    const names = [null, ...model.positions.map((p) => p.name)];
    const i = names.indexOf(st.position);
    const j = Math.min(names.length - 1, Math.max(0, i + dir));
    return j === i ? undefined : { position: names[j] ?? null };
  }
  const j = Math.min(model.shapes.length - 1, Math.max(0, model.lit + dir));
  return j === model.lit || j < 0 ? undefined : { shape: j };
}

/**
 * Plays the shape on the board: arpeggiated then together, then the next
 * chord's guide tones. In Scale, nothing (a position is not a chord).
 */
export function playShape(): void {
  const model = modelOf(appStore.getState());
  if (model.sound.length === 0) return;
  play(boardInstrument(), [
    { notes: model.sound, style: model.soundNext.length ? "block" : "chord" },
    { notes: model.soundNext, style: "block" },
  ]);
}

/** Steps the strip on the store's current state, and plays the new shape; false at either end. */
export function stepStrip(dir: 1 | -1): boolean {
  unlockAudio();
  const state = appStore.getState();
  // Progression: with the metronome stopped, the next or previous chord, round the loop.
  if (state.shapes.mode === "progression") {
    if (state.playback.running) return false;
    const { fretboard } = state;
    const now = progressionNow(
      state.progression,
      state.playback,
      tuning(fretboard.instrument, fretboard.tuning).strings,
    );
    const n = now.chords.length;
    if (n === 0) return false;
    state.setProgression({ current: (now.index + dir + n) % n });
    playShape();
    return true;
  }
  const patch = stepPatch(state.shapes, modelOf(state), dir);
  if (patch) {
    state.setShapes(patch);
    playShape();
  }
  return patch !== undefined;
}

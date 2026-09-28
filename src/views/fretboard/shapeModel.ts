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
  guideToneMotion,
  halfStepLinks,
  harmonyShapes,
  labelReference,
  pairShapes,
  stringSets,
  triadShapes,
  type Dot,
  type FretLink,
  type FretNote,
  type Membership,
  type Move,
  type Position,
  type Role,
  type Shape,
  type ShapeRole,
  type StringSet,
} from "../../relations/index.ts";
import {
  appStore,
  useAppStore,
  type AppState,
  type DotLabel,
  type Harmony,
  type Mode,
  type ShapeState,
} from "../../state/index.ts";
import {
  chordInfo,
  chroma,
  fretPitch,
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
  { value: "triads", text: "Triad shapes" },
  { value: "two", text: "Two-note chords" },
  { value: "guide", text: "Guide tones" },
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
  if (st.mode === "triads") return stringSets(strings, 3);
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
 * Triad shapes use the triad, guide tones the 7th chord, two-note chords the
 * focus chord as it is (or the tonic chord in the chosen size).
 */
export function modeChord(
  sel: Selection,
  mode: Mode,
  sevenths: boolean,
): string {
  if (mode === "scale") return sel.primary.chord ?? "";
  if (mode === "two")
    return (
      sel.primary.chord ??
      diatonicChords(sel.primary, { sevenths })[0]?.symbol ??
      ""
    );
  const chords = diatonicChords(sel.primary, { sevenths: mode !== "triads" });
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

export function boardModel(
  st: ShapeState,
  sel: Selection,
  strings: readonly string[],
  frets: number,
  label: DotLabel,
  showOutside: boolean,
  sevenths = true,
): BoardModel {
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
  const chord = modeChord(sel, st.mode, sevenths);
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

  if (st.mode === "triads" && set) {
    all = triadShapes(strings, set.strings, chordTones(chord), frets);
    const info = chordInfo(chord);
    const kind = info ? (TRIAD_WORDS[info.suffix] ?? info.suffix) : "";
    what = `${info?.root ?? chord} ${kind} triad${derived ? ` (the triad of ${chordLabel(derived)})` : ""} · strings ${set.name}`;
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
  if (shape && st.mode === "triads")
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
        : chordLabel(st.mode === "guide" ? chord : focus),
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
  );
}

export function useBoardModel(): BoardModel {
  const selection = useAppStore((s) => s.selection);
  const fretboard = useAppStore((s) => s.fretboard);
  const shapes = useAppStore((s) => s.shapes);
  const sevenths = useAppStore((s) => s.sevenths);
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
      ),
    [shapes, selection, fretboard, sevenths],
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
  const patch = stepPatch(state.shapes, modelOf(state), dir);
  if (patch) {
    state.setShapes(patch);
    playShape();
  }
  return patch !== undefined;
}

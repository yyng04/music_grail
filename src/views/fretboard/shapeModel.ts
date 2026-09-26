// M3b controls mockup: the Show / Position state and what the board draws for it.
import { diatonicChords, fretboardNotes } from "../../relations/index.ts";
import { useMemo } from "react";
import { useAppStore } from "../../state/index.ts";
import {
  chroma,
  transpose,
  tuning,
  type Selection,
} from "../../theory/index.ts";
import type { Harmony, Mode, ShapeState } from "../../state/index.ts";
import type { Layer } from "./ShapeBoard.tsx";

export type { Harmony, Mode, ShapeState };
import {
  cagedPositions,
  chordTones,
  guideShapes,
  harmonyShapes,
  inWindow,
  pairShapes,
  triadShapes,
  type Dot,
  type Position,
  type ShapeRole,
  type Shape,
} from "../../relations/index.ts";

export const MODES: { value: Mode; text: string }[] = [
  { value: "scale", text: "Scale" },
  { value: "triads", text: "Triads" },
  { value: "two", text: "Two-note chords" },
  { value: "guide", text: "Guide tones" },
];

/** String sets by string number (1 = highest), as tuning indices (0 = lowest). */
export const STRING_SETS: { text: string; set: [number, number, number] }[] = [
  { text: "1 2 3", set: [3, 4, 5] },
  { text: "2 3 4", set: [2, 3, 4] },
  { text: "3 4 5", set: [1, 2, 3] },
  { text: "4 5 6", set: [0, 1, 2] },
];
export const STRING_PAIRS: Record<string, [number, number]> = {
  "1 2": [4, 5],
  "2 3": [3, 4],
  "3 4": [2, 3],
  "4 5": [1, 2],
  "5 6": [0, 1],
  "1 3": [3, 5],
  "2 4": [2, 4],
  "3 5": [1, 3],
  "4 6": [0, 2],
};
export const pairsFor = (h: Harmony) =>
  h === "6ths" || h === "octaves"
    ? ["1 3", "2 4", "3 5", "4 6"]
    : ["1 2", "2 3", "3 4", "4 5", "5 6"];
const STEPS: Record<Harmony, number> = {
  "3rds": 2,
  "6ths": 5,
  "4ths": 3,
  octaves: 7,
};

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

export type Built = {
  layer: Layer;
  shapes: Shape[];
  lit: number;
  positions: Position[];
  position?: Position;
  /** What the board shows, in one line: "G major triads on strings 1 2 3". */
  subject: string;
  caption: string;
  chord: string;
};

const tonicChord = (sel: Selection, sevenths: boolean) =>
  diatonicChords(sel.primary, { sevenths })[0]?.symbol ?? "C";
/** The default next chord for guide tones: the diatonic chord a 5th below. */
export function nextChord(sel: Selection, from: string): string {
  const root = transpose(chordTones(from)[0]?.name ?? "C", "P4");
  return (
    diatonicChords(sel.primary, { sevenths: true }).find(
      (c) => chroma(c.root) === chroma(root),
    )?.symbol ?? from
  );
}

export function build(
  st: ShapeState,
  sel: Selection,
  strings: readonly string[],
  frets: number,
): Built {
  const positions = cagedPositions(sel.primary);
  const position = positions.find((p) => p.name === st.position);
  const key = `${sel.primary.tonic} ${sel.primary.kind}`;
  let shapes: Shape[];
  let subject: string;
  let caption: string;
  let chord = sel.primary.chord ?? tonicChord(sel, false);

  if (st.mode === "scale") {
    const dots: Dot[] = fretboardNotes(sel, strings, frets)
      .filter((n) => n.membership !== "none")
      .filter(
        (n) => !position || (n.fret >= position.from && n.fret <= position.to),
      )
      .map((n) => ({
        string: n.string,
        fret: n.fret,
        name: n.name,
        role: n.role === "outside" ? "other" : n.role,
        label: n.degree,
      }));
    subject = position
      ? `${key}, ${position.name} shape`
      : `${key}, whole neck`;
    caption = position
      ? `Frets ${String(position.from)} to ${String(position.to)}: every note of ${key} under one hand.`
      : "Every note of the key on the neck.";
    return {
      layer: { dots, shapes: [] },
      shapes: [],
      lit: -1,
      positions,
      position,
      subject,
      caption,
      chord,
    };
  }
  if (st.mode === "triads") {
    const set = STRING_SETS[st.set] ?? {
      text: "1 2 3",
      set: [3, 4, 5] as const,
    };
    shapes = triadShapes(strings, set.set, chordTones(chord), frets);
    // A 7th chord uses its triad (§5.2b): the diatonic triad on the same root.
    const root = chordTones(chord)[0]?.name ?? "";
    const triad =
      diatonicChords(sel.primary, { sevenths: false }).find(
        (c) => c.root === root,
      )?.symbol ?? chord;
    subject = `${triad} triads on strings ${set.text}`;
    caption =
      "Every closed shape: one chord tone per string, within 4 frets. Named by the note in the bass.";
  } else if (st.mode === "two" && st.two === "pairs") {
    chord = sel.primary.chord ?? tonicChord(sel, true);
    const tones = chordTones(chord);
    const [a, b] = st.pair.map((r) => tones.find((t) => t.role === r));
    shapes = a && b ? pairShapes(strings, a, b, frets) : [];
    const p = PAIRS.find((x) => x.pair.join() === st.pair.join());
    subject = `${chord}: ${p?.text.toLowerCase() ?? ""} on two strings`;
    caption = p?.caption ?? "";
  } else if (st.mode === "two") {
    const pair = STRING_PAIRS[st.strings2] ?? [3, 4];
    shapes = harmonyShapes(
      strings,
      sel.primary,
      STEPS[st.harmony],
      pair,
      frets,
    );
    subject = `${key} in ${st.harmony} on strings ${st.strings2}`;
    caption = HARMONY_CAPTION[st.harmony];
  } else {
    chord = sel.primary.chord ?? tonicChord(sel, true);
    const next = st.next ?? nextChord(sel, chord);
    shapes = guideShapes(strings, chord, next, frets);
    const moves = shapes[0]?.moves ?? [];
    const first = shapes[0];
    const said = first?.dots
      .map((d, i) => {
        const to = first.next?.[i];
        return moves[i]?.held
          ? `${d.name} held`
          : `${d.name} → ${to?.name ?? ""}`;
      })
      .join(", ");
    subject = `Guide tones, ${chord} → ${next}`;
    caption = `${said ?? ""}. The 3rd and 7th move by a half step or stay put.`;
  }

  const visible = shapes.filter((s) => inWindow(s, position));
  const lit = Math.min(st.shape, visible.length - 1);
  const dots = new Map<string, Dot & { faint?: boolean; dashed?: boolean }>();
  visible.forEach((s, i) => {
    for (const d of s.dots) {
      const k = `${String(d.string)}-${String(d.fret)}`;
      if (i === lit || !dots.has(k)) dots.set(k, { ...d, faint: i !== lit });
    }
  });
  const shown = visible[lit];
  shown?.next?.forEach((d, i) => {
    if (shown.moves?.[i]?.held) return;
    dots.set(`${String(d.string)}-${String(d.fret)}-next`, {
      ...d,
      dashed: true,
    });
  });
  return {
    layer: {
      dots: [...dots.values()],
      shapes: visible.map((shape, i) => ({ shape, lit: i === lit })),
    },
    shapes: visible,
    lit,
    positions,
    position,
    subject,
    caption,
    chord,
  };
}

/** What the board shows for the current Show state, shared by the board, strip and list. */
export function useShapes() {
  const selection = useAppStore((s) => s.selection);
  const settings = useAppStore((s) => s.fretboard);
  const st = useAppStore((s) => s.shapes);
  const strings = tuning(settings.instrument, settings.tuning).strings;
  const frets = settings.frets;
  return useMemo(
    () => ({
      st,
      strings,
      frets,
      built: build(st, selection, strings, frets),
      scaleDots: build(
        { ...st, mode: "scale", position: null },
        selection,
        strings,
        frets,
      ).layer.dots,
    }),
    [st, selection, strings, frets],
  );
}

export const fretsText = (s: Shape) =>
  s.low === s.high
    ? `fret ${String(s.low)}`
    : `frets ${String(s.low)} to ${String(s.high)}`;

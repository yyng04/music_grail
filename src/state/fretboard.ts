import type { ShapeRole } from "../relations/index.ts";
import { instrument, type InstrumentId } from "../theory/index.ts";

export type DotLabel = "note" | "degree" | "interval" | "none";

/** Fretboard display settings (§5.2). Kept in localStorage, not in the URL. */
export type FretboardSettings = {
  instrument: InstrumentId;
  tuning: string;
  /** Highest fret; frets 0 to 15 fit the view and the rest scrolls. */
  frets: number;
  label: DotLabel;
  /** Player's view: lowest string at the top. Default is the diagram view. */
  lowOnTop: boolean;
  /** Left-handed mirror: nut on the right. */
  leftHanded: boolean;
  /** Notes outside the key(s): hidden, or shown dimmed. */
  showOutside: boolean;
};

export const DEFAULT_FRETBOARD: FretboardSettings = {
  instrument: "guitar",
  tuning: "standard",
  frets: 24,
  label: "degree",
  lowOnTop: false,
  leftHanded: false,
  showOutside: false,
};

const STORAGE_KEY = "music-grail:fretboard";
const LABELS: readonly DotLabel[] = ["note", "degree", "interval", "none"];

/** Keeps only valid values, so a stale or edited entry never breaks the board. */
export function checkFretboard(value: unknown): FretboardSettings {
  const v = (typeof value === "object" && value !== null ? value : {}) as {
    [K in keyof FretboardSettings]?: unknown;
  };
  const inst = instrument(
    typeof v.instrument === "string"
      ? (v.instrument as InstrumentId)
      : DEFAULT_FRETBOARD.instrument,
  );
  const tuning = inst.tunings.find((t) => t.id === v.tuning)?.id;
  const frets = inst.frets.find((f) => f === v.frets);
  const bool = (x: unknown, fallback: boolean) =>
    typeof x === "boolean" ? x : fallback;
  return {
    instrument: inst.id,
    tuning: tuning ?? inst.tunings[0]?.id ?? "standard",
    frets: frets ?? inst.frets[0] ?? 24,
    label: LABELS.find((l) => l === v.label) ?? DEFAULT_FRETBOARD.label,
    lowOnTop: bool(v.lowOnTop, DEFAULT_FRETBOARD.lowOnTop),
    leftHanded: bool(v.leftHanded, DEFAULT_FRETBOARD.leftHanded),
    showOutside: bool(v.showOutside, DEFAULT_FRETBOARD.showOutside),
  };
}

export function loadFretboard(): FretboardSettings {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return checkFretboard(text ? JSON.parse(text) : undefined);
  } catch {
    return DEFAULT_FRETBOARD;
  }
}

export function saveFretboard(settings: FretboardSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be blocked (private windows); the settings still apply for this visit.
  }
}

export type Mode = "scale" | "triads" | "two" | "guide";
export type Harmony = "3rds" | "6ths" | "4ths" | "octaves";

/** The Show and Position controls (§5.2b). Kept for the visit only. */
export type ShapeState = {
  mode: Mode;
  /** CAGED letter, or null for the whole neck. */
  position: string | null;
  /** Triads: index into the string sets (strings 1 2 3 first). */
  set: number;
  /** Index of the lit shape among those shown. */
  shape: number;
  two: "pairs" | "harmony";
  pair: [ShapeRole, ShapeRole];
  harmony: Harmony;
  /** Harmony: the string pair, by string numbers ("2 3"). */
  strings2: string;
  /** Guide tones: the chord moved to; unset means the chord a 5th below. */
  next?: string;
};

export const DEFAULT_SHAPES: ShapeState = {
  mode: "scale",
  position: null,
  set: 0,
  shape: 0,
  two: "pairs",
  pair: ["third", "seventh"],
  harmony: "3rds",
  strings2: "2 3",
};

import type { DrumStyle, Sig } from "../audio/rhythm.ts";
import type { RootString } from "../relations/index.ts";

/** Progression mode's settings. All but the volumes are kept in the URL hash. */
export type ProgressionState = {
  /** The chord symbols as typed. */
  text: string;
  /** Bars per readable chord, in order (1 to 8). */
  bars: number[];
  root: RootString;
  /** Counted beats per minute: quarters, or dotted quarters in 6/8 and 12/8. */
  tempo: number;
  sig: Sig;
  drums: DrumStyle;
  /** The chord shown while the metronome is stopped. */
  current: number;
  /** 0 to 100. */
  clickVolume: number;
  drumVolume: number;
};

export const DEFAULT_PROGRESSION: ProgressionState = {
  text: "",
  bars: [],
  root: "auto",
  tempo: 90,
  sig: "4/4",
  drums: "off",
  current: 0,
  clickVolume: 70,
  drumVolume: 70,
};

export const MIN_TEMPO = 40;
export const MAX_TEMPO = 240;
export const MAX_BARS = 8;

/** Where the metronome is. Never kept in the URL. */
export type Playback = {
  running: boolean;
  /** The bar of clicks before the first chord. */
  countIn: boolean;
  /** Bar of the progression from 0, counting on through every loop. */
  bar: number;
  beat: number;
};

export const STOPPED: Playback = {
  running: false,
  countIn: false,
  bar: 0,
  beat: 0,
};

export const clampTempo = (n: number) =>
  Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(n)));

/** Bar counts for a number of chords: the ones given, 1 for the rest. */
export function barsFor(bars: readonly number[], count: number): number[] {
  return Array.from({ length: count }, (_, i) =>
    Math.min(MAX_BARS, Math.max(1, Math.round(bars[i] ?? 1))),
  );
}

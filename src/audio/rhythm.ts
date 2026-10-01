// Counting for the metronome, with no sound: time signatures, which beat a
// step falls on, how loud the click is there, and the drum patterns. The
// metronome runs on a grid of 6 steps per counted beat, which holds straight
// eighths (every 3 steps), triplet eighths (every 2) and, in 6/8 and 12/8,
// the three eighths of a dotted quarter (every 2).

export type Sig = "2/4" | "3/4" | "4/4" | "6/8" | "12/8";
export const SIGS: readonly Sig[] = ["2/4", "3/4", "4/4", "6/8", "12/8"];

/** Steps per counted beat. */
export const GRID = 6;

/**
 * Beats counted in a bar, and eighth notes per counted beat. In 6/8 and 12/8
 * the tempo counts dotted quarters, so a beat holds three eighths.
 */
export function beatsOf(sig: Sig): { count: number; eighths: number } {
  if (sig === "6/8") return { count: 2, eighths: 3 };
  if (sig === "12/8") return { count: 4, eighths: 3 };
  return { count: Number(sig.split("/")[0]), eighths: 1 };
}

export type Step = {
  /** The bar of clicks before the first chord. */
  countIn: boolean;
  /** Bar of the progression, from 0 (counting on through every loop); 0 during the count-in. */
  bar: number;
  beat: number;
  /** Step within the beat, 0 to 5. */
  sub: number;
};

/** Where step n falls, counting from the first step of the count-in bar. */
export function stepAt(n: number, sig: Sig): Step {
  const perBar = beatsOf(sig).count * GRID;
  const inBar = n % perBar;
  const beat = Math.floor(inBar / GRID);
  const sub = inBar % GRID;
  if (n < perBar) return { countIn: true, bar: 0, beat, sub };
  return { countIn: false, bar: Math.floor(n / perBar) - 1, beat, sub };
}

export type Click = "accent" | "beat" | "eighth";

/**
 * The click on a step: loudest on beat 1, then every counted beat. In 6/8
 * and 12/8 it also plays the eighths between, quieter.
 */
export function clickAt(step: Step, sig: Sig): Click | undefined {
  const { eighths } = beatsOf(sig);
  if (step.sub === 0) return step.beat === 0 ? "accent" : "beat";
  if (eighths === 3 && step.sub % 2 === 0) return "eighth";
  return undefined;
}

export type DrumStyle = "off" | "rock" | "swing" | "bossa" | "waltz" | "six";
export type Sound =
  "kick" | "snare" | "cross" | "hat" | "open" | "pedal" | "ride";
export const SOUNDS: readonly Sound[] = [
  "kick",
  "snare",
  "cross",
  "hat",
  "open",
  "pedal",
  "ride",
];
export type Level = "accent" | "normal" | "soft";
export type Hit = { sound: Sound; level: Level };

type Pattern = Partial<Record<Sound, string[]>>;

/**
 * Patterns, one string per bar, 6 characters per counted beat (spaces are
 * only for reading): X accent, x normal, o soft, . rest.
 */
const PATTERNS: Record<
  Exclude<DrumStyle, "off">,
  Partial<Record<Sig, Pattern>>
> = {
  rock: {
    "4/4": {
      kick: ["X..... ...... x..... x..x.."],
      snare: ["...... x..... ...... x....."],
      hat: ["x..x.. x..x.. x..x.. x....."],
      open: ["...... ...... ...... ...x.."],
    },
  },
  // Ride "ding, ding-a" on triplets, hi-hat foot on 2 and 4, kick feathered.
  swing: {
    "4/4": {
      ride: ["x..... x...o. x..... x...o."],
      pedal: ["...... x..... ...... x....."],
      kick: ["o..... o..... o..... o....."],
    },
  },
  // Two bars: kick on 1 and 2&, 3 and 4&; cross-stick clave 1, 2&, 4 | 2, 3&.
  bossa: {
    "4/4": {
      kick: ["x..... ...o.. x..... ...o.."],
      hat: ["x..o.. x..o.. x..o.. x..o.."],
      cross: ["x..... ...x.. ...... x.....", "...... x..... ...x.. ......"],
    },
  },
  waltz: {
    "3/4": {
      ride: ["x..... x...o. x....."],
      pedal: ["...... x..... x....."],
      kick: ["o..... ...... ......"],
    },
  },
  six: {
    "6/8": {
      kick: ["X..... ....o."],
      snare: ["...... x....."],
      hat: ["x.o.o. x.o.o."],
    },
    "12/8": {
      kick: ["X..... ....o. x..... ......"],
      snare: ["...... x..... ...... x....."],
      hat: ["x.o.o. x.o.o. x.o.o. x.o.o."],
    },
  },
};

export const STYLES: { value: DrumStyle; text: string }[] = [
  { value: "off", text: "Click only" },
  { value: "rock", text: "Rock" },
  { value: "swing", text: "Swing" },
  { value: "bossa", text: "Bossa" },
  { value: "waltz", text: "Jazz waltz" },
  { value: "six", text: "6/8 groove" },
];

/** The backing styles that fit a time signature: click only, and the drum styles written in it. */
export function stylesFor(sig: Sig): typeof STYLES {
  return STYLES.filter(
    (s) => s.value === "off" || PATTERNS[s.value][sig] !== undefined,
  );
}

const LEVELS: Record<string, Level> = { X: "accent", x: "normal", o: "soft" };

/** The drum hits on a step; none during the count-in or when the style does not fit. */
export function drumHits(style: DrumStyle, sig: Sig, step: Step): Hit[] {
  if (style === "off" || step.countIn) return [];
  const pattern = PATTERNS[style][sig];
  if (!pattern) return [];
  const at = step.beat * GRID + step.sub;
  return SOUNDS.flatMap((sound) => {
    const bars = pattern[sound];
    if (!bars?.length) return [];
    const line = (bars[step.bar % bars.length] ?? "").replace(/ /g, "");
    const level = LEVELS[line[at] ?? "."];
    return level ? [{ sound, level }] : [];
  });
}

/** Every bar of every pattern is one bar long in its time signature (for tests). */
export function patternLengths(): {
  style: string;
  sig: Sig;
  lengths: number[];
}[] {
  return Object.entries(PATTERNS).flatMap(([style, bySig]) =>
    Object.entries(bySig).map(([sig, pattern]) => ({
      style,
      sig: sig as Sig,
      lengths: Object.values(pattern).flatMap((bars) =>
        bars.map((b) => b.replace(/ /g, "").length),
      ),
    })),
  );
}

/** Tap tempo: beats per minute from the last taps (within 2 s of each other), 40 to 240. */
export function tapTempo(times: readonly number[]): number | undefined {
  const recent: number[] = [];
  for (let i = times.length - 1; i >= 0; i--) {
    const t = times[i] ?? 0;
    const prev = recent[0];
    if (prev !== undefined && prev - t > 2000) break;
    recent.unshift(t);
    if (recent.length === 5) break;
  }
  if (recent.length < 2) return undefined;
  const span = (recent[recent.length - 1] ?? 0) - (recent[0] ?? 0);
  const bpm = Math.round(60000 / (span / (recent.length - 1)));
  return Math.min(240, Math.max(40, bpm));
}

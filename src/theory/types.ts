export const KINDS = [
  "major",
  "minor",
  "harmonic-minor",
  "dorian",
  "phrygian",
  "lydian",
  "mixolydian",
  "locrian",
] as const;

export type Kind = (typeof KINDS)[number];

export type Target = {
  /** Pitch class with its spelling, e.g. "G", "Bb", "F#". */
  tonic: string;
  kind: Kind;
  /** Optional focus chord, e.g. "Gmaj7". Always a canonical symbol. */
  chord?: string;
};

export type Selection = {
  primary: Target;
  compare?: Target;
};

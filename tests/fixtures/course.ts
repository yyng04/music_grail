// Answer keys from the five course lessons (§8.1). Spelling must match exactly.

export const buildIntervals = [
  { from: "F", interval: "M3", note: "A" },
  { from: "D", interval: "m3", note: "F" },
  { from: "Eb", interval: "P5", note: "Bb" },
  { from: "G", interval: "m7", note: "F" },
  { from: "Ab", interval: "M7", note: "G" },
  { from: "B", interval: "P4", note: "E" },
];

export const nameIntervals = [
  { from: "C", to: "E", interval: "M3" },
  { from: "C", to: "Eb", interval: "m3" },
  { from: "D", to: "A", interval: "P5" },
  { from: "A", to: "C#", interval: "M3" },
  { from: "F", to: "B", interval: "A4" },
  { from: "E", to: "C", interval: "m6" },
  { from: "B", to: "F", interval: "d5" },
  { from: "Ab", to: "G", interval: "M7" },
];

export const majorScales: Record<string, string> = {
  G: "G A B C D E F#",
  D: "D E F# G A B C#",
  F: "F G A Bb C D E",
  Bb: "Bb C D Eb F G A",
  E: "E F# G# A B C# D#",
  Eb: "Eb F G Ab Bb C D",
  A: "A B C# D E F# G#",
  Ab: "Ab Bb C Db Eb F G",
};

export const keySignatures: Record<string, string> = {
  G: "1#",
  Eb: "3b",
  B: "5#",
  Db: "5b",
  A: "3#",
  F: "1b",
};

export const degreeFormulas = [
  { tonic: "C", formula: "1 b3 5", notes: "C Eb G" },
  { tonic: "G", formula: "1 3 5 b7", notes: "G B D F" },
  { tonic: "B", formula: "1 b3 b5 b7", notes: "B D F A" },
  { tonic: "Ab", formula: "1 3 5 7", notes: "Ab C Eb G" },
];

export const triads: Record<string, string> = {
  D: "D F# A",
  Fm: "F Ab C",
  Bdim: "B D F",
  Eb: "Eb G Bb",
  "C#m": "C# E G#",
  Gaug: "G B D#",
  Ab: "Ab C Eb",
  "F#m": "F# A C#",
};

export const diatonicTriadsOfG = [
  { notes: "G B D", quality: "major" },
  { notes: "A C E", quality: "minor" },
  { notes: "B D F#", quality: "minor" },
  { notes: "C E G", quality: "major" },
  { notes: "D F# A", quality: "major" },
  { notes: "E G B", quality: "minor" },
  { notes: "F# A C", quality: "diminished" },
];

export const nameChords: Record<string, string> = {
  "G B D F": "G7",
  "C Eb G Bb": "Cm7",
  "F A C E": "Fmaj7",
  "B D F A": "Bm7b5",
  "Ab C Eb Gb": "Ab7",
  "D F# A C#": "Dmaj7",
};

export const seventhChords: Record<string, string> = {
  Amaj7: "A C# E G#",
  C7: "C E G Bb",
  Fm7: "F Ab C Eb",
  Dm7b5: "D F Ab C",
  Bbmaj7: "Bb D F A",
  E7: "E G# B D",
  "G#m7": "G# B D# F#",
  Bdim7: "B D F Ab",
  Ebm7: "Eb Gb Bb Db",
  "F#maj7": "F# A# C# E#",
};

export const diatonicSeventhsOfF = [
  "Fmaj7",
  "Gm7",
  "Am7",
  "Bbmaj7",
  "C7",
  "Dm7",
  "Em7b5",
];

export const chordsByDegree = [
  { numeral: "ii7", key: "Bb", chord: "Cm7" },
  { numeral: "V7", key: "Bb", chord: "F7" },
  { numeral: "vi7", key: "Bb", chord: "Gm7" },
  { numeral: "IVmaj7", key: "D", chord: "Gmaj7" },
  { numeral: "V7", key: "E", chord: "B7" },
  { numeral: "viim7b5", key: "G", chord: "F#m7b5", notes: "F# A C E" },
];

export const keyFromDominant = {
  chord: "A7",
  notes: "A C# E G",
  key: "D",
  degree: 5,
};

export const relativeMinors: Record<string, string> = {
  G: "Em",
  Eb: "Cm",
  A: "F#m",
  Db: "Bbm",
};

export const modes = [
  { tonic: "E", kind: "minor", notes: "E F# G A B C D" },
  { tonic: "D", kind: "dorian", notes: "D E F G A B C" },
  { tonic: "G", kind: "mixolydian", notes: "G A B C D E F" },
  { tonic: "C", kind: "dorian", notes: "C D Eb F G A Bb" },
] as const;

export const guideTones: Record<string, string> = {
  Dm7: "F C",
  G7: "B F",
  Cmaj7: "E B",
  Am7b5: "C G",
  Eb7: "G Db",
  "F#m7": "A E",
  Bbmaj7: "D A",
  "C#m7": "E B",
};

export const guideToneMotion = [
  {
    chords: ["Am7", "D7", "Gmaj7"],
    steps: [
      { held: "C", moves: { from: "G", to: "F#" } },
      { held: "F#", moves: { from: "C", to: "B" } },
    ],
  },
  {
    chords: ["Cm7", "F7", "Bbmaj7"],
    steps: [
      { held: "Eb", moves: { from: "Bb", to: "A" } },
      { held: "A", moves: { from: "Eb", to: "D" } },
    ],
  },
];

export const keyDiffs = [
  {
    primary: "G",
    compare: "D",
    changed: [{ primary: "C", compare: "C#" }],
    shared: 6,
    respelled: 0,
  },
  { primary: "C#", compare: "Db", changed: [], shared: 7, respelled: 7 },
];

export const intervalFormats = [
  { tonal: "3M", app: "M3" },
  { tonal: "4A", app: "A4" },
  { tonal: "5d", app: "d5" },
  { tonal: "7m", app: "m7" },
];

export const urlRoundTrip = [
  {
    text: "Fs-major",
    key: { tonic: "F#", kind: "major" },
    canonical: "Fs-major",
  },
  {
    text: "Bb-minor",
    key: { tonic: "Bb", kind: "minor" },
    canonical: "Bb-minor",
  },
  {
    text: "A-aeolian",
    key: { tonic: "A", kind: "minor" },
    canonical: "A-minor",
  },
] as const;

export const urlChordRoundTrip = [
  { text: "C-sus4", root: "C", type: "sus4", symbol: "Csus4" },
];

export const harmonicMinor = {
  tonic: "A",
  notes: "A B C D E F G#",
  triads: "Am Bdim Caug Dm E F G#dim",
  sevenths: "AmMaj7 Bm7b5 Cmaj7#5 Dm7 E7 Fmaj7 G#dim7",
};
